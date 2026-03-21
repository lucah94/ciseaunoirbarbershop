import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { z } from "zod";

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url("Endpoint invalide"),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  client_email: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const result = subscriptionSchema.safeParse(rawBody);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
  }

  const { subscription, client_email } = result.data;

  // Upsert: if the same endpoint already exists, update it
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        client_email: client_email || null,
      },
      { onConflict: "endpoint" }
    )
    .select()
    .single();

  if (error) {
    console.error("[push/subscribe] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
