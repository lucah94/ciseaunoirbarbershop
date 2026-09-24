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

  const tiers = [
    { tier: "FREE", usage: "posts / promos / réponses avis (contenu public)", model: MODELS.FREE },
    { tier: "FAST", usage: "classification, réponses courtes", model: MODELS.FAST },
    { tier: "BALANCED", usage: "conversations clients, analyse emails", model: MODELS.BALANCED },
    { tier: "SMART", usage: "Figaro, raisonnement profond", model: MODELS.SMART },
  ];

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
        return { ...t, ok: txt.length > 0, ms: Date.now() - t0, reponse: txt.slice(0, 40) };
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
