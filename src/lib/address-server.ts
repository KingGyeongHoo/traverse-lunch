import { LunchError } from "./lunch.ts";
import {
  distanceGroup,
  metersFromOffice,
  type RestaurantLocation,
} from "./restaurant-location.ts";

const EXACT_ADDRESS_MESSAGE =
  "도로명과 건물번호를 포함한 정확한 주소를 입력해 주세요.";

// Kakao REST credentials are used only by the server route.
export async function resolveAddress(
  value: unknown,
  fetcher: typeof fetch = fetch,
  key = process.env.KAKAO_REST_API_KEY,
): Promise<RestaurantLocation> {
  const address =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>).address
      : undefined;
  if (
    typeof address !== "string" ||
    address.trim().length < 5 ||
    address.trim().length > 200
  )
    throw new LunchError(EXACT_ADDRESS_MESSAGE);
  if (!key) throw new LunchError("주소 조회 설정이 필요합니다.", 503);
  let response: Response;
  try {
    response = await fetcher(
      `https://dapi.kakao.com/v2/local/search/address.json?${new URLSearchParams({ query: address.trim(), analyze_type: "exact", size: "2" })}`,
      {
        headers: { Authorization: `KakaoAK ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch {
    throw new LunchError(
      "주소 조회에 연결하지 못했습니다. 다시 시도해 주세요.",
      503,
    );
  }
  if (!response.ok)
    throw new LunchError(
      response.status === 429
        ? "주소 조회가 몰리고 있습니다. 잠시 후 다시 시도해 주세요."
        : "주소를 조회하지 못했습니다. 다시 시도해 주세요.",
      503,
    );
  let body;
  try {
    body = await response.json();
  } catch {
    throw new LunchError("주소 조회 결과를 확인하지 못했습니다.", 502);
  }
  if (
    !Array.isArray(body?.documents) ||
    !Number.isInteger(body?.meta?.total_count)
  )
    throw new LunchError("주소 조회 결과를 확인하지 못했습니다.", 502);
  if (!body.documents.length) throw new LunchError(EXACT_ADDRESS_MESSAGE, 404);
  if (body.meta.total_count !== 1 || body.documents.length !== 1)
    throw new LunchError(EXACT_ADDRESS_MESSAGE);
  const doc = body.documents[0];
  if (
    !["ROAD_ADDR", "REGION_ADDR"].includes(doc?.address_type) ||
    !(doc?.road_address?.main_building_no || doc?.address?.main_address_no)
  )
    throw new LunchError(EXACT_ADDRESS_MESSAGE);
  const canonical =
    doc?.road_address?.address_name ||
    doc?.address?.address_name ||
    doc?.address_name;
  const latitude =
    typeof doc?.y === "string" && doc.y.trim() ? Number(doc.y) : NaN;
  const longitude =
    typeof doc?.x === "string" && doc.x.trim() ? Number(doc.x) : NaN;
  if (
    typeof canonical !== "string" ||
    !canonical.trim() ||
    canonical.length > 200 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    throw new LunchError(EXACT_ADDRESS_MESSAGE, 502);
  const distanceMeters = metersFromOffice(latitude, longitude);
  return {
    address: canonical.trim(),
    latitude,
    longitude,
    distanceMeters,
    distance: distanceGroup(distanceMeters),
  };
}
