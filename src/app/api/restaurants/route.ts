import { readBody, respond } from "@/lib/api";
import { addRestaurant, snapshot } from "@/lib/restaurant-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(snapshot);
}
export async function POST(request: Request) {
  return respond(async () => addRestaurant(await readBody(request)), 201);
}
