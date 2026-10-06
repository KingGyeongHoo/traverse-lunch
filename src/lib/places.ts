import type { Category, RestaurantInput } from "./lunch";

export function containsPlace(note: string, url: string) {
  return note.split(/\s+/).includes(url);
}

export const SEARCH_RADII = [300, 500, 1000, 2000] as const;
export type SearchRadius = (typeof SEARCH_RADII)[number];
export type SearchLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};
export type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  distance: number;
  url: string;
};
export type NearbyResult = {
  places: NearbyPlace[];
  total: number;
  available: number;
  hasMore: boolean;
  page: number;
};

export function placeInput(place: NearbyPlace): RestaurantInput {
  const categories: Category[] = ["한식", "중식", "일식", "양식", "분식"];
  return {
    name: place.name.slice(0, 50),
    category:
      categories.find((value) => place.category.includes(value)) ?? "기타",
    distance: null,
    note: `${place.url}\n${place.address}`.slice(0, 200),
    closedDays: [],
  };
}

export function distanceLabel(meters: number) {
  return meters < 1000
    ? `${Math.round(meters)}m`
    : `${(meters / 1000).toFixed(1)}km`;
}
