import { NextRequest, NextResponse } from "next/server";
import { postToGoogleMyBusiness } from "@/lib/google";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message requis" }, { status: 400 });

  if (!process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_LOCATION_NAME) {
    return NextResponse.json({ error: "Google My Business non configuré" }, { status: 500 });
  }

  const result = await postToGoogleMyBusiness(message);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
