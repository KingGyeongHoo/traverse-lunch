import { readBody, respond } from "@/lib/api";
import { searchNearby } from "@/lib/nearby-server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return respond(async () => searchNearby(await readBody(request)));
}
