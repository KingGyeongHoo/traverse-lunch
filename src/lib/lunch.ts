import { distanceGroup, metersFromOffice } from "./restaurant-location.ts";

export const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const CATEGORIES = [
  "한식",
  "중식",
  "일식",
  "양식",
  "분식",
  "기타",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const DISTANCES = ["가까움", "중간", "멂", "매우 멂"] as const;
export type Distance = (typeof DISTANCES)[number];
export type DistanceFilter = Distance | "all";
export type Restaurant = {
  id: string;
  name: string;
  category: Category;
  distance: Distance | null;
  note: string;
  closedDays: number[];
  excludedDate: string | null;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceMeters?: number | null;
};
export type RestaurantInput = Pick<
  Restaurant,
  | "name"
  | "category"
  | "distance"
  | "note"
  | "closedDays"
  | "address"
  | "latitude"
  | "longitude"
  | "distanceMeters"
>;
export type LunchSnapshot = {
  restaurants: Restaurant[];
  today: string;
  weekday: number;
};

export class LunchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function koreaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return { today, weekday: new Date(`${today}T00:00:00Z`).getUTCDay() };
}

export function availability(
  restaurant: Restaurant,
  today: string,
  weekday: number,
) {
  if (restaurant.closedDays.includes(weekday)) return "closed";
  if (restaurant.excludedDate === today) return "excluded";
  return "available";
}

export function parseRestaurant(value: unknown): RestaurantInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LunchError("식당 정보를 확인해 주세요.");
  const { name, category, distance, note, closedDays } = value as Record<
    string,
    unknown
  >;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 50)
    throw new LunchError("이름은 1~50자로 입력해 주세요.");
  if (!CATEGORIES.includes(category as Category))
    throw new LunchError("음식 종류를 선택해 주세요.");
  if (
    distance !== undefined &&
    distance !== null &&
    !DISTANCES.includes(distance as Distance)
  )
    throw new LunchError(
      "거리는 가까움, 중간, 멂, 매우 멂 중에서 선택해 주세요.",
    );
  if (typeof note !== "string" || note.length > 200)
    throw new LunchError("메모는 200자 이내로 입력해 주세요.");
  if (
    !Array.isArray(closedDays) ||
    closedDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    throw new LunchError("휴무 요일을 확인해 주세요.");
  const location: Partial<RestaurantInput> = {};
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, "address")) {
    const address = record.address;
    const latitude = record.latitude ?? null;
    const longitude = record.longitude ?? null;
    if (typeof address !== "string" || address.length > 200)
      throw new LunchError("주소는 200자 이내로 입력해 주세요.");
    if (address.trim()) {
      if (
        typeof latitude !== "number" ||
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 90 ||
        typeof longitude !== "number" ||
        !Number.isFinite(longitude) ||
        Math.abs(longitude) > 180
      )
        throw new LunchError("주소를 확인한 뒤 저장해 주세요.");
      const meters = metersFromOffice(latitude, longitude);
      Object.assign(location, {
        address: address.trim(),
        latitude,
        longitude,
        distanceMeters: meters,
        distance: distanceGroup(meters),
      });
    } else {
      if (latitude !== null || longitude !== null)
        throw new LunchError("주소와 좌표를 함께 확인해 주세요.");
      Object.assign(location, { address: "", latitude: null, longitude: null });
    }
  } else if (record.latitude != null || record.longitude != null) {
    throw new LunchError("주소와 좌표를 함께 입력해 주세요.");
  }
  if (
    location.distanceMeters === undefined &&
    Object.hasOwn(record, "distanceMeters")
  ) {
    const meters = record.distanceMeters;
    if (
      meters !== null &&
      (!Number.isSafeInteger(meters) ||
        (meters as number) < 0 ||
        (meters as number) > 20015115)
    )
      throw new LunchError("거리 측정값을 확인해 주세요.");
    location.distanceMeters = meters as number | null;
    if (typeof meters === "number") location.distance = distanceGroup(meters);
  }
  return {
    name: name.trim(),
    category: category as Category,
    distance: (distance as Distance | null | undefined) ?? null,
    note: note.trim(),
    closedDays: [...new Set(closedDays)].sort(),
    ...location,
  };
}

export const DUPLICATE_RESTAURANT_MESSAGE =
  "같은 주소와 이름으로 등록된 식당이 있습니다. 기존 식당을 확인해 주세요.";

export function restaurantNameKey(name: string) {
  return name
    .replace(/\s+/g, "")
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function duplicateRestaurant(
  restaurants: Pick<Restaurant, "id" | "name" | "address">[],
  input: Pick<RestaurantInput, "name" | "address">,
  id?: string,
) {
  const key = restaurantNameKey(input.name);
  const addressKey = restaurantNameKey(input.address || "");
  return restaurants.find(
    (item) =>
      item.id !== id &&
      restaurantNameKey(item.name) === key &&
      restaurantNameKey(item.address || "") === addressKey,
  );
}

export function matchesDistance(
  restaurant: Pick<Restaurant, "distance">,
  filter: DistanceFilter,
) {
  if (filter === "all" || filter === "매우 멂") return true;
  if (!restaurant.distance) return false;
  return DISTANCES.indexOf(restaurant.distance) <= DISTANCES.indexOf(filter);
}

export function parsePickDistance(value: unknown): DistanceFilter {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LunchError("추천할 거리 조건을 확인해 주세요.");
  const { distance } = value as Record<string, unknown>;
  if (distance === undefined || distance === "all") return "all";
  if (!DISTANCES.includes(distance as Distance))
    throw new LunchError(
      "추천 거리는 가까움, 중간, 멂, 매우 멂 또는 all로 보내 주세요.",
    );
  return distance as Distance;
}
