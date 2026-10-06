import assert from "node:assert/strict";
import test from "node:test";
import {
  availability,
  koreaToday,
  parseRestaurant,
  matchesDistance,
  parsePickDistance,
  DISTANCES,
} from "../src/lib/lunch.ts";

test("Korean midnight changes both the date and weekday", () => {
  assert.deepEqual(koreaToday(new Date("2026-09-14T14:59:59Z")), {
    today: "2026-09-14",
    weekday: 1,
  });
  assert.deepEqual(koreaToday(new Date("2026-09-14T15:00:00Z")), {
    today: "2026-09-15",
    weekday: 2,
  });
  assert.deepEqual(koreaToday(new Date("2026-12-31T15:00:00Z")), {
    today: "2027-01-01",
    weekday: 5,
  });
});

test("weekly closure is enforced and today's exclusion expires next day", () => {
  const restaurant = { closedDays: [1], excludedDate: "2026-09-15" };
  assert.equal(availability(restaurant, "2026-09-14", 1), "closed");
  assert.equal(availability(restaurant, "2026-09-15", 2), "excluded");
  assert.equal(availability(restaurant, "2026-09-16", 3), "available");
  assert.equal(
    availability({ ...restaurant, excludedDate: null }, "2026-09-15", 2),
    "available",
  );
});

test("restaurant validation rejects malformed fields and normalizes input", () => {
  const input = {
    name: "  국밥  ",
    category: "한식",
    note: "  점심 메뉴  ",
    closedDays: [6, 1, 1],
  };
  assert.deepEqual(parseRestaurant(input), {
    name: "국밥",
    category: "한식",
    note: "점심 메뉴",
    closedDays: [1, 6],
    distance: null,
  });
  for (const invalid of [
    null,
    [],
    {},
    { ...input, name: " " },
    { ...input, name: "가".repeat(51) },
    { ...input, note: "x".repeat(201) },
    { ...input, category: "unknown" },
    { ...input, closedDays: [7] },
    { ...input, closedDays: ["1"] },
    { ...input, closedDays: [1.5] },
    { ...input, distance: "아주 가까움" },
    { ...input, distance: 1 },
    { ...input, distance: ["가까움"] },
  ]) {
    assert.throws(() => parseRestaurant(invalid));
  }
});

test("distance slider sets a cumulative maximum and far includes legacy restaurants", () => {
  for (const distance of DISTANCES) {
    const input = {
      name: "식당",
      category: "한식",
      note: "",
      closedDays: [],
      distance,
    };
    assert.equal(parseRestaurant(input).distance, distance);
    assert.equal(parsePickDistance({ distance }), distance);
    assert.equal(matchesDistance(input, distance), true);
    assert.equal(matchesDistance(input, "all"), true);
    for (const limit of DISTANCES) {
      assert.equal(
        matchesDistance(input, limit),
        DISTANCES.indexOf(distance) <= DISTANCES.indexOf(limit),
      );
    }
    assert.equal(
      matchesDistance({ distance: null }, distance),
      distance === "멂",
    );
    assert.equal(matchesDistance({}, distance), distance === "멂");
  }
  assert.equal(matchesDistance({ distance: null }, "all"), true);
  assert.equal(parsePickDistance({}), "all");
  assert.equal(parsePickDistance({ distance: "all" }), "all");
  for (const value of [
    null,
    [],
    { distance: "" },
    { distance: null },
    { distance: 5 },
    { distance: ["가까움"] },
  ]) {
    assert.throws(() => parsePickDistance(value));
  }
});
