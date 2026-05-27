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
  // Tâches simples: classification, réponses courtes (~0.14$/MTok via DeepSeek)
  FAST: useOpenRouter ? "deepseek/deepseek-chat" : "claude-haiku-4-5-20251001",

  // Tâches moyennes: conversations clients, analyse emails (~0.14$/MTok via DeepSeek)
  BALANCED: useOpenRouter ? "deepseek/deepseek-chat" : "claude-sonnet-4-6",

  // Tâches complexes: Figaro, raisonnement profond (~3$/MTok Claude Sonnet via OpenRouter)
  SMART: useOpenRouter ? "anthropic/claude-sonnet-4-6" : "claude-sonnet-4-6",
} as const;
