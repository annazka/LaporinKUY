import { viewer, accessToken } from "@/lib/backend";
export async function GET(request: Request) {
  if (!(await viewer())) return new Response(null, { status: 401 });
  const path = new URL(request.url).searchParams.get("path");
  if (!path || !/^[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path))
    return new Response(null, { status: 400 });
  const r = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/report-photos/${path}`,
    {
      cache: "no-store",
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${await accessToken()}`,
      },
    },
  );
  if (!r.ok) return new Response(null, { status: 404 });
  return new Response(r.body, {
    headers: {
      "Content-Type": r.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
