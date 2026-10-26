import { NextResponse } from "next/server";
import { authorize, failure } from "@/lib/http";
import { rpc } from "@/lib/backend";
export async function POST(request: Request) {
  try {
    await authorize(request);
    const b = await request.json();
    const code = await rpc("redeem_voucher", { p_voucher_id: b.id });
    return NextResponse.json({ code });
  } catch (e) {
    return failure(e);
  }
}
