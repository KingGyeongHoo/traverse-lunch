export type Rating = { average: number; count: number; mine: number };
export type Ratings = Record<string, Rating>;

export function parseRatings(value: unknown): Ratings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("별점 정보를 불러오지 못했어요.");
  const entries = Object.entries(value);
  for (const [, item] of entries) {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("별점 정보를 불러오지 못했어요.");
    const rating = item as Record<string, unknown>;
    if (
      typeof rating.average !== "number" ||
      !Number.isFinite(rating.average) ||
      rating.average < 0 ||
      rating.average > 5 ||
      !Number.isInteger(rating.count) ||
      (rating.count as number) < 0 ||
      !Number.isInteger(rating.mine) ||
      (rating.mine as number) < 0 ||
      (rating.mine as number) > 5
    )
      throw new Error("별점 정보를 불러오지 못했어요.");
  }
  return Object.fromEntries(entries) as Ratings;
}

export function localRaterId(): string {
  const key = "lunch.rating-user.v1";
  let id = window.localStorage.getItem(key);
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}
