/**
 * Tests for src/app/api/figaro/generate/route.ts
 *
 * Covers:
 * - Returns 401 when admin cookie is absent
 * - Returns 400 when prompt is missing
 * - Calls AI client with MODELS.SMART and the hardcoded system prompt
 * - Returns parsed JSON { type, subject, body } when AI returns valid JSON
 * - Returns { type: "text", body: text } fallback when AI returns non-JSON
 * - type="sms" wraps prompt with SMS generation instruction
 * - type="email" wraps prompt with email generation instruction
 * - No type = passes prompt directly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { SMART: "claude-sonnet-4-6" },
}));

import { requireAdmin } from "@/lib/auth";
import { aiClient, MODELS } from "@/lib/ai";

function makeRequest(body: object, hasAdminCookie = true) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!hasAdminCookie) {
    vi.mocked(requireAdmin).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never
    );
  }
  return new Request("http://localhost/api/figaro/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function mockAiResponse(text: string) {
  vi.mocked(aiClient.messages.create).mockResolvedValueOnce({
    content: [{ type: "text", text }],
  } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAdmin).mockReturnValue(null);
  vi.mocked(aiClient.messages.create).mockResolvedValue({
    content: [{ type: "text", text: '{"type":"text","body":"ok"}' }],
  } as never);
});

describe("POST /api/figaro/generate — auth", () => {
  it("returns 401 when admin cookie is absent", async () => {
    vi.mocked(requireAdmin).mockReturnValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never
    );
    const { POST } = await import("@/app/api/figaro/generate/route");
    const req = makeRequest({ prompt: "test" }, false);
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/figaro/generate — validation", () => {
  it("returns 400 when prompt is missing from body", async () => {
    const { POST } = await import("@/app/api/figaro/generate/route");
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/figaro/generate — AI responses", () => {
  it("parses and returns JSON { type, subject, body } when AI returns valid email JSON", async () => {
    mockAiResponse('{"type":"email","subject":"Promo été","body":"Bonjour!"}');
    const { POST } = await import("@/app/api/figaro/generate/route");
    const res = await POST(makeRequest({ prompt: "promo été", type: "email" }) as never);
    const json = await res.json();
    expect(json).toEqual({ type: "email", subject: "Promo été", body: "Bonjour!" });
  });

  it("returns { type: 'text', body } fallback when AI returns non-JSON plain text", async () => {
    mockAiResponse("Voici votre contenu marketing.");
    const { POST } = await import("@/app/api/figaro/generate/route");
    const res = await POST(makeRequest({ prompt: "test" }) as never);
    const json = await res.json();
    expect(json.type).toBe("text");
    expect(json.body).toBe("Voici votre contenu marketing.");
  });

  it("calls AI with MODELS.SMART model", async () => {
    mockAiResponse('{"type":"sms","body":"Bonjour!"}');
    const { POST } = await import("@/app/api/figaro/generate/route");
    await POST(makeRequest({ prompt: "promo", type: "sms" }) as never);
    expect(aiClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: MODELS.SMART })
    );
  });

  it.todo("wraps prompt with 'Génère un SMS pour :' when type=sms");
  it.todo("wraps prompt with 'Génère un email pour :' when type=email");
  it.todo("passes prompt directly when no type is specified");
  it.todo("returns 500 when AI client throws");
});
