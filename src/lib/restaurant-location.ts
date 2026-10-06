import type { Distance } from "./lunch";

export const OFFICE = {
  address: "서울 영등포구 양평로 12",
  latitude: 37.5326909883438,
  longitude: 126.90489166462,
} as const;

export type RestaurantLocation = {
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  distance: Distance;
};

export function metersFromOffice(latitude: number, longitude: number) {
  const radians = Math.PI / 180;
  const a =
    Math.sin(((latitude - OFFICE.latitude) * radians) / 2) ** 2 +
    Math.cos(OFFICE.latitude * radians) *
      Math.cos(latitude * radians) *
      Math.sin(((longitude - OFFICE.longitude) * radians) / 2) ** 2;
  return Math.round(
    6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))),
  );
}

export function distanceGroup(meters: number): Distance {
  return meters <= 250
    ? "가까움"
    : meters <= 500
      ? "중간"
      : meters <= 750
        ? "멂"
        : "매우 멂";
}
