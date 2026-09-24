import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { aiClient, MODELS } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * Vérifie que les 4 modèles configurés EXISTENT ENCORE et répondent.
 *
 * Pourquoi : OpenRouter retire des modèles sans prévenir. Deux des quatre étaient
 * morts sans que personne le voie (le gratuit retiré, et Sonnet écrit avec un tiret
 * au lieu d'un point) — la chaîne de secours masquait la panne en payant plus cher.
 * Ce test coûte quelques dixièmes de cenne : chaque appel demande 12 tokens.
 *
 * Appelle CHAQUE modèle directement (pas via generateText) pour qu'un modèle mort
 * apparaisse comme mort au lieu d'être rattrapé par le secours.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  // ?models=a,b,c → teste des modèles CANDIDATS au lieu des 4 configurés.
  // Sert à valider un remplaçant avant de le mettre en production (un modèle peut
  // répondre 200 et ne renvoyer AUCUN texte : c'est invisible autrement).
  const custom = req.nextUrl.searchParams.get("models");
  const tiers = custom
    ? custom.split(",").map((m) => ({ tier: "CANDIDAT", usage: "test", model: m.trim() }))
    : [
    { tier: "FREE", usage: "posts / promos / réponses avis (contenu public)", model: MODELS.FREE },
    { tier: "FAST", usage: "classification, réponses courtes", model: MODELS.FAST },
    { tier: "BALANCED", usage: "conversations clients, analyse emails", model: MODELS.BALANCED },
    { tier: "SMART", usage: "Figaro, raisonnement profond", model: MODELS.SMART },
  ] as { tier: string; usage: string; model: string }[];

  const results = await Promise.all(
    tiers.map(async (t) => {
      const t0 = Date.now();
      try {
        const res = await aiClient.messages.create({
          model: t.model,
          max_tokens: 12,
          messages: [{ role: "user", content: "Réponds exactement : OK" }],
        });
        const txt = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
        return {
          ...t,
          ok: txt.length > 0,
          ms: Date.now() - t0,
          reponse: txt.slice(0, 60),
          // Quand le texte est vide, savoir CE QUE le modèle a renvoyé (blocs de
          // raisonnement seuls, réponse tronquée…) évite de deviner.
          blocs: txt.length === 0 ? res.content.map((b) => b.type) : undefined,
          stop: txt.length === 0 ? res.stop_reason : undefined,
        };
      } catch (e) {
        return {
          ...t,
          ok: false,
          ms: Date.now() - t0,
          error: (e instanceof Error ? e.message : String(e)).slice(0, 200),
        };
      }
    })
  );

  const morts = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: morts.length === 0,
    verdict:
      morts.length === 0
        ? "Les 4 modèles répondent."
        : `${morts.length} modèle(s) en panne : ${morts.map((m) => `${m.tier} (${m.model})`).join(", ")}`,
    modeles: results,
  }, { status: morts.length === 0 ? 200 : 207 });
}
