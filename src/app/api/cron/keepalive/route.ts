import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (optional but recommended)
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  try {
    // Simple ping query to keep Supabase alive
    const { error } = await supabaseAdmin.from("bookings").select("id").limit(1);
    const latency = Date.now() - start;

    if (error) {
      console.error("[keepalive] Supabase error:", error.message);
      return NextResponse.json({ status: "error", latency, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", latency, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("[keepalive] Exception:", e);
    return NextResponse.json({ status: "error", latency: Date.now() - start, error: String(e) }, { status: 500 });
  }
}
