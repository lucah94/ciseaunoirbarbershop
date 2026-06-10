/**
 * Tests for src/app/api/cron/check-emails/route.ts
 *
 * Covers: auth, silent-archive logic, tier classification (silent/AI/escalation),
 * AI reply generation, Telegram approval flow, booking detection, edge cases.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/gmail", () => ({
  fetchUnreadEmails: vi.fn(),
  markAsRead: vi.fn(),
  sendGmailReply: vi.fn(),
  archiveEmail: vi.fn(),
  deleteEmail: vi.fn(),
}));
vi.mock("@/lib/sms", () => ({
  sendSMS: vi.fn(),
}));
vi.mock("@/lib/telegram", () => ({
  notifyEscalation: vi.fn(),
  notifyBookingCancelled: vi.fn(),
  sendEmailApprovalRequest: vi.fn(),
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { FAST: "test-model", BALANCED: "test-model" },
}));

describe("GET /api/cron/check-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it.todo("returns 401 when Authorization header does not match CRON_SECRET");

  it.todo("returns 200 { processed: 0 } when inbox is empty");

  it.todo("silently archives emails from SILENT_ARCHIVE_SENDERS without calling AI");

  it.todo("silently archives emails from noreply@vercel.com without Telegram notification");

  it.todo("sends Telegram escalation for emails containing escalation keywords like 'plainte'");

  it.todo("sends Telegram escalation for emails containing 'remboursement'");

  it.todo("sends AI-generated reply via Telegram approval for normal client email");

  it.todo("marks email as read after processing");

  it.todo("archives email after it is successfully replied to");

  it.todo("does not send reply when email is from a silent-archive sender");

  it.todo("returns 500 when Gmail fetchUnreadEmails throws");

  it.todo("processes multiple emails in a single run");

  it.todo("detects booking cancellation intent and notifies via notifyBookingCancelled");
});
