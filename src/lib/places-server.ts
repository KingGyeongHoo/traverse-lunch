import type { NearbyPlace, NearbyResult, SearchLocation } from "./places";

export class PlacesError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type KakaoDocument = Record<string, unknown>;
type KakaoResult = {
  documents: KakaoDocument[];
  meta: { total_count: number; pageable_count: number; is_end: boolean };
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PlacesError("검색 조건을 확인해 주세요.");
  return value as Record<string, unknown>;
}

export function parseNearbyQuery(value: unknown) {
  const { lat, lng, radius, page = 1 } = object(value);
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  )
    throw new PlacesError("검색할 위치를 선택해 주세요.");
  if (typeof radius !== "number" || ![300, 500, 1000, 2000].includes(radius))
    throw new PlacesError("검색 반경을 확인해 주세요.");
  if (
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 3
  )
    throw new PlacesError("검색 페이지를 확인해 주세요.");
  return { lat, lng, radius, page };
}

export function parseLocationQuery(value: unknown) {
  const { query } = object(value);
  if (
    typeof query !== "string" ||
    query.trim().length < 2 ||
    query.trim().length > 100
  )
    throw new PlacesError("주소 또는 장소 이름을 2~100자로 입력해 주세요.");
  return query.trim();
}

async function kakao(
  endpoint: "category" | "address" | "keyword",
  params: Record<string, string>,
  fetcher: typeof fetch,
  key: string | undefined,
): Promise<KakaoResult> {
  if (!key?.trim())
    throw new PlacesError(
      "주변 검색 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.",
      503,
    );
  let response: Response;
  try {
    response = await fetcher(
      `https://dapi.kakao.com/v2/local/search/${endpoint}.json?${new URLSearchParams(params)}`,
      {
        headers: { Authorization: `KakaoAK ${key.trim()}` },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      },
    );
  } catch {
    throw new PlacesError(
      "지도 서비스에 연결하지 못했어요. 다시 시도해 주세요.",
      502,
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new PlacesError("지도 서비스 연결 설정을 확인해 주세요.", 503);
  if (response.status === 429)
    throw new PlacesError(
      "검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      429,
    );
  if (!response.ok)
    throw new PlacesError(
      "주변 검색을 완료하지 못했어요. 다시 시도해 주세요.",
      502,
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new PlacesError("검색 결과를 읽지 못했어요.", 502);
  }
  if (
    !Array.isArray(data?.documents) ||
    !data.meta ||
    typeof data.meta.total_count !== "number" ||
    typeof data.meta.pageable_count !== "number" ||
    typeof data.meta.is_end !== "boolean"
  )
    throw new PlacesError("검색 결과를 읽지 못했어요.", 502);
  return data;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
function coordinate(value: unknown, limit: number) {
  const parsed =
    typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit)
    throw new PlacesError("장소의 위치 정보를 읽지 못했어요.", 502);
  return parsed;
}

export async function searchNearby(
  value: unknown,
  fetcher: typeof fetch = fetch,
  key = process.env.KAKAO_REST_API_KEY,
): Promise<NearbyResult> {
  const { lat, lng, radius, page } = parseNearbyQuery(value);
  const data = await kakao(
    "category",
    {
      category_group_code: "FD6",
      x: String(lng),
      y: String(lat),
      radius: String(radius),
      page: String(page),
      size: "15",
      sort: "distance",
    },
    fetcher,
    key,
  );
  const places = data.documents.map((doc): NearbyPlace => {
    const id = text(doc.id);
    const name = text(doc.place_name);
    const distance = text(doc.distance).trim() ? Number(doc.distance) : NaN;
    if (
      !/^\d+$/.test(id) ||
      !name ||
      !Number.isFinite(distance) ||
      distance < 0
    )
      throw new PlacesError("식당 정보를 읽지 못했어요.", 502);
    return {
      id,
      name,
      distance,
      category: text(doc.category_name),
      address: text(doc.road_address_name) || text(doc.address_name),
      phone: text(doc.phone),
      lat: coordinate(doc.y, 90),
      lng: coordinate(doc.x, 180),
      url: `https://place.map.kakao.com/${id}`,
    };
  });
  return {
    places,
    total: data.meta.total_count,
    available: Math.min(data.meta.pageable_count, 45),
    hasMore:
      !data.meta.is_end && page < 3 && page * 15 < data.meta.pageable_count,
    page,
  };
}

export async function searchLocations(
  value: unknown,
  fetcher: typeof fetch = fetch,
  key = process.env.KAKAO_REST_API_KEY,
): Promise<SearchLocation[]> {
  const query = parseLocationQuery(value);
  const addresses = await kakao("address", { query, size: "5" }, fetcher, key);
  if (addresses.documents.length)
    return addresses.documents.map((doc) => ({
      name: text(doc.address_name),
      address: text(doc.address_name),
      lat: coordinate(doc.y, 90),
      lng: coordinate(doc.x, 180),
    }));
  const places = await kakao("keyword", { query, size: "5" }, fetcher, key);
  return places.documents.map((doc) => ({
    name: text(doc.place_name),
    address: text(doc.road_address_name) || text(doc.address_name),
    lat: coordinate(doc.y, 90),
    lng: coordinate(doc.x, 180),
  }));
}
