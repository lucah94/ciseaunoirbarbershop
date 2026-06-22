import { NextRequest, NextResponse } from "next/server";
import { generateText, MODELS } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase";
import { notifySystemAlert, notifyFbComment } from "@/lib/telegram";
import { runCron } from "@/lib/cron-log";

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

  const prompt = `Tu es Melynda, propriétaire de Ciseau Noir Barbershop — un barbershop haut de gamme à Beauport, ville de Québec. Tu réponds aux commentaires sur ta page Facebook.

Commentaire de ${author}: "${message}"

Écris une réponse courte (1-2 phrases), chaleureuse et naturelle en français québécois — comme Melynda répondrait vraiment, jamais robotique ni passe-partout. Reprends ce que la personne a dit quand c'est possible.

Selon le commentaire:
- Compliment → remercie sincèrement en reprenant ce qu'ils ont aimé
- Question prix/services → invite gentiment vers ciseaunoirbarbershop.com
- Question dispo → invite à réserver en ligne
- Plainte → empathique, sans être défensive, invite à appeler au (418) 665-5703
- Tag d'un ami → message convivial et complice

Style: varie tes formulations, évite les clichés, 1 emoji max, pas de hashtags, pas de signature.
Réponds uniquement le texte de la réponse, rien d'autre.`;

  const text = await generateText({
    model: MODELS.SMART,
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  return text || "Merci pour ton message! 🖤";
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
async function classifyComment(comment: FBComment): Promise<"HATE" | "NEGATIVE" | "QUESTION" | "NORMAL"> {
  const message = (comment.message || "").trim();
  if (!message) return "NORMAL";
  const prompt = `Classe ce commentaire Facebook sur la page d'un barbershop. Réponds par UN SEUL mot:
- HATE = haineux, insultes, vulgarité, racisme, menaces, harcèlement, spam, arnaque, liens douteux
- NEGATIVE = plainte ou mécontentement légitime d'un client (mauvaise expérience), mais PAS haineux
- QUESTION = vraie question ou demande qui mérite un suivi humain (dispo précise, problème avec un rendez-vous, demande pro/partenariat/média, prix spécifique) — PAS un simple compliment
- NORMAL = positif, neutre, tag d'ami, compliment, merci

Dans le doute entre QUESTION et NORMAL, réponds NORMAL. Dans le doute pour HATE, réponds NORMAL.
Commentaire: "${message}"
Réponds uniquement: HATE, NEGATIVE, QUESTION ou NORMAL.`;
  try {
    const text = (await generateText({
      model: MODELS.FAST,
      max_tokens: 8,
      messages: [{ role: "user", content: prompt }],
    })).toUpperCase();
    if (text.includes("HATE")) return "HATE";
    if (text.includes("NEGATIVE")) return "NEGATIVE";
    if (text.includes("QUESTION")) return "QUESTION";
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

  return await runCron("reply-fb-comments", async () => {
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

      // Question/demande qui mérite un suivi humain → heads-up calme sur Telegram
      if (category === "QUESTION") {
        await notifyFbComment({ author, message: msg, reply }).catch(e => console.error("FB comment heads-up error:", e));
      }

      if (success || category === "NEGATIVE" || category === "QUESTION") {
        // on log aussi négatifs/questions même si la réponse échoue → évite de ré-alerter
        const tag = category === "NEGATIVE" ? "[NÉGATIF] " : category === "QUESTION" ? "[QUESTION] " : "";
        await supabaseAdmin.from("sms_log").insert([{ phone: comment.id, message_type: "fb-reply", message_preview: `${tag}${(success ? reply : msg).slice(0, 90)}` }]);
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
  });
}
