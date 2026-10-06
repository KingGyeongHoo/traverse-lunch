import {
  mkdir,
  readFile,
  rename,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomInt, randomUUID } from "node:crypto";
import {
  availability,
  koreaToday,
  LunchError,
  parseRestaurant,
  matchesDistance,
  type DistanceFilter,
  type Restaurant,
} from "./lunch";

// Route Handlers only. Requires a persistent local filesystem.
const file = resolve(
  /* turbopackIgnore: true */ process.env.LUNCH_DATA_FILE ||
    "data/restaurants.json",
);
const lock = `${file}.lock`;

async function readRestaurants(): Promise<Restaurant[]> {
  let raw: string;
  try {
    raw = await readFile(/* turbopackIgnore: true */ file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  try {
    const data: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (!Array.isArray(data)) throw new Error("Expected an array");
    const ids = new Set<string>();
    return data.map((item) => {
      const input = parseRestaurant(item);
      if (typeof item.id !== "string" || !item.id || ids.has(item.id))
        throw new Error("Invalid ID");
      if (
        item.excludedDate !== null &&
        (typeof item.excludedDate !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(item.excludedDate))
      )
        throw new Error("Invalid exclusion date");
      ids.add(item.id);
      return { ...input, id: item.id, excludedDate: item.excludedDate };
    });
  } catch {
    throw new LunchError(
      "저장된 식당 파일 형식을 확인해 주세요. 기존 데이터는 변경하지 않았어요.",
      500,
    );
  }
}

async function changeStore(
  change: (items: Restaurant[]) => Restaurant[] | Promise<Restaurant[]>,
) {
  await mkdir(dirname(file), { recursive: true });
  const deadline = Date.now() + 5000;
  while (true) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() >= deadline)
        throw new LunchError(
          "다른 변경을 저장 중이에요. 잠시 후 다시 시도해 주세요.",
          503,
        );
      await new Promise((done) => setTimeout(done, 30));
    }
  }
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const restaurants = await change(await readRestaurants());
    await writeFile(temp, `${JSON.stringify(restaurants, null, 2)}\n`, "utf8");
    await rename(temp, file);
    return { restaurants, ...koreaToday() };
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

export async function snapshot() {
  return { restaurants: await readRestaurants(), ...koreaToday() };
}

export async function addRestaurant(value: unknown) {
  const input = parseRestaurant(value);
  return changeStore((items) => [
    ...items,
    { ...input, id: randomUUID(), excludedDate: null },
  ]);
}

export async function updateRestaurant(id: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LunchError("수정할 정보를 확인해 주세요.");
  const body = value as Record<string, unknown>;
  const exclusion = Object.hasOwn(body, "excludedToday");
  if (
    exclusion &&
    (typeof body.excludedToday !== "boolean" || Object.keys(body).length !== 1)
  )
    throw new LunchError("오늘 제외 여부는 true 또는 false로 보내 주세요.");
  const input = exclusion ? null : parseRestaurant(value);
  return changeStore((items) => {
    if (!items.some((item) => item.id === id))
      throw new LunchError(
        "이미 삭제된 식당이에요. 목록을 새로고침해 주세요.",
        404,
      );
    return items.map((item) =>
      item.id !== id
        ? item
        : exclusion
          ? {
              ...item,
              excludedDate: body.excludedToday ? koreaToday().today : null,
            }
          : {
              ...item,
              ...input,
              distance:
                body.distance === undefined ? item.distance : input!.distance,
            },
    );
  });
}

export async function deleteRestaurant(id: string) {
  return changeStore((items) => {
    if (!items.some((item) => item.id === id))
      throw new LunchError("이미 삭제된 식당이에요.", 404);
    return items.filter((item) => item.id !== id);
  });
}

export async function pickRestaurant(distance: DistanceFilter = "all") {
  const data = await snapshot();
  const candidates = data.restaurants.filter(
    (item) =>
      availability(item, data.today, data.weekday) === "available" &&
      matchesDistance(item, distance),
  );
  if (!candidates.length)
    throw new LunchError(
      distance === "all" || distance === "멂"
        ? "오늘 뽑을 수 있는 식당이 없어요. 휴무와 제외 설정을 확인해 주세요."
        : `‘${distance}’까지 오늘 뽑을 수 있는 식당이 없어요. 거리를 늘리거나 휴무·제외 설정을 확인해 주세요.`,
      409,
    );
  return { ...data, picked: candidates[randomInt(candidates.length)] };
}
