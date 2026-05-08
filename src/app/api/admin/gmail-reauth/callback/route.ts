import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${(process.env.NEXT_PUBLIC_SITE_URL || "").trim()}/api/admin/gmail-reauth/callback`;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (state !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!code) {
    return NextResponse.json({ error: "Code manquant" }, { status: 400 });
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json();

  if (!data.refresh_token) {
    return NextResponse.json({ error: "Pas de refresh_token", data }, { status: 500 });
  }

  // Auto-save token to Supabase so no manual copy needed
  await supabaseAdmin.from("settings").upsert(
    { key: "google_refresh_token", value: data.refresh_token },
    { onConflict: "key" }
  );

  return NextResponse.json({
    success: true,
    message: "✅ Token sauvegardé automatiquement — Gmail est maintenant connecté !",
    saved_to: "Supabase settings",
  });
}
