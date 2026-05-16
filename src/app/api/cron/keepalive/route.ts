import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "kgkkwvchpghjdfajmrnz";
const SUPABASE_MANAGEMENT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;

async function triggerRestore(): Promise<boolean> {
  if (!SUPABASE_MANAGEMENT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/restore`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${SUPABASE_MANAGEMENT_TOKEN}`, "Content-Type": "application/json" },
    });
    const data = await res.json();
    console.log("[keepalive] restore triggered:", JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("[keepalive] restore failed:", e);
    return false;
  }
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const { error } = await supabaseAdmin.from("bookings").select("id").limit(1);
    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (error) {
      console.error("[keepalive] Supabase error:", error.message);
      const restored = await triggerRestore();
      return NextResponse.json({ status: "error", latency, error: error.message, restore_triggered: restored }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", latency, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error("[keepalive] Exception:", e);
    const restored = await triggerRestore();
    return NextResponse.json({ status: "error", latency: Date.now() - start, error: String(e), restore_triggered: restored }, { status: 500 });
  }
}
