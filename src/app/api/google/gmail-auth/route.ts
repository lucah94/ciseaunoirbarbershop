import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// OAuth pour Gmail — séparé du GMB OAuth
// Callback: /api/google/gmail-callback
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/gmail-callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.modify",
    access_type: "offline",
    prompt: "select_account consent",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
