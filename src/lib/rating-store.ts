import {
  mkdir,
  readFile,
  rename,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { LunchError } from "./lunch.ts";
import { snapshot } from "./restaurant-store.ts";
import type { Ratings } from "./ratings";

type Vote = { restaurantId: string; userId: string; score: number };
const file = resolve(
  process.env.LUNCH_DATA_FILE
    ? `${process.env.LUNCH_DATA_FILE}.ratings`
    : "data/ratings.json",
);
const lock = `${file}.lock`;

function validateUser(user: string | null): string {
  if (
    !user ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      user,
    )
  )
    throw new LunchError("사용자 정보를 확인해 주세요.");
  return user;
}

async function readVotes(): Promise<Vote[]> {
  try {
    const data: unknown = JSON.parse(await readFile(file, "utf8"));
    if (
      !Array.isArray(data) ||
      data.some(
        (v) =>
          !v ||
          typeof v.restaurantId !== "string" ||
          typeof v.userId !== "string" ||
          !Number.isInteger(v.score) ||
          v.score < 1 ||
          v.score > 5,
      )
    )
      throw new Error("Invalid ratings");
    return data as Vote[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new LunchError("저장된 별점 정보를 읽지 못했어요.", 500);
  }
}

function summarize(votes: Vote[], user: string): Ratings {
  const sums: Record<string, { sum: number; count: number; mine: number }> =
    Object.create(null);
  for (const vote of votes) {
    const total = (sums[vote.restaurantId] ??= { sum: 0, count: 0, mine: 0 });
    total.sum += vote.score;
    total.count++;
    if (vote.userId === user) total.mine = vote.score;
  }
  return Object.fromEntries(
    Object.entries(sums).map(([id, value]) => [
      id,
      {
        average: value.sum / value.count,
        count: value.count,
        mine: value.mine,
      },
    ]),
  );
}

export async function ratingSnapshot(userId: string | null): Promise<Ratings> {
  return summarize(await readVotes(), validateUser(userId));
}

export async function setRating(
  userId: string | null,
  value: unknown,
): Promise<Ratings> {
  const user = validateUser(userId);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LunchError("별점을 확인해 주세요.");
  const { restaurantId, score } = value as Record<string, unknown>;
  if (
    typeof restaurantId !== "string" ||
    !restaurantId ||
    !Number.isInteger(score) ||
    (score as number) < 0 ||
    (score as number) > 5
  )
    throw new LunchError("별점은 0~5점으로 선택해 주세요.");
  await mkdir(dirname(file), { recursive: true });
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() >= deadline)
        throw new LunchError("별점 저장 중이에요. 다시 시도해 주세요.", 503);
      await new Promise((done) => setTimeout(done, 30));
    }
  }
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    if (
      !(await snapshot()).restaurants.some((item) => item.id === restaurantId)
    )
      throw new LunchError("식당을 찾을 수 없어요.", 404);
    const votes = (await readVotes()).filter(
      (vote) => vote.restaurantId !== restaurantId || vote.userId !== user,
    );
    if (score !== 0)
      votes.push({ restaurantId, userId: user, score: score as number });
    await writeFile(temp, `${JSON.stringify(votes, null, 2)}\n`, "utf8");
    await rename(temp, file);
    return summarize(votes, user);
  } finally {
    try {
      await unlink(temp).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    } finally {
      await rmdir(lock);
    }
  }
}
