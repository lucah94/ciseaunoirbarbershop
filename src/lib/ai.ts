import Anthropic from "@anthropic-ai/sdk";

// TOUJOURS via OpenRouter — jamais d'appel direct à Anthropic (évite les charges surprises).
// Même si OPENROUTER_API_KEY manque, on garde le baseURL OpenRouter : au pire un appel échoue
// avec une erreur d'auth OpenRouter, mais on ne facture JAMAIS Anthropic en douce.
export const aiClient = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY ?? "missing-openrouter-key",
  baseURL: "https://openrouter.ai/api/v1",
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
