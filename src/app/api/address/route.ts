import { readBody, respond } from "@/lib/api";
import { resolveAddress } from "@/lib/address-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return respond(async () => resolveAddress(await readBody(request)));
}
