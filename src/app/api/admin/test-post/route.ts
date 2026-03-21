import { NextRequest, NextResponse } from "next/server";

// Server-side proxy so the browser never sees CRON_SECRET
// Protected by admin_auth cookie (same mechanism as middleware)
export async function POST(req: NextRequest) {
  const adminAuth = req.cookies.get("admin_auth");
  if (!adminAuth || adminAuth.value !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let times = 1;
  try {
    const body = await req.json();
    times = typeof body.times === "number" ? body.times : 1;
  } catch {
    // Default to 1 if no body
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/cron/auto-post?times=${times}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("Test-post error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
