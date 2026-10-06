import { parseRestaurant, type LunchSnapshot, type Restaurant } from "./lunch";

export function parseSnapshot(value: unknown): LunchSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("식당 목록을 읽지 못했어요. 잠시 후 다시 시도해 주세요.");
  const data = value as Record<string, unknown>;
  if (
    !Array.isArray(data.restaurants) ||
    typeof data.today !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.today) ||
    typeof data.weekday !== "number" ||
    !Number.isInteger(data.weekday) ||
    data.weekday < 0 ||
    data.weekday > 6
  ) {
    throw new Error("식당 목록을 읽지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  const ids = new Set<string>();
  const restaurants = data.restaurants.map((value: unknown): Restaurant => {
    const input = parseRestaurant(value);
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      !(
        item.excludedDate === null ||
        (typeof item.excludedDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.excludedDate))
      )
    )
      throw new Error("식당 데이터 형식을 확인해 주세요.");
    ids.add(item.id);
    return {
      ...input,
      id: item.id,
      excludedDate: item.excludedDate as string | null,
    };
  });
  return { restaurants, today: data.today, weekday: data.weekday };
}

export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
