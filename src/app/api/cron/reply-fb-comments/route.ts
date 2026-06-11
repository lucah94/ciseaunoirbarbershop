import { NextRequest, NextResponse } from "next/server";
import { aiClient as anthropic, MODELS } from "@/lib/ai";
import type Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { notifySystemAlert } from "@/lib/telegram";

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

// Classe un commentaire. Conservateur : en cas de doute → NORMAL (on ne supprime jamais par erreur).
async function classifyComment(comment: FBComment): Promise<"HATE" | "NEGATIVE" | "NORMAL"> {
  const message = (comment.message || "").trim();
  if (!message) return "NORMAL";
  const prompt = `Classe ce commentaire Facebook sur la page d'un barbershop. Réponds par UN SEUL mot:
- HATE = haineux, insultes, vulgarité, racisme, menaces, harcèlement, spam, arnaque, liens douteux
- NEGATIVE = plainte ou mécontentement légitime d'un client (mauvaise expérience), mais PAS haineux
- NORMAL = positif, neutre, question, tag d'ami, compliment

Dans le doute, réponds NORMAL.
Commentaire: "${message}"
Réponds uniquement: HATE, NEGATIVE ou NORMAL.`;
  try {
    const response = await anthropic.messages.create({
      model: MODELS.FAST,
      max_tokens: 8,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text || "").toUpperCase();
    if (text.includes("HATE")) return "HATE";
    if (text.includes("NEGATIVE")) return "NEGATIVE";
    return "NORMAL";
  } catch {
    return "NORMAL";
  }
}

async function deleteComment(commentId: string): Promise<boolean> {
  const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!TOKEN) return false;
  const res = await fetch(`https://graph.facebook.com/v19.0/${commentId}?access_token=${TOKEN}`, { method: "DELETE" });
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
    const author = comment.from?.name || "?";
    const msg = comment.message || "";
    try {
      const category = await classifyComment(comment);

      // Haineux / spam / arnaque → on supprime + on avertit l'équipe
      if (category === "HATE") {
        const deleted = await deleteComment(comment.id);
        await notifySystemAlert(`🚫 Commentaire ${deleted ? "SUPPRIMÉ" : "à supprimer (échec)"} (haineux/spam)\n👤 ${author}\n💬 "${msg.slice(0, 200)}"`);
        await supabaseAdmin.from("sms_log").insert([{ phone: comment.id, message_type: "fb-reply", message_preview: `[SUPPRIMÉ] ${msg.slice(0, 80)}` }]);
        results.push({ author, replied: false, preview: `[supprimé] ${msg.slice(0, 60)}` });
        continue;
      }

      // Plainte légitime → on NE supprime PAS, on avertit l'équipe (pis on répond poliment)
      if (category === "NEGATIVE") {
        await notifySystemAlert(`⚠️ Commentaire négatif à surveiller (PAS supprimé)\n👤 ${author}\n💬 "${msg.slice(0, 200)}"`);
      }

      const reply = await generateReply(comment);
      const success = await postReply(comment.id, reply);
      if (success || category === "NEGATIVE") {
        // on log aussi les négatifs même si la réponse échoue → évite de ré-alerter
        await supabaseAdmin.from("sms_log").insert([{ phone: comment.id, message_type: "fb-reply", message_preview: `${category === "NEGATIVE" ? "[NÉGATIF] " : ""}${(success ? reply : msg).slice(0, 90)}` }]);
      }
      results.push({ author, replied: success, preview: `${category === "NEGATIVE" ? "[négatif] " : ""}${reply.slice(0, 70)}` });
    } catch (e) {
      results.push({ author, replied: false, preview: String(e).slice(0, 80) });
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
