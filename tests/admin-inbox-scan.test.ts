/**
 * Tests for src/app/api/admin/inbox-scan/route.ts
 *
 * Covers: auth, Gmail token fetch, metadata-only listing, returned email shape,
 * empty inbox, Gmail API errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/gmail", () => ({
  getGmailToken: vi.fn().mockResolvedValue("access-token"),
  fetchAllInboxEmails: vi.fn(),
}));

const makeRequest = (secret?: string) =>
  new NextRequest(`http://localhost/api/admin/inbox-scan${secret ? `?secret=${secret}` : ""}`);

describe("GET /api/admin/inbox-scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it.todo("returns 401 when secret query param does not match CRON_SECRET");

  it.todo("returns 200 with empty emails array when inbox has no messages");

  it.todo("returns 200 with array of { id, from, fromEmail, subject } objects");

  it.todo("fetches Gmail messages with maxResults=100 using metadata format");

  it.todo("extracts From and Subject headers from each message metadata");

  it.todo("parses fromEmail correctly from 'Name <email>' format");

  it.todo("returns 500 when getGmailToken throws");

  it.todo("returns 500 when Gmail messages list API returns error");

  it.todo("limits returned list to 100 messages");
});
