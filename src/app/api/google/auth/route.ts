import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
export const dynamic = 'force-dynamic';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = "https://ciseau-noir.vercel.app/api/google/callback";

// GET — redirige vers Google OAuth
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    // Les DEUX scopes en un seul consentement : l'autre redirect_uri
    // (/api/google/gmail-callback) n'est PAS enregistrée dans Google Cloud
    // Console (seule celle-ci l'est) — 25 sept 2026, redirect_uri_mismatch
    // confirmé en direct. Reprend le seul token combiné qui marchait avant
    // la révocation d'aujourd'hui, cette fois demandé explicitement.
    scope: [
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" "),
    access_type: "offline",
    prompt: "select_account consent",
    login_hint: "",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
