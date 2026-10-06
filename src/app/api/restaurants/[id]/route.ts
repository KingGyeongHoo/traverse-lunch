import { readBody, respond } from "@/lib/api";
import { deleteRestaurant, updateRestaurant } from "@/lib/restaurant-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return respond(async () =>
    updateRestaurant((await context.params).id, await readBody(request)),
  );
}
export async function DELETE(_request: Request, context: Context) {
  return respond(async () => deleteRestaurant((await context.params).id));
}
