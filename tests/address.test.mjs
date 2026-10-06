import assert from "node:assert/strict";
import test from "node:test";
import { resolveAddress } from "../src/lib/address-server.ts";
import {
  OFFICE,
  metersFromOffice,
  distanceGroup,
} from "../src/lib/restaurant-location.ts";
import { parseRestaurant } from "../src/lib/lunch.ts";

const document = {
  address_type: "ROAD_ADDR",
  x: String(OFFICE.longitude),
  y: String(OFFICE.latitude),
  road_address: { address_name: OFFICE.address, main_building_no: "12" },
};
const response = (documents = [document], total = documents.length) =>
  Response.json({ documents, meta: { total_count: total } });

test("address lookup uses the server key, exact matching, and office coordinates", async () => {
  const found = await resolveAddress(
    { address: ` ${OFFICE.address} ` },
    async (url, options) => {
      const request = new URL(url);
      assert.equal(request.origin, "https://dapi.kakao.com");
      assert.equal(request.searchParams.get("query"), OFFICE.address);
      assert.equal(request.searchParams.get("analyze_type"), "exact");
      assert.equal(options.headers.Authorization, "KakaoAK server-test-key");
      assert.equal(url.includes("server-test-key"), false);
      return response();
    },
    "server-test-key",
  );
  assert.deepEqual(found, {
    address: OFFICE.address,
    latitude: OFFICE.latitude,
    longitude: OFFICE.longitude,
    distanceMeters: 0,
    distance: "가까움",
  });
  assert.equal(
    metersFromOffice(OFFICE.latitude + 0.01, OFFICE.longitude),
    1112,
  );
  assert.deepEqual([0, 250, 251, 500, 501, 750, 751].map(distanceGroup), [
    "가까움",
    "가까움",
    "중간",
    "중간",
    "멂",
    "멂",
    "매우 멂",
  ]);
});

test("invalid, ambiguous and unavailable addresses cannot be silently registered", async () => {
  for (const value of [
    null,
    [],
    {},
    { address: " " },
    { address: "x".repeat(201) },
  ])
    await assert.rejects(
      resolveAddress(
        value,
        () => {
          throw new Error("Must not call provider");
        },
        "key",
      ),
      (error) => error.status === 400,
    );
  const input = { address: OFFICE.address };
  await assert.rejects(
    resolveAddress(input, () => response(), ""),
    (error) => error.status === 503,
  );
  await assert.rejects(
    resolveAddress(input, () => response([]), "key"),
    (error) => error.status === 404,
  );
  await assert.rejects(
    resolveAddress(input, () => response([document, document]), "key"),
    /정확한 주소/,
  );
  for (const address_type of ["REGION", "ROAD", undefined])
    await assert.rejects(
      resolveAddress(
        input,
        () => response([{ ...document, address_type }]),
        "key",
      ),
      /정확한 주소/,
    );
  await assert.rejects(
    resolveAddress(
      input,
      () =>
        response([
          { ...document, road_address: { address_name: OFFICE.address } },
        ]),
      "key",
    ),
    /정확한 주소/,
  );
  const lotAddress = await resolveAddress(
    input,
    () =>
      response([
        {
          ...document,
          address_type: "REGION_ADDR",
          road_address: null,
          address: {
            address_name: "서울 영등포구 당산동6가 331-1",
            main_address_no: "331",
          },
        },
      ]),
    "key",
  );
  assert.equal(lotAddress.address, "서울 영등포구 당산동6가 331-1");
  for (const doc of [
    { ...document, x: "" },
    { ...document, y: "NaN" },
    { ...document, y: "91" },
  ])
    await assert.rejects(
      resolveAddress(input, () => response([doc]), "key"),
      (error) => error.status === 502,
    );
  for (const status of [401, 429, 500])
    await assert.rejects(
      resolveAddress(
        input,
        async () => new Response("secret upstream details", { status }),
        "key",
      ),
      (error) => error.status === 503 && !error.message.includes("secret"),
    );
  await assert.rejects(
    resolveAddress(
      input,
      async () => {
        throw new Error("secret timeout");
      },
      "key",
    ),
    (error) => error.status === 503 && !error.message.includes("secret"),
  );
});

test("location validation recalculates supplied distance and rejects incomplete coordinates", () => {
  const input = {
    name: "주소 테스트",
    category: "한식",
    note: "",
    closedDays: [],
    address: OFFICE.address,
    latitude: OFFICE.latitude,
    longitude: OFFICE.longitude,
    distance: "멂",
    distanceMeters: 9999,
  };
  const value = parseRestaurant(input);
  assert.equal(value.distanceMeters, 0);
  assert.equal(value.distance, "가까움");
  for (const patch of [
    { latitude: null },
    { longitude: Infinity },
    { address: "" },
    { address: undefined },
    { latitude: "37.5" },
  ])
    assert.throws(() => parseRestaurant({ ...input, ...patch }));
  assert.equal(
    parseRestaurant({
      ...input,
      address: "",
      latitude: null,
      longitude: null,
      distanceMeters: null,
    }).distanceMeters,
    null,
  );
});
