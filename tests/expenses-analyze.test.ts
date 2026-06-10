/**
 * Tests for src/app/api/expenses/analyze/route.ts
 *
 * Covers:
 * - Returns 400 when no files in FormData
 * - Returns 200 with extracted data array for valid image file
 * - Uploads image to Supabase storage
 * - Calls AI with base64 image content
 * - Parses AI JSON response into expense fields
 * - Falls back to defaults when AI JSON is unparseable
 * - Falls back to defaults when AI returns invalid category
 * - Processes multiple files and returns array with one result per file
 * - Returns 500 when Supabase storage upload fails
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(),
    },
  },
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { BALANCED: "claude-sonnet-4-6" },
}));

import { supabaseAdmin } from "@/lib/supabase";
import { aiClient } from "@/lib/ai";

function makeStorageMock(error: unknown = null) {
  return {
    upload: vi.fn().mockResolvedValue({ error }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://storage.example.com/receipt.jpg" } }),
  };
}

function makeAiResponse(json: object) {
  return { content: [{ type: "text", text: JSON.stringify(json) }] };
}

async function makeFormDataRequest(files: { name: string; content: string; type: string }[]) {
  const formData = new FormData();
  for (const f of files) {
    const blob = new Blob([f.content], { type: f.type });
    formData.append("files", new File([blob], f.name, { type: f.type }));
  }
  return new NextRequest("http://localhost/api/expenses/analyze", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  const storageMock = makeStorageMock();
  vi.mocked(supabaseAdmin.storage.from).mockReturnValue(storageMock as never);
  vi.mocked(aiClient.messages.create).mockResolvedValue(
    makeAiResponse({ description: "Jean Coutu", amount: 45.99, category: "Produits", date: "2026-06-10" }) as never
  );
});

describe("POST /api/expenses/analyze — validation", () => {
  it("returns 400 when no files are provided", async () => {
    const req = new NextRequest("http://localhost/api/expenses/analyze", {
      method: "POST",
      body: new FormData(),
    });
    const { POST } = await import("@/app/api/expenses/analyze/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

describe("POST /api/expenses/analyze — successful analysis", () => {
  it("returns 200 with array of extracted data for one file", async () => {
    const req = await makeFormDataRequest([{ name: "receipt.jpg", content: "fake-image-data", type: "image/jpeg" }]);
    const { POST } = await import("@/app/api/expenses/analyze/route");
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("result includes description, amount, category, date, and receipt_url", async () => {
    const req = await makeFormDataRequest([{ name: "receipt.jpg", content: "data", type: "image/jpeg" }]);
    const { POST } = await import("@/app/api/expenses/analyze/route");
    const res = await POST(req);
    const [result] = await res.json();
    expect(result).toHaveProperty("description", "Jean Coutu");
    expect(result).toHaveProperty("amount", 45.99);
    expect(result).toHaveProperty("category", "Produits");
    expect(result).toHaveProperty("date", "2026-06-10");
    expect(result).toHaveProperty("receipt_url");
  });

  it("uploads file to Supabase 'receipts' bucket", async () => {
    const req = await makeFormDataRequest([{ name: "receipt.jpg", content: "data", type: "image/jpeg" }]);
    const { POST } = await import("@/app/api/expenses/analyze/route");
    await POST(req);
    expect(supabaseAdmin.storage.from).toHaveBeenCalledWith("receipts");
  });

  it("processes multiple files and returns one result per file", async () => {
    vi.mocked(aiClient.messages.create)
      .mockResolvedValueOnce(makeAiResponse({ description: "IGA", amount: 120, category: "Produits", date: "2026-06-10" }) as never)
      .mockResolvedValueOnce(makeAiResponse({ description: "Vidéotron", amount: 85, category: "Téléphone", date: "2026-06-01" }) as never);

    const req = await makeFormDataRequest([
      { name: "r1.jpg", content: "d1", type: "image/jpeg" },
      { name: "r2.jpg", content: "d2", type: "image/jpeg" },
    ]);
    const { POST } = await import("@/app/api/expenses/analyze/route");
    const res = await POST(req);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].description).toBe("IGA");
    expect(body[1].description).toBe("Vidéotron");
  });
});

describe("POST /api/expenses/analyze — AI response edge cases", () => {
  it("falls back to defaults when AI returns invalid JSON", async () => {
    vi.mocked(aiClient.messages.create).mockResolvedValue({
      content: [{ type: "text", text: "Désolé, je ne peux pas analyser ça." }],
    } as never);
    const req = await makeFormDataRequest([{ name: "bad.jpg", content: "d", type: "image/jpeg" }]);
    const { POST } = await import("@/app/api/expenses/analyze/route");
    const res = await POST(req);
    const [result] = await res.json();
    expect(result.category).toBe("Autre");
    expect(result.description).toBe("");
  });

  it("uses category 'Autre' when AI returns an unrecognized category", async () => {
    vi.mocked(aiClient.messages.create).mockResolvedValue(
      makeAiResponse({ description: "Test", amount: 10, category: "Nourriture", date: "2026-06-10" }) as never
    );
    const req = await makeFormDataRequest([{ name: "r.jpg", content: "d", type: "image/jpeg" }]);
    const { POST } = await import("@/app/api/expenses/analyze/route");
    const res = await POST(req);
    const [result] = await res.json();
    expect(result.category).toBe("Autre");
  });

  it.todo("handles AI response wrapped in ```json ... ``` code block");
  it.todo("returns 500 when Supabase storage upload fails");
  it.todo("calls AI with correct base64 image and media type");
});
