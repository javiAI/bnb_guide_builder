// Vercel Cron endpoint for the local events sync tick.
//
// Protected by `CRON_SECRET` — Vercel Cron sends `Authorization: Bearer <secret>`.
// Call from an external scheduler: `POST /api/cron/local-events`. Body ignored.

import { NextResponse } from "next/server";
import { runLocalEventsTick } from "@/lib/services/local-events/scheduler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "cron_secret_not_configured" },
      { status: 500 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (provided !== secret) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const report = await runLocalEventsTick();
  return NextResponse.json({ ok: true, report });
}
