import { NextRequest, NextResponse } from "next/server";
import { sendReviewRequestEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { client_name, client_email, barber, service } = await req.json();
  if (!client_email) return NextResponse.json({ ok: true });
  try {
    await sendReviewRequestEmail({ client_name, client_email, barber, service });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Review request error:", e);
    return NextResponse.json({ error: "Email error" }, { status: 500 });
  }
}
