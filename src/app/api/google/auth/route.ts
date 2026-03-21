import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NODE_ENV === "production"
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/google/callback`
  : "http://localhost:3000/api/google/callback";

// GET — redirige vers Google OAuth
export async function GET(req: NextRequest) {
  const adminAuth = req.cookies.get("admin_auth");
  if (!adminAuth || adminAuth.value !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/business.manage",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
