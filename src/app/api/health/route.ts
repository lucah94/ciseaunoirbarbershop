import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type ServiceStatus = "ok" | "error" | "slow";
type Check = { status: ServiceStatus; latency: number; message?: string };

async function checkSupabase(): Promise<Check> {
  const start = Date.now();
  try {
    const { error } = await supabaseAdmin.from("bookings").select("id", { count: "exact", head: true });
    const latency = Date.now() - start;
    if (error) return { status: "error", latency, message: error.message };
    return { status: latency > 2000 ? "slow" : "ok", latency };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkResend(): Promise<Check> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    const latency = Date.now() - start;
    return { status: res.status === 200 || res.status === 405 ? "ok" : "error", latency, message: res.status !== 200 && res.status !== 405 ? `HTTP ${res.status}` : undefined };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkTwilio(): Promise<Check> {
  const start = Date.now();
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return { status: "error", latency: 0, message: "Credentials manquants" };
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    });
    const latency = Date.now() - start;
    if (!res.ok) return { status: "error", latency, message: `HTTP ${res.status}` };
    const data = await res.json();
    return { status: "ok", latency, message: `Solde: $${Number(data.balance).toFixed(2)} USD` };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkClaude(): Promise<Check> {
  const start = Date.now();
  try {
    if (!process.env.ANTHROPIC_API_KEY) return { status: "error", latency: 0, message: "Clé API manquante" };
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    });
    const latency = Date.now() - start;
    return { status: res.ok ? "ok" : "error", latency, message: !res.ok ? `HTTP ${res.status}` : undefined };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

async function checkRLS(): Promise<Check> {
  const start = Date.now();
  try {
    const { data, error } = await supabaseAdmin.rpc("check_rls_status" as never);
    if (error) return { status: "error", latency: Date.now() - start, message: "Impossible de vérifier RLS" };

    const unprotected = (data as { tablename: string; rowsecurity: boolean }[] || [])
      .filter(t => !t.rowsecurity)
      .map(t => t.tablename);

    if (unprotected.length > 0) {
      return { status: "error", latency: Date.now() - start, message: `Tables sans RLS: ${unprotected.join(", ")}` };
    }
    return { status: "ok", latency: Date.now() - start };
  } catch (e) {
    return { status: "error", latency: Date.now() - start, message: String(e) };
  }
}

export async function GET() {
  const [supabase, resend, twilio, claude, security] = await Promise.all([
    checkSupabase(),
    checkResend(),
    checkTwilio(),
    checkClaude(),
    checkRLS(),
  ]);

  const checks = { supabase, resend, twilio, claude, security };
  const hasError = Object.values(checks).some(c => c.status === "error");
  const hasSlow = Object.values(checks).some(c => c.status === "slow");
  const overall = hasError ? "error" : hasSlow ? "degraded" : "ok";

  return NextResponse.json({
    status: overall,
    timestamp: new Date().toISOString(),
    checks,
  }, { status: hasError ? 503 : 200 });
}
