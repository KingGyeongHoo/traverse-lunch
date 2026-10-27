import type {
  LunchSnapshot,
  Restaurant,
  RestaurantInput,
  Distance,
} from "./lunch";
import type { RestaurantLocation } from "./restaurant-location";
import {
  configured,
  ensureSession,
  openCompany,
  loadSnapshot,
  changeTeam,
  rpc,
  type Action,
} from "./supabase";
import { localRaterId, parseRatings, type Ratings } from "./ratings";

async function request<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했어요.");
  return data as T;
}

// Resolve membership with each session so a new browser joins the same company.
async function companyId() {
  await ensureSession();
  return (await openCompany()).id;
}

async function mutate(action: Action, payload: Record<string, unknown>) {
  return changeTeam(await companyId(), action, payload);
}

export const lunchClient = {
  async ratings(): Promise<Ratings> {
    if (configured)
      return parseRatings(
        await rpc("lunch_rating_snapshot", { p_team: await companyId() }),
      );
    const response = await fetch("/api/ratings", {
      headers: { "x-lunch-rater": localRaterId() },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "별점 정보를 불러오지 못했어요.");
    return parseRatings(data);
  },
  async setRating(restaurantId: string, score: number): Promise<Ratings> {
    if (configured)
      return parseRatings(
        await rpc("lunch_set_rating", {
          p_team: await companyId(),
          p_restaurant: restaurantId,
          p_score: score,
        }),
      );
    const response = await fetch("/api/ratings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-lunch-rater": localRaterId(),
      },
      body: JSON.stringify({ restaurantId, score }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "별점을 저장하지 못했어요.");
    return parseRatings(data);
  },
  resolveAddress(address: string): Promise<RestaurantLocation> {
    return request("/api/address", "POST", { address });
  },
  async load(): Promise<LunchSnapshot> {
    return configured
      ? loadSnapshot(await companyId())
      : request("/api/restaurants");
  },
  async save(input: RestaurantInput, id?: string): Promise<LunchSnapshot> {
    return configured
      ? mutate("save", { input, ...(id ? { id } : {}) })
      : request(
          id ? `/api/restaurants/${id}` : "/api/restaurants",
          id ? "PATCH" : "POST",
          input,
        );
  },
  async remove(id: string): Promise<LunchSnapshot> {
    return configured
      ? mutate("delete", { id })
      : request(`/api/restaurants/${id}`, "DELETE");
  },
  async exclude(id: string, excludedToday: boolean): Promise<LunchSnapshot> {
    return configured
      ? mutate("exclude", { id, excludedToday })
      : request(`/api/restaurants/${id}`, "PATCH", { excludedToday });
  },
  async pick(
    distance: Distance,
  ): Promise<LunchSnapshot & { picked: Restaurant }> {
    if (!configured) return request("/api/pick", "POST", { distance });
    const next = await mutate("pick", { distance });
    if (!next.picked)
      throw new Error("추첨 결과를 확인하지 못했어요. 다시 시도해 주세요.");
    return { ...next, picked: next.picked };
  },
};
