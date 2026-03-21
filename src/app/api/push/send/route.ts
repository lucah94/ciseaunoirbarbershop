import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

/**
 * POST /api/push/send
 *
 * Placeholder route for sending push notifications.
 * Requires the `web-push` npm package for actual delivery.
 *
 * Body: { email, title, body, url }
 *
 * For now this route:
 * 1. Looks up subscriptions by email
 * 2. Returns what would be sent (dry-run)
 *
 * To enable real sending:
 *   npm install web-push
 *   Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in .env
 *   Uncomment the web-push logic below.
 */

export async function POST(req: NextRequest) {
  let rawBody: { email?: string; title?: string; body?: string; url?: string };
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { email, title, body, url } = rawBody;

  if (!email || !title || !body) {
    return NextResponse.json(
      { error: "email, title et body sont requis" },
      { status: 400 }
    );
  }

  // Look up subscriptions for this email
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("client_email", email);

  if (error) {
    console.error("[push/send] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json(
      { error: "Aucun abonnement trouvé pour cet email" },
      { status: 404 }
    );
  }

  // TODO: Install web-push and uncomment to enable real push delivery
  //
  // import webpush from "web-push";
  //
  // webpush.setVapidDetails(
  //   `mailto:${process.env.VAPID_EMAIL}`,
  //   process.env.VAPID_PUBLIC_KEY!,
  //   process.env.VAPID_PRIVATE_KEY!
  // );
  //
  // const payload = JSON.stringify({ title, body, url: url || "/" });
  //
  // const results = await Promise.allSettled(
  //   subscriptions.map((sub) =>
  //     webpush.sendNotification(
  //       { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
  //       payload
  //     )
  //   )
  // );

  return NextResponse.json({
    ok: true,
    message: "web-push non installé — dry run",
    subscriptions_found: subscriptions.length,
    would_send: { title, body, url: url || "/" },
  });
}
