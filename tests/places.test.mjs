import assert from "node:assert/strict";
import test from "node:test";
import {
  parseNearbyQuery,
  parseLocationQuery,
  searchNearby,
  searchLocations,
} from "../src/lib/places-server.ts";
import { containsPlace, placeInput } from "../src/lib/places.ts";

const query = { lat: 37.5, lng: 127, radius: 500 };
const document = {
  id: "123",
  place_name: "테스트 식당",
  category_name: "음식점 > 한식",
  x: "127.001",
  y: "37.501",
  distance: "123",
  road_address_name: "서울 테스트로 1",
  phone: "02-123-4567",
  place_url: "javascript:alert(1)",
};
const response = (documents = [document], meta = {}) =>
  Response.json({
    documents,
    meta: { total_count: 80, pageable_count: 45, is_end: false, ...meta },
  });

test("nearby input rejects invalid coordinates, radius and page before calling the provider", async () => {
  for (const input of [
    null,
    [],
    {},
    { ...query, lat: NaN },
    { ...query, lng: 181 },
    { ...query, lat: "37.5" },
    { ...query, radius: 20001 },
    { ...query, page: 4 },
    { ...query, page: 1.5 },
  ]) {
    assert.throws(() => parseNearbyQuery(input));
    await assert.rejects(
      searchNearby(input, () => assert.fail("must not fetch"), "test-key"),
    );
  }
  assert.deepEqual(parseNearbyQuery(query), { ...query, page: 1 });
  assert.equal(parseLocationQuery({ query: " 서울역 " }), "서울역");
  for (const query of [null, " ", "가", "x".repeat(101)])
    assert.throws(() => parseLocationQuery({ query }));
});

test("nearby request keeps key in the server header, uses x=longitude and caps paging at 45", async () => {
  const fake = async (url, options) => {
    const request = new URL(url);
    assert.equal(request.origin, "https://dapi.kakao.com");
    assert.equal(request.searchParams.get("x"), "127");
    assert.equal(request.searchParams.get("y"), "37.5");
    assert.equal(request.searchParams.get("category_group_code"), "FD6");
    assert.equal(request.searchParams.get("sort"), "distance");
    assert.equal(request.searchParams.get("size"), "15");
    assert.equal(request.searchParams.get("radius"), "500");
    assert.equal(options.headers.Authorization, "KakaoAK private-test-key");
    assert.equal(options.cache, "no-store");
    assert.ok(!url.includes("private-test-key"));
    return response();
  };
  const first = await searchNearby(query, fake, "private-test-key");
  assert.equal(first.places[0].url, "https://place.map.kakao.com/123");
  assert.equal(first.places[0].distance, 123);
  assert.equal(first.hasMore, true);
  assert.equal(first.available, 45);
  assert.equal(
    (await searchNearby({ ...query, page: 3 }, fake, "private-test-key"))
      .hasMore,
    false,
  );
  assert.equal(
    (
      await searchNearby(
        query,
        async () =>
          response([], { is_end: true, pageable_count: 0, total_count: 0 }),
        "key",
      )
    ).hasMore,
    false,
  );
});

test("provider failures are sanitized and invalid data is rejected", async () => {
  for (const [status, expected] of [
    [401, 503],
    [403, 503],
    [429, 429],
    [500, 502],
  ]) {
    await assert.rejects(
      searchNearby(
        query,
        async () => new Response("private-test-key", { status }),
        "private-test-key",
      ),
      (error) =>
        error.status === expected &&
        !error.message.includes("private-test-key"),
    );
  }
  await assert.rejects(
    searchNearby(query, () => assert.fail("must not fetch"), ""),
    { status: 503 },
  );
  await assert.rejects(
    searchNearby(
      query,
      async () => {
        throw new Error("private-test-key");
      },
      "key",
    ),
    { status: 502 },
  );
  for (const invalid of [
    { ...document, x: "" },
    { ...document, distance: "NaN" },
    { ...document, id: "../bad" },
  ]) {
    await assert.rejects(
      searchNearby(query, async () => response([invalid]), "key"),
      { status: 502 },
    );
  }
  await assert.rejects(
    searchNearby(query, async () => Response.json({ documents: [] }), "key"),
    { status: 502 },
  );
});

test("location search prefers an address and falls back to a named place", async () => {
  const paths = [];
  const fake = async (url) => {
    paths.push(new URL(url).pathname);
    return url.includes("address.json") ? response([]) : response([document]);
  };
  const found = await searchLocations({ query: "서울역" }, fake, "key");
  assert.equal(found[0].name, document.place_name);
  assert.deepEqual(paths, [
    "/v2/local/search/address.json",
    "/v2/local/search/keyword.json",
  ]);
  const address = await searchLocations(
    { query: "서울 테스트로 1" },
    async (url) => {
      assert.ok(url.includes("address.json"));
      return response([
        { address_name: "서울 테스트로 1", x: "127", y: "37.5" },
      ]);
    },
    "key",
  );
  assert.equal(address[0].address, "서울 테스트로 1");
});

test("import preserves source, leaves team distance unset and matches full place IDs", () => {
  const input = placeInput({
    name: "식당",
    category: "음식점 > 한식",
    address: "서울",
    url: "https://place.map.kakao.com/123",
  });
  assert.equal(input.category, "한식");
  assert.equal(input.distance, null);
  assert.deepEqual(input.closedDays, []);
  assert.equal(
    containsPlace(input.note, "https://place.map.kakao.com/123"),
    true,
  );
  assert.equal(
    containsPlace(input.note, "https://place.map.kakao.com/12"),
    false,
  );
});
