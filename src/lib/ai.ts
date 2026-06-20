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
  // Tâches simples: classification, réponses courtes (~0.14$/MTok via DeepSeek)
  FAST: "deepseek/deepseek-chat",

  // Tâches moyennes: conversations clients, analyse emails (~0.14$/MTok via DeepSeek)
  BALANCED: "deepseek/deepseek-chat",

  // Tâches complexes: Figaro, raisonnement profond (Claude Sonnet routé via OpenRouter)
  SMART: "anthropic/claude-sonnet-4-6",
} as const;

type GenParams = {
  model: string;
  max_tokens: number;
  messages: Anthropic.MessageParam[];
  system?: string;
};

/**
 * Génère du texte via OpenRouter AVEC FALLBACK automatique sur Sonnet.
 * Le meilleur modèle est choisi par l'appelant (params.model) ; si ce modèle
 * échoue (modèle indisponible, erreur OpenRouter, rate limit…), on réessaie UNE
 * fois avec MODELS.SMART (Claude Sonnet) pour ne JAMAIS laisser une tâche IA
 * tomber complètement. Retourne le texte (string), déjà trimmé.
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

  try {
    return await run(params.model);
  } catch (e) {
    console.error(`[ai] modèle "${params.model}" a échoué — fallback Sonnet:`, e);
    if (params.model === MODELS.SMART) throw e; // déjà Sonnet : rien de mieux en réserve
    return await run(MODELS.SMART); // si ça throw aussi, l'appelant gère
  }
}
