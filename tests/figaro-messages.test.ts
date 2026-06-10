/**
 * Tests for src/app/api/figaro/messages/route.ts
 *
 * Covers: admin auth guard, GET all messages ordered by created_at desc,
 * POST new message, Supabase errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockReturnValue(null),
}));

const makeGetRequest = () =>
  new NextRequest("http://localhost/api/figaro/messages");

describe("GET /api/figaro/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo("returns 401 when requireAdmin returns a denied response");

  it.todo("returns 200 with array of figaro_messages ordered newest first");

  it.todo("limits result to 100 messages");

  it.todo("returns 500 with error message when Supabase query fails");

  it.todo("returns empty array when no messages exist");
});

describe("POST /api/figaro/messages (if implemented)", () => {
  it.todo("returns 401 when requireAdmin returns a denied response");

  it.todo("inserts message with role and content into figaro_messages table");

  it.todo("returns 201 with the created message record");

  it.todo("returns 400 when message body is missing required fields");

  it.todo("returns 500 when Supabase insert fails");
});
