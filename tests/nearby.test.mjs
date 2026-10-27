import assert from "node:assert/strict";
import test from "node:test";
import { searchNearby } from "../src/lib/nearby-server.ts";
import { foodCategory } from "../src/lib/nearby.ts";

const input = {
  latitude: 37.5,
  longitude: 127,
  radius: 200,
  type: "restaurant",
};
const doc = (id, distance, category = "음식점 > 한식 > 국밥") => ({
  id: String(id),
  place_name: `식당 ${id}`,
  category_name: category,
  distance: String(distance),
  road_address_name: "서울 영등포구 양평로 12",
  address_name: "",
  phone: "",
});

test("거리순 검색의 모든 페이지를 합치고 제공 범위 초과를 알린다", async () => {
  const calls = [];
  const result = await searchNearby(
    input,
    async (url, options) => {
      const request = new URL(url);
      calls.push(request);
      assert.equal(request.searchParams.get("category_group_code"), "FD6");
      assert.equal(request.searchParams.get("radius"), "200");
      assert.equal(request.searchParams.get("sort"), "distance");
      assert.equal(options.headers.Authorization, "KakaoAK test-key");
      assert.equal(url.includes("test-key"), false);
      const page = Number(request.searchParams.get("page"));
      const documents = Array.from({ length: 15 }, (_, index) =>
        doc((page - 1) * 15 + index + 1, (page - 1) * 15 + index),
      );
      return Response.json({
        meta: { total_count: 80, pageable_count: 45, is_end: page === 3 },
        documents,
      });
    },
    "test-key",
  );
  assert.equal(calls.length, 3);
  assert.equal(result.places.length, 45);
  assert.equal(result.places[0].distance, 0);
  assert.equal(result.places[44].distance, 44);
  assert.equal(result.truncated, true);
  assert.equal(result.places[0].url, "https://place.map.kakao.com/1");
});

test("카페 분류와 메뉴 다중 선택을 위한 음식 분류를 구분한다", async () => {
  const found = await searchNearby(
    { ...input, type: "cafe" },
    async (url) => {
      assert.equal(new URL(url).searchParams.get("category_group_code"), "CE7");
      return Response.json({
        meta: { total_count: 1, pageable_count: 1, is_end: true },
        documents: [doc(1, 50, "음식점 > 카페")],
      });
    },
    "key",
  );
  assert.equal(found.places.length, 1);
  assert.equal(found.truncated, false);
  assert.deepEqual(
    [
      "음식점 > 한식 > 국밥",
      "음식점 > 중식",
      "음식점 > 일식",
      "음식점 > 양식",
      "음식점 > 한식 > 분식",
      "음식점 > 패스트푸드",
    ].map(foodCategory),
    ["한식", "중식", "일식", "양식", "분식", "기타"],
  );
});

test("잘못된 입력과 검색 실패를 처리하고 일부 결과를 성공으로 반환하지 않는다", async () => {
  for (const value of [
    null,
    { ...input, radius: 0 },
    { ...input, radius: 20001 },
    { ...input, latitude: 91 },
    { ...input, type: "bad" },
  ])
    await assert.rejects(
      searchNearby(
        value,
        () => {
          throw new Error("unexpected fetch");
        },
        "key",
      ),
      (error) => error.status === 400,
    );
  await assert.rejects(
    searchNearby(
      input,
      () => {
        throw new Error("unexpected fetch");
      },
      "",
    ),
    (error) => error.status === 503,
  );
  let page = 0;
  await assert.rejects(
    searchNearby(
      input,
      async () => {
        page++;
        return page === 1
          ? Response.json({
              meta: { total_count: 20, pageable_count: 20, is_end: false },
              documents: [doc(1, 1)],
            })
          : new Response("error", { status: 500 });
      },
      "key",
    ),
    (error) => error.status === 503,
  );
  await assert.rejects(
    searchNearby(
      input,
      async () =>
        Response.json({
          meta: { total_count: 1, pageable_count: 1, is_end: true },
          documents: [doc("bad/id", 2)],
        }),
      "key",
    ),
    (error) => error.status === 502,
  );
});
