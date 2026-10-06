import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSnapshot } from "../src/lib/api.ts";
import { readFile } from "node:fs/promises";

const restaurant = {
  id: "one",
  name: "국밥",
  category: "한식",
  distance: "가까움",
  note: "",
  closedDays: [],
  excludedDate: null,
};
const snapshot = { restaurants: [restaurant], today: "2026-09-28", weekday: 1 };
test("invalid responses and duplicate restaurant IDs are rejected before replacing shared data", () => {
  assert.deepEqual(parseSnapshot(snapshot), snapshot);
  for (const value of [
    {},
    { ...snapshot, weekday: 7 },
    { ...snapshot, restaurants: [restaurant, restaurant] },
    { ...snapshot, restaurants: [{ ...restaurant, name: "" }] },
  ])
    assert.throws(() => parseSnapshot(value));
});
test("mobile domain stays aligned with the server", async () => {
  const [server, mobile] = await Promise.all([
    readFile(new URL("../../src/lib/lunch.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/domain.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(mobile.slice(mobile.indexOf("\n") + 1), server);
});
