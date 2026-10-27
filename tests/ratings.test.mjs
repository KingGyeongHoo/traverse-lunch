import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("별점은 사용자별로 저장하고 점수를 준 사람만 평균에 포함한다", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lunch-ratings-test-"));
  const file = path.join(directory, "restaurants.json");
  const oldFile = process.env.LUNCH_DATA_FILE;
  process.env.LUNCH_DATA_FILE = file;
  try {
    await writeFile(
      file,
      JSON.stringify([
        {
          id: "restaurant",
          name: "식당",
          category: "한식",
          note: "",
          closedDays: [],
          excludedDate: null,
        },
      ]),
    );
    const { ratingSnapshot, setRating } =
      await import("../src/lib/rating-store.ts");
    const first = randomUUID();
    const second = randomUUID();
    assert.deepEqual(await ratingSnapshot(first), {});
    await Promise.all([
      setRating(first, { restaurantId: "restaurant", score: 5 }),
      setRating(second, { restaurantId: "restaurant", score: 2 }),
    ]);
    assert.deepEqual((await ratingSnapshot(first)).restaurant, {
      average: 3.5,
      count: 2,
      mine: 5,
    });
    assert.deepEqual((await ratingSnapshot(second)).restaurant, {
      average: 3.5,
      count: 2,
      mine: 2,
    });
    await setRating(first, { restaurantId: "restaurant", score: 3 });
    assert.deepEqual((await ratingSnapshot(first)).restaurant, {
      average: 2.5,
      count: 2,
      mine: 3,
    });
    await setRating(first, { restaurantId: "restaurant", score: 0 });
    assert.deepEqual((await ratingSnapshot(first)).restaurant, {
      average: 2,
      count: 1,
      mine: 0,
    });
    await assert.rejects(() =>
      setRating(first, { restaurantId: "restaurant", score: 6 }),
    );
    await assert.rejects(() =>
      setRating(first, { restaurantId: "missing", score: 5 }),
    );
    await writeFile(`${file}.ratings`, "{broken", "utf8");
    await assert.rejects(() =>
      setRating(first, { restaurantId: "restaurant", score: 5 }),
    );
    assert.equal(await readFile(`${file}.ratings`, "utf8"), "{broken");
  } finally {
    if (oldFile === undefined) delete process.env.LUNCH_DATA_FILE;
    else process.env.LUNCH_DATA_FILE = oldFile;
    await rm(directory, { recursive: true, force: true });
  }
});
