import Anthropic from "@anthropic-ai/sdk";

// OpenRouter si dispo, sinon Anthropic direct
const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

export const aiClient = useOpenRouter
  ? new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://ciseaunoirbarbershop.com",
        "X-Title": "Ciseau Noir",
      },
    })
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "placeholder-anthropic-key" });

// Dernier modèle pour chaque niveau — 1 seul endroit à changer
export const MODELS = {
  // Tâches simples: classification, réponses courtes, formulaires (~0.08$/MTok)
  FAST: useOpenRouter ? "anthropic/claude-haiku-4-5-20251001" : "claude-haiku-4-5-20251001",

  // Tâches moyennes: conversations clients, analyse dépenses, emails (~0.90$/MTok)
  BALANCED: useOpenRouter ? "anthropic/claude-sonnet-4-6" : "claude-sonnet-4-6",

  // Tâches complexes: Figaro, génération contenu, raisonnement profond (~7$/MTok)
  SMART: useOpenRouter ? "anthropic/claude-opus-4-7" : "claude-opus-4-7",
} as const;
