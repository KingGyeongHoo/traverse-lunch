export const NEARBY_CATEGORIES = [
  "한식",
  "중식",
  "일식",
  "양식",
  "분식",
  "기타",
] as const;
export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];
export type PlaceType = "restaurant" | "cafe";
export type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  distance: number;
  url: string;
};
export type NearbyResult = {
  places: NearbyPlace[];
  total: number;
  truncated: boolean;
};

export function foodCategory(category: string): NearbyCategory {
  const parts = category.split(">").map((part) => part.trim());
  for (const value of ["분식", "중식", "일식", "양식", "한식"] as const) {
    if (parts.includes(value)) return value;
  }
  return "기타";
}
