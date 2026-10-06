import { LunchError } from "./lunch";

export async function readBody(
  request: Request,
  allowEmpty = false,
): Promise<unknown> {
  const body = await request.text();
  if (allowEmpty && !body.trim()) return {};
  if (body.length > 4096) throw new LunchError("입력 내용이 너무 길어요.", 413);
  try {
    return JSON.parse(body);
  } catch {
    throw new LunchError("올바른 JSON 형식으로 보내 주세요.");
  }
}

export async function respond(action: () => Promise<unknown>, status = 200) {
  try {
    return Response.json(await action(), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof LunchError)) console.error("Lunch API:", error);
    return Response.json(
      {
        error:
          error instanceof LunchError
            ? error.message
            : "저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: error instanceof LunchError ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
