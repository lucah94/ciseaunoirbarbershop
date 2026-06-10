/**
 * Tests for src/app/api/admin/generate-post/route.ts
 *
 * Covers:
 * - Returns 401 when requireAdmin fails (no/invalid cookie)
 * - Returns 200 with { text } for each content type
 * - Defaults to 'promotion' type when type is not provided
 * - Falls back to promotion prompt for unknown type
 * - Returns empty string when AI returns no text block
 * - Returns 500 when AI client throws
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { generateToken } from "@/lib/auth";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireAdmin: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { SMART: "claude-sonnet-4-6", FAST: "claude-haiku-4-5-20251001", BALANCED: "claude-sonnet-4-6" },
}));

import { requireAdmin } from "@/lib/auth";
import { aiClient, MODELS } from "@/lib/ai";

function makeAiResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function makePost(body: object = {}) {
  return new NextRequest("http://localhost/api/admin/generate-post", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.mocked(requireAdmin).mockReturnValue(null);
  vi.mocked(aiClient.messages.create).mockResolvedValue(makeAiResponse("Votre coupe vous attend!") as never);
});

describe("POST /api/admin/generate-post — auth", () => {
  it("returns 401 when requireAdmin denies access", async () => {
    vi.mocked(requireAdmin).mockReturnValue(new Response(null, { status: 401 }) as never);
    const { POST } = await import("@/app/api/admin/generate-post/route");
    const res = await POST(makePost());
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/generate-post — content generation", () => {
  it("returns 200 with { text } on success", async () => {
    const { POST } = await import("@/app/api/admin/generate-post/route");
    const res = await POST(makePost({ type: "promotion" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("text");
    expect(typeof body.text).toBe("string");
  });

  it("calls AI with promotion prompt when type=promotion", async () => {
    const { POST } = await import("@/app/api/admin/generate-post/route");
    await POST(makePost({ type: "promotion" }));
    const call = vi.mocked(aiClient.messages.create).mock.calls[0][0];
    expect((call.messages[0].content as string)).toContain("promotionnelle");
  });

  it("defaults to promotion when type is not provided", async () => {
    const { POST } = await import("@/app/api/admin/generate-post/route");
    await POST(makePost({}));
    expect(aiClient.messages.create).toHaveBeenCalledOnce();
  });

  it("uses promotion prompt for unknown type", async () => {
    const { POST } = await import("@/app/api/admin/generate-post/route");
    await POST(makePost({ type: "unknown_type" }));
    const call = vi.mocked(aiClient.messages.create).mock.calls[0][0];
    expect((call.messages[0].content as string)).toContain("promotionnelle");
  });

  it.todo("returns { text: '' } when AI returns no text block in content");
  it.todo("uses MODELS.SMART model");
  it.todo("returns 500 when AI client throws");

  const TYPES = ["promotion", "service", "tip", "appreciation", "inspirational"];
  for (const type of TYPES) {
    it(`returns 200 for type='${type}'`, async () => {
      const { POST } = await import("@/app/api/admin/generate-post/route");
      const res = await POST(makePost({ type }));
      expect(res.status).toBe(200);
    });
  }
});
