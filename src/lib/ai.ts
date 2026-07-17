import Anthropic from "@anthropic-ai/sdk";

// TOUJOURS via OpenRouter — jamais d'appel direct à Anthropic (évite les charges surprises).
// Même si OPENROUTER_API_KEY manque, on garde le baseURL OpenRouter : au pire un appel échoue
// avec une erreur d'auth OpenRouter, mais on ne facture JAMAIS Anthropic en douce.
export const aiClient = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY ?? "missing-openrouter-key",
  // ⚠️ baseURL = ".../api" (PAS ".../api/v1") : le SDK Anthropic ajoute déjà "/v1/messages".
  // Avec "/api/v1" on obtenait "/api/v1/v1/messages" → 404 → toute l'IA cassée.
  baseURL: "https://openrouter.ai/api",
  defaultHeaders: {
    "HTTP-Referer": "https://ciseaunoirbarbershop.com",
    "X-Title": "Ciseau Noir",
  },
});

// Dernier modèle pour chaque niveau — 1 seul endroit à changer. Tout passe par OpenRouter.
export const MODELS = {
  // GRATUIT (0$) — meilleur modèle gratuit d'OpenRouter. UNIQUEMENT pour du contenu PUBLIC
  // et léger sans données clients (posts, promos, réponses avis/commentaires). Peut être
  // rate-limité ou retiré → generateText retombe alors sur DeepSeek (des cennes), JAMAIS
  // directement sur Sonnet (le cher). Ne PAS l'utiliser pour les conversations clients (PII).
  FREE: "meta-llama/llama-3.3-70b-instruct:free",

  // Tâches simples: classification, réponses courtes (~0.14$/MTok via DeepSeek)
  FAST: "deepseek/deepseek-chat",

  // Tâches moyennes: conversations clients, analyse emails (~0.14$/MTok via DeepSeek)
  BALANCED: "deepseek/deepseek-chat",

  // Tâches complexes: Figaro, raisonnement profond (Claude Sonnet routé via OpenRouter — CHER)
  SMART: "anthropic/claude-sonnet-4-6",
} as const;

type GenParams = {
  model: string;
  max_tokens: number;
  messages: Anthropic.MessageParam[];
  system?: string;
};

// Alerte Telegram (fire-and-forget) quand une tâche IA doit retomber sur Sonnet (le modèle
// CHER) alors qu'elle ne l'avait pas demandé — évite un pic de facture silencieux si un
// modèle gratuit/pas cher tombe en panne (recommandation audit coûts, 17 juil 2026).
let lastFallbackAlert = 0;
async function alertExpensiveFallback(requested: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
    if (!token || !chatId) return;
    const now = Date.now();
    if (now - lastFallbackAlert < 3_600_000) return; // anti-spam : max 1 alerte / heure
    lastFallbackAlert = now;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ IA en mode secours CHER (Sonnet) : le modèle « ${requested} » a échoué. Ça peut faire monter la facture si ça dure — à surveiller.`,
        disable_web_page_preview: true,
      }),
    });
  } catch {
    /* ne JAMAIS bloquer une réponse IA à cause d'une alerte */
  }
}

/**
 * Génère du texte via OpenRouter avec une chaîne de secours SÉCURITAIRE.
 * Le modèle est choisi par l'appelant (params.model). S'il échoue (indispo, rate limit…) :
 *   - un modèle GRATUIT/autre retombe d'abord sur DeepSeek (fiable, des cennes) ;
 *   - Sonnet (CHER) n'est utilisé qu'en TOUT DERNIER recours, et déclenche une alerte Telegram.
 * On ne retombe donc JAMAIS silencieusement sur Sonnet (l'ancien piège de facture).
 * Retourne le texte (string), déjà trimmé.
 */
export async function generateText(params: GenParams): Promise<string> {
  const run = async (model: string): Promise<string> => {
    const res = await aiClient.messages.create({
      model,
      max_tokens: params.max_tokens,
      ...(params.system ? { system: params.system } : {}),
      messages: params.messages,
    });
    const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return (block?.text || "").trim();
  };

  const requested = params.model;
  const chain: string[] = [requested];
  // Modèle gratuit ou inconnu → on ajoute DeepSeek (fiable, pas cher) AVANT tout recours cher.
  if (requested !== MODELS.FAST && requested !== MODELS.BALANCED && requested !== MODELS.SMART) {
    chain.push(MODELS.FAST);
  }
  // Sonnet (cher) seulement en dernier recours, si l'appelant ne l'avait pas déjà demandé.
  if (requested !== MODELS.SMART) chain.push(MODELS.SMART);

  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    if (model === MODELS.SMART && requested !== MODELS.SMART) {
      void alertExpensiveFallback(requested); // secours cher NON demandé → on prévient Melynda
    }
    try {
      return await run(model);
    } catch (e) {
      lastErr = e;
      console.error(`[ai] modèle "${model}" a échoué${i < chain.length - 1 ? " — fallback suivant" : ""}:`, e);
    }
  }
  throw lastErr;
}
