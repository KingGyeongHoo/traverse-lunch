import { LunchError } from "./lunch.ts";
import type { NearbyPlace, NearbyResult, PlaceType } from "./nearby.ts";

export async function searchNearby(
  value: unknown,
  fetcher: typeof fetch = fetch,
  key = process.env.KAKAO_REST_API_KEY,
): Promise<NearbyResult> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LunchError("검색 조건을 확인해 주세요.");
  const { latitude, longitude, radius, type } = value as Record<
    string,
    unknown
  >;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw new LunchError("현재 위치를 확인해 주세요.");
  if (
    !Number.isInteger(radius) ||
    (radius as number) < 1 ||
    (radius as number) > 20000
  )
    throw new LunchError("거리는 1~20,000m로 입력해 주세요.");
  if (type !== "restaurant" && type !== "cafe")
    throw new LunchError("음식점 또는 카페를 선택해 주세요.");
  if (!key) throw new LunchError("주변 장소 검색 설정이 필요합니다.", 503);
  const places = new Map<string, NearbyPlace>();
  let total = 0;
  let pageable = 0;
  for (let page = 1; page <= 3; page++) {
    const params = new URLSearchParams({
      category_group_code: (type as PlaceType) === "restaurant" ? "FD6" : "CE7",
      x: String(longitude),
      y: String(latitude),
      radius: String(radius),
      sort: "distance",
      page: String(page),
      size: "15",
    });
    let response: Response;
    try {
      response = await fetcher(
        `https://dapi.kakao.com/v2/local/search/category.json?${params}`,
        {
          headers: { Authorization: `KakaoAK ${key}` },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch {
      throw new LunchError(
        "주변 장소 검색에 연결하지 못했습니다. 다시 시도해 주세요.",
        503,
      );
    }
    if (!response.ok)
      throw new LunchError(
        response.status === 429
          ? "검색 요청이 많습니다. 잠시 후 다시 시도해 주세요."
          : "주변 장소를 검색하지 못했습니다. 다시 시도해 주세요.",
        503,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new LunchError("검색 결과를 확인하지 못했습니다.", 502);
    }
    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray((body as { documents?: unknown }).documents)
    )
      throw new LunchError("검색 결과를 확인하지 못했습니다.", 502);
    const result = body as {
      meta?: {
        total_count?: unknown;
        pageable_count?: unknown;
        is_end?: unknown;
      };
      documents: unknown[];
    };
    if (
      !Number.isSafeInteger(result.meta?.total_count) ||
      (result.meta!.total_count as number) < 0 ||
      !Number.isSafeInteger(result.meta?.pageable_count) ||
      (result.meta!.pageable_count as number) < 0 ||
      typeof result.meta?.is_end !== "boolean"
    )
      throw new LunchError("검색 결과를 확인하지 못했습니다.", 502);
    total = result.meta.total_count as number;
    pageable = result.meta.pageable_count as number;
    for (const entry of result.documents) {
      if (!entry || typeof entry !== "object")
        throw new LunchError("검색 결과를 확인하지 못했습니다.", 502);
      const item = entry as Record<string, unknown>;
      const meters =
        typeof item.distance === "string" && item.distance.trim()
          ? Number(item.distance)
          : NaN;
      if (
        typeof item.id !== "string" ||
        !/^\d+$/.test(item.id) ||
        typeof item.place_name !== "string" ||
        !item.place_name.trim() ||
        typeof item.category_name !== "string" ||
        !Number.isFinite(meters) ||
        meters < 0
      )
        throw new LunchError("검색 결과를 확인하지 못했습니다.", 502);
      places.set(item.id, {
        id: item.id,
        name: item.place_name,
        category: item.category_name,
        address:
          typeof item.road_address_name === "string" && item.road_address_name
            ? item.road_address_name
            : typeof item.address_name === "string"
              ? item.address_name
              : "",
        phone: typeof item.phone === "string" ? item.phone : "",
        distance: meters,
        url: `https://place.map.kakao.com/${item.id}`,
      });
    }
    if (result.meta.is_end || places.size >= pageable) break;
  }
  return {
    places: [...places.values()].sort((a, b) => a.distance - b.distance),
    total,
    truncated: total > pageable || total > places.size,
  };
}
