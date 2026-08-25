import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Génère le visuel de la pub d'embauche « Perle Rare » via OpenRouter (openai/gpt-image-2).
 * Usage ponctuel admin — pas branché à un flux automatique (une pub d'embauche, c'est rare).
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY manquant" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const prompt: string = body.prompt || `Photographie publicitaire premium pour une offre d'emploi de barbier/barbière. Salon de barbier moderne noir et or, chaises de barbier en cuir noir, miroirs encadrés d'or, éclairage chaud dramatique. Un(e) barbier professionnel(le) en tablier noir, souriant, confiant, les bras croisés, au centre du cadre, dans le salon. Style photo éditoriale haut de gamme, contraste fort, ambiance premium et invitante — PAS surchargé, composition épurée avec beaucoup d'espace négatif en haut pour du texte.
Texte intégré à l'image, gros et lisible, en haut : "ON CHERCHE UN BARBIER" en lettres blanches bold sur fond sombre.
Sous-texte plus petit : "Ciseau Noir · Beauport" en lettres or.
Aucun autre texte. Style photographique réaliste, pas d'illustration, pas de cartoon.`;

  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt,
      // openai/gpt-image-2 n'accepte qu'un jeu fixe de ratios (pas "4:5") : 3:4 est le
      // plus proche d'un format portrait pub Facebook/Instagram parmi ceux acceptés.
      aspect_ratio: body.aspectRatio || "3:4",
    }),
    signal: AbortSignal.timeout(55000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: `OpenRouter ${res.status}: ${JSON.stringify(data).slice(0, 500)}` }, { status: 502 });
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    return NextResponse.json({ error: `Pas d'image retournée: ${JSON.stringify(data).slice(0, 500)}` }, { status: 502 });
  }

  let telegram: { ok: boolean; error?: string } | null = null;
  if (body.sendToTelegram) {
    telegram = await sendPhotoToTelegramGroup(
      Buffer.from(b64, "base64"),
      body.caption || "🖼️ Nouveau visuel pub embauche « Perle Rare » — pour approbation."
    );
  }

  return NextResponse.json({ ok: true, b64, cost: data?.usage?.cost ?? null, telegram });
}

async function sendPhotoToTelegramGroup(imageBytes: Buffer, caption: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "TELEGRAM_BOT_TOKEN/TELEGRAM_GROUP_CHAT_ID manquant" };

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("photo", new Blob([new Uint8Array(imageBytes)], { type: "image/png" }), "hiring-ad.png");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
    if (!res.ok) return { ok: false, error: `Telegram ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erreur réseau" };
  }
}
