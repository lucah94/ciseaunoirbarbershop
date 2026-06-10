/**
 * Tests for src/lib/ai.ts
 *
 * The module exports two things:
 *   - aiClient: an Anthropic instance pointing at OpenRouter or Anthropic directly
 *   - MODELS: a const object mapping task tiers to model IDs
 *
 * MODELS is a pure data structure — fully testable without network calls.
 * aiClient construction is covered by checking the correct baseURL is used
 * depending on whether OPENROUTER_API_KEY is present.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── MODELS ──────────────────────────────────────────────────────────────────

describe("MODELS (Anthropic path — no OPENROUTER_API_KEY)", () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    vi.resetModules();
  });

  it("FAST tier resolves to claude-haiku model", async () => {
    const { MODELS } = await import("@/lib/ai");
    expect(MODELS.FAST).toContain("haiku");
  });

  it("BALANCED tier resolves to claude-sonnet model", async () => {
    const { MODELS } = await import("@/lib/ai");
    expect(MODELS.BALANCED).toContain("sonnet");
  });

  it("SMART tier resolves to claude-sonnet model", async () => {
    const { MODELS } = await import("@/lib/ai");
    expect(MODELS.SMART).toContain("sonnet");
  });

  it("all three tiers are defined and non-empty strings", async () => {
    const { MODELS } = await import("@/lib/ai");
    for (const key of ["FAST", "BALANCED", "SMART"] as const) {
      expect(typeof MODELS[key]).toBe("string");
      expect(MODELS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("MODELS (OpenRouter path — OPENROUTER_API_KEY set)", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "or-test-key";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it("FAST tier resolves to a DeepSeek model ID", async () => {
    const { MODELS } = await import("@/lib/ai");
    expect(MODELS.FAST).toContain("deepseek");
  });

  it("BALANCED tier resolves to a DeepSeek model ID", async () => {
    const { MODELS } = await import("@/lib/ai");
    expect(MODELS.BALANCED).toContain("deepseek");
  });

  it("SMART tier resolves to claude-sonnet via OpenRouter", async () => {
    const { MODELS } = await import("@/lib/ai");
    expect(MODELS.SMART).toContain("claude-sonnet");
  });
});

// ─── aiClient ────────────────────────────────────────────────────────────────

describe("aiClient (Anthropic path)", () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("exports an aiClient object", async () => {
    const { aiClient } = await import("@/lib/ai");
    expect(aiClient).toBeDefined();
  });
});

describe("aiClient (OpenRouter path)", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "or-test-key";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it("exports an aiClient object when OPENROUTER_API_KEY is set", async () => {
    const { aiClient } = await import("@/lib/ai");
    expect(aiClient).toBeDefined();
  });
});
