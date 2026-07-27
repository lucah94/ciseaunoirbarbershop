import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateAdCopy } from "@/lib/posts";
import { proposePostOnTelegram } from "@/lib/telegram";
export const dynamic = "force-dynamic";

/**
 * Agent Hermès — rédacteur de pub. Génère une copy de Reel/pub dans la voix Ciseau Noir
 * (2 variantes + hashtags), et si propose=true, l'envoie sur Telegram pour APPROBATION
 * (règle Melynda : rien de public sans son OK). Le bouton « Approuver » publie ensuite via
 * le flux existant (pending_posts → publishPostToFacebook).
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { context = "", propose = true } = await req.json().catch(() => ({}));
  const content = await generateAdCopy(context);

  if (!propose) {
    return NextResponse.json({ content, proposed: false });
  }

  // Stocke en attente d'approbation (même table/flux que l'auto-post).
  const { data: row, error } = await supabaseAdmin
    .from("pending_posts")
    .insert({ content, kind: "pub-reel", status: "pending" })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json({ content, proposed: false, error: error?.message || "insert failed" }, { status: 500 });
  }

  const sent = await proposePostOnTelegram({ id: row.id as string, content, kind: "pub Reel Hermès" });
  return NextResponse.json({ content, proposed: sent, id: row.id });
}
