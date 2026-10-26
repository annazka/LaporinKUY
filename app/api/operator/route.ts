import { NextResponse } from "next/server";
import { authorize, failure } from "@/lib/http";
import { rpc } from "@/lib/backend";
export async function POST(request: Request) {
  try {
    await authorize(request, true);
    const b = await request.json();
    await rpc("operator_update", {
      p_report_id: b.id,
      p_action: b.action,
      p_message: String(b.message || ""),
      p_progress: Number(b.progress || 0),
      p_start: b.start_date || null,
      p_target: b.target_date || null,
      p_priority: b.priority || "medium",
      p_photo_path: b.photo_path || null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
