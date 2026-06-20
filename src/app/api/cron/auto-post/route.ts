import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generatePost } from "@/lib/posts";
import { proposePostOnTelegram } from "@/lib/telegram";
import { montrealParts } from "@/lib/utils";

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// AUCUNE publication sans l'accord de Melynda. Le cron propose le texte sur Telegram, point.

// Rotation des types de contenu — jamais de promo automatique
const NON_PROMO_KINDS = [
  "tip",
  "service_highlight",
  "product",
  "client_appreciation",
  "news_seasonal",
];

function pickKind(): string {
  // Rotate based on current day + week number to vary across runs
  const now = new Date();
  const weekNumber = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  const idx = (montrealParts(now).weekday + weekNumber) % NON_PROMO_KINDS.length;
  return NON_PROMO_KINDS[idx];
}

export async function GET(req: NextRequest) {
  // Authorization check
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Only run on open days (Tue=2, Wed=3, Thu=4, Fri=5, Sat=6)
  const now = new Date();
  const dayOfWeek = montrealParts(now).weekday;
  const openDays = [2, 3, 4, 5, 6];
  if (!openDays.includes(dayOfWeek)) {
    return NextResponse.json({ ok: false, reason: "Closed day — no proposal made", dayOfWeek });
  }

  const kind = pickKind();

  try {
    const content = await generatePost(kind);

    // Insert into pending_posts
    const { data: row, error: insertError } = await supabaseAdmin
      .from("pending_posts")
      .insert({ content, kind, status: "pending" })
      .select("id")
      .single();

    if (insertError || !row) {
      console.error("auto-post: insert error", insertError);
      return NextResponse.json({ ok: false, error: insertError?.message || "insert failed" }, { status: 500 });
    }

    // Propose on Telegram with approval buttons
    await proposePostOnTelegram({ id: row.id as string, content, kind });

    return NextResponse.json({ ok: true, kind, pendingId: row.id, preview: content.slice(0, 120) });
  } catch (e) {
    console.error("auto-post error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
