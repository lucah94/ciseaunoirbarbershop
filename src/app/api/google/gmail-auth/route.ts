import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
export const dynamic = 'force-dynamic';

// OAuth pour Gmail — séparé du GMB OAuth
// Callback: /api/google/gmail-callback
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  // Même domaine que /api/google/auth (le flux fiche Google, qui marche) : l'URL de
  // redirection doit être EXACTEMENT celle enregistrée dans Google Cloud Console — un
  // domaine différent (même s'il pointe au même site) donne "redirect_uri_mismatch".
  // NEXT_PUBLIC_SITE_URL pointe sur le domaine custom, jamais enregistré pour Gmail.
  const redirectUri = "https://ciseau-noir.vercel.app/api/google/gmail-callback";

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
