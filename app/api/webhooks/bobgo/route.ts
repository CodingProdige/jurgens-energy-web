export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    {
      error: "bobgo_disabled",
      ok: false,
    },
    { status: 410 },
  );
}
