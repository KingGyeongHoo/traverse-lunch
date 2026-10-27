import { readBody, respond } from "@/lib/api";
import { ratingSnapshot, setRating } from "@/lib/rating-store";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return respond(() => ratingSnapshot(request.headers.get("x-lunch-rater")));
}
export async function PUT(request: Request) {
  return respond(async () =>
    setRating(request.headers.get("x-lunch-rater"), await readBody(request)),
  );
}
