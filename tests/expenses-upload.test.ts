/**
 * Tests for src/app/api/expenses/upload/route.ts
 *
 * Covers: missing file guard, Supabase Storage upload, public URL generation,
 * filename collision avoidance, content-type propagation, upload errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://cdn.example.com/receipt.jpg" } }),
      }),
    },
  },
}));

function makeMultipartRequest(file?: { name: string; type: string; content: string }) {
  const formData = new FormData();
  if (file) {
    const blob = new Blob([file.content], { type: file.type });
    formData.append("file", blob, file.name);
  }
  return new NextRequest("http://localhost/api/expenses/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/expenses/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo("returns 400 when 'file' field is missing from FormData");

  it.todo("uploads file to 'receipts' Supabase Storage bucket");

  it.todo("uses file extension from original filename in the stored path");

  it.todo("uses .jpg extension as fallback when filename has no extension");

  it.todo("returns 200 JSON { url: publicUrl } on successful upload");

  it.todo("generates unique filename to prevent collisions (includes timestamp)");

  it.todo("passes correct contentType to Supabase storage upload");

  it.todo("returns 500 with error message when Supabase upload returns error");

  it.todo("sets upsert: false to prevent overwriting existing receipts");
});
