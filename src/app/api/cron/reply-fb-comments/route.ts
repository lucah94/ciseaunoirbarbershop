import { NextRequest, NextResponse } from "next/server";
import { aiClient as anthropic, MODELS } from "@/lib/ai";
import type Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type FBComment = {
  id: string;
  message?: string;
  from?: { name: string; id: string };
  created_time: string;
};

async function fetchPageComments(): Promise<FBComment[]> {
  const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!PAGE_ID || !TOKEN) return [];

  const postsRes = await fetch(
    `https://graph.facebook.com/v19.0/${PAGE_ID}/posts?fields=comments.limit(50){id,message,from,created_time}&limit=20&access_token=${TOKEN}`
  );
  if (!postsRes.ok) return [];
  const postsData = await postsRes.json();

  const allComments: FBComment[] = [];
  for (const post of postsData.data || []) {
    if (post.comments?.data) {
      allComments.push(...post.comments.data);
    }
  }
  return allComments;
}

async function generateReply(comment: FBComment): Promise<string> {
  const message = comment.message || "";
  const author = comment.from?.name?.split(" ")[0] || "";

  const prompt = `Tu es Melynda, propriétaire de Ciseau Noir Barbershop à Beauport, Québec.
Réponds à ce commentaire Facebook de manière chaleureuse, courte (1-2 phrases max), en français québécois naturel.

Commentaire de ${author}: "${message}"

Règles:
- Compliment positif → remercier chaleureusement
- Question sur prix/services → diriger vers ciseaunoirbarbershop.com
- Question sur dispo → inviter à réserver en ligne
- Plainte → empathique, inviter au (418) 665-5703
- Tag ami/famille → message convivial
- Pas de hashtags, 1-2 emojis max
- Pas de signature, juste le message

Génère uniquement la réponse texte, rien d'autre.`;

  const response = await anthropic.messages.create({
    model: MODELS.BALANCED,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  return text?.trim() || "Merci pour ton message! 🖤";
}

async function postReply(commentId: string, message: string): Promise<boolean> {
  const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!TOKEN) return false;
  const res = await fetch(`https://graph.facebook.com/v19.0/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: TOKEN }),
  });
  return res.ok;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!process.env.FACEBOOK_PAGE_ID || !process.env.FACEBOOK_ACCESS_TOKEN) {
    return NextResponse.json({ ok: false, reason: "Facebook credentials manquants" });
  }

  const comments = await fetchPageComments();
  const ourPageId = process.env.FACEBOOK_PAGE_ID;
  const externalComments = comments.filter(c => c.from?.id !== ourPageId);

  // Dedup — réutilise sms_log avec type 'fb-reply'
  const { data: replied } = await supabaseAdmin
    .from("sms_log")
    .select("phone")
    .eq("message_type", "fb-reply")
    .gte("sent_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .range(0, 999);
  const repliedSet = new Set((replied || []).map(r => r.phone));

  const results: Array<{ author: string; replied: boolean; preview: string }> = [];

  for (const comment of externalComments.slice(0, 20)) {
    if (repliedSet.has(comment.id)) continue;
    try {
      const reply = await generateReply(comment);
      const success = await postReply(comment.id, reply);
      if (success) {
        await supabaseAdmin.from("sms_log").insert([{
          phone: comment.id,
          message_type: "fb-reply",
          message_preview: reply.slice(0, 100),
        }]);
      }
      results.push({ author: comment.from?.name || "?", replied: success, preview: reply.slice(0, 80) });
    } catch (e) {
      results.push({ author: comment.from?.name || "?", replied: false, preview: String(e).slice(0, 80) });
    }
  }

  return NextResponse.json({
    ok: true,
    total_comments: comments.length,
    external_comments: externalComments.length,
    new_replies: results.length,
    results,
  });
}
