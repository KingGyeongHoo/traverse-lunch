import { readBody, respond } from "@/lib/api";
import { parsePickDistance } from "@/lib/lunch";
import { pickRestaurant } from "@/lib/restaurant-store";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return respond(async () =>
    pickRestaurant(parsePickDistance(await readBody(request, true))),
  );
}
