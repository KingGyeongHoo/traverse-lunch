import { PlacesError, searchLocations } from "@/lib/places-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 2048) throw new PlacesError("검색어가 너무 깁니다.", 413);
    let input;
    try {
      input = JSON.parse(body);
    } catch {
      throw new PlacesError("검색어를 확인해 주세요.");
    }
    return Response.json(
      { locations: await searchLocations(input) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof PlacesError
            ? error.message
            : "위치를 검색하지 못했어요.",
      },
      {
        status: error instanceof PlacesError ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
