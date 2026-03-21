import { NextRequest, NextResponse } from "next/server";
import { postToGoogleMyBusiness } from "@/lib/google";

export async function POST(req: NextRequest) {
  const adminAuth = req.cookies.get("admin_auth");
  if (!adminAuth || adminAuth.value !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message requis" }, { status: 400 });

  if (!process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_LOCATION_NAME) {
    return NextResponse.json({ error: "Google My Business non configuré" }, { status: 500 });
  }

  const result = await postToGoogleMyBusiness(message);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
