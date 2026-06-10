/**
 * Tests for src/app/api/cron/check-reminders/route.ts
 *
 * Covers:
 * - Auth: accepts valid CRON_SECRET via header OR query param key=
 * - Auth: returns 401 when CRON_SECRET is set and neither matches
 * - Fetches due reminders (done=false, remind_at <= now, snoozed_until <= now or null)
 * - Sends Telegram message with ✅/⏰/❌ inline buttons per reminder
 * - Marks each sent reminder as done=true in DB
 * - Returns { sent: 0 } when no reminders are due
 * - Returns 500 when Supabase query fails
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe("GET /api/cron/check-reminders — auth", () => {
  it.todo("returns 401 when CRON_SECRET is set and Authorization header is missing");
  it.todo("accepts valid secret via Authorization Bearer header");
  it.todo("accepts valid secret via ?key= query param");
  it.todo("accepts valid secret via ?secret= query param");
  it.todo("allows all requests when CRON_SECRET env is not set");
});

describe("GET /api/cron/check-reminders — no reminders", () => {
  it.todo("returns { sent: 0 } when no reminders are due");
  it.todo("does not call Telegram API when no reminders are due");
});

describe("GET /api/cron/check-reminders — sends reminders", () => {
  it.todo("calls Telegram sendMessage for each due reminder");
  it.todo("Telegram message contains reminder.message text");
  it.todo("Telegram inline keyboard has done_, snooze30_, cancel_ buttons");
  it.todo("marks each reminder as done=true after sending");
  it.todo("returns { sent: N } equal to number of reminders processed");
  it.todo("continues processing remaining reminders when one Telegram send fails");
});

describe("GET /api/cron/check-reminders — errors", () => {
  it.todo("returns 500 when Supabase query fails");
});
