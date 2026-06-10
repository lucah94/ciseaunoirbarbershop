/**
 * Tests for src/app/api/telegram/webhook/route.ts
 *
 * The webhook handles three message types:
 * 1. Text messages from allowed chats → AI intent routing (haiku vs sonnet)
 * 2. Callback queries (✅/❌ email approval buttons)
 * 3. Bot mention stripping in group chats
 *
 * Pure logic helpers (needsSonnet, stripBotMention, extractGmailMeta) are
 * tested directly without importing the route. Route-level tests mock fetch
 * (Telegram API) and AI client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/gmail", () => ({
  sendGmailReply: vi.fn().mockResolvedValue(undefined),
  archiveEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sms", () => ({
  sendSMS: vi.fn().mockResolvedValue(undefined),
  formatPhone: vi.fn((p: string) => p),
}));
vi.mock("@/lib/ai", () => ({
  aiClient: { messages: { create: vi.fn() } },
  MODELS: { FAST: "haiku", BALANCED: "sonnet" },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── needsSonnet (pure logic) ──────────────────────────────────────────────

describe("needsSonnet", () => {
  it.todo("returns true for messages containing 'crée' or 'réserve'");

  it.todo("returns true for messages over 200 characters");

  it.todo("returns false for short simple messages like 'RDV de demain'");

  it.todo("returns true for messages containing 'analys' or 'conseil'");
});

// ─── stripBotMention (pure logic) ─────────────────────────────────────────

describe("stripBotMention", () => {
  it.todo("removes @Username prefix from group messages");

  it.todo("leaves messages without @ prefix unchanged");

  it.todo("trims leading whitespace after mention removal");
});

// ─── extractGmailMeta (pure logic) ────────────────────────────────────────

describe("extractGmailMeta", () => {
  it.todo("parses gmail_id, thread_id and subject from JSON prefix before |||");

  it.todo("returns empty strings when message has no ||| separator");

  it.todo("returns empty strings when JSON parse fails");
});

// ─── POST handler — auth ───────────────────────────────────────────────────

describe("POST /api/telegram/webhook — auth", () => {
  it.todo("returns 403 when TELEGRAM_SECRET_TOKEN header is present but wrong");

  it.todo("returns 200 when TELEGRAM_SECRET_TOKEN is not configured (skip token check)");

  it.todo("processes message when correct secret token is provided");
});

// ─── POST handler — unknown chat ───────────────────────────────────────────

describe("POST /api/telegram/webhook — unknown chat", () => {
  it.todo("ignores messages from chats not matching TELEGRAM_CHAT_ID");

  it.todo("returns 200 silently for messages from unknown chats");
});

// ─── POST handler — text messages ─────────────────────────────────────────

describe("POST /api/telegram/webhook — text messages", () => {
  it.todo("calls AI with haiku model when needsSonnet returns false");

  it.todo("calls AI with sonnet model when needsSonnet returns true");

  it.todo("sends AI response back via sendTelegramMessage");

  it.todo("handles AI client error gracefully without crashing the handler");
});

// ─── POST handler — callback queries (email approval) ─────────────────────

describe("POST /api/telegram/webhook — callback queries", () => {
  it.todo("calls answerCallbackQuery to dismiss the Telegram spinner");

  it.todo("sends Gmail reply and archives when callback_data starts with 'reply_'");

  it.todo("archives email without reply when callback_data starts with 'archive_'");

  it.todo("sends rejection Telegram message when callback_data starts with 'reject_'");

  it.todo("edits original Telegram message to show action taken");
});

// ─── POST handler — booking queries ───────────────────────────────────────

describe("POST /api/telegram/webhook — booking queries", () => {
  it.todo("queries Supabase bookings when message contains 'RDV'");

  it.todo("formats booking list with date, time, client name and service");

  it.todo("replies 'aucun RDV' when no bookings found for the requested date");
});
