import { NextResponse } from "next/server";
import { authorize, failure } from "@/lib/http";
import { backend, accessToken } from "@/lib/backend";
export async function POST(request: Request) {
  try {
    await authorize(request);
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80)
      throw Error("Nama harus berisi 2 sampai 80 karakter.");
    await backend(
      "/auth/v1/user",
      { method: "PUT", body: JSON.stringify({ data: { full_name: name } }) },
      await accessToken(),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
