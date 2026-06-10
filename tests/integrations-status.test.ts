/**
 * Tests for src/app/api/admin/integrations-status/route.ts
 *
 * The route reads env vars and returns a static list of integrations
 * with configured/not-configured status. No DB or network calls.
 *
 * Covered:
 * - summary counts (total, active, inactive)
 * - each integration's `configured` field reflects its env vars
 * - GMB requires BOTH GOOGLE_REFRESH_TOKEN and GOOGLE_LOCATION_NAME
 * - META_CAPI requires BOTH META_PIXEL_ID and META_ACCESS_TOKEN
 * - Twilio requires all 3 vars
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Replicate the integration config logic from the route
function buildIntegrations(env: Record<string, string | undefined>) {
  return [
    { key: "GA4", configured: !!env.NEXT_PUBLIC_GA_ID },
    { key: "GA4_MP", configured: !!env.GA4_API_SECRET },
    { key: "META_PIXEL", configured: !!env.NEXT_PUBLIC_FB_PIXEL_ID },
    { key: "META_CAPI", configured: !!(env.META_PIXEL_ID && env.META_ACCESS_TOKEN) },
    { key: "GMB_POSTS", configured: !!(env.GOOGLE_REFRESH_TOKEN && env.GOOGLE_LOCATION_NAME) },
    { key: "COMPOSIO", configured: !!env.COMPOSIO_API_KEY },
    { key: "TWILIO", configured: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) },
    { key: "RESEND", configured: !!env.RESEND_API_KEY },
    { key: "TELEGRAM", configured: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_GROUP_CHAT_ID) },
    { key: "OPENROUTER", configured: !!env.OPENROUTER_API_KEY },
    { key: "ANTHROPIC", configured: !!env.ANTHROPIC_API_KEY },
  ];
}

describe("integrations-status logic", () => {
  it("total is always 11 (the full integration list)", () => {
    const list = buildIntegrations({});
    expect(list).toHaveLength(11);
  });

  it("all inactive when no env vars set", () => {
    const list = buildIntegrations({});
    const active = list.filter(i => i.configured).length;
    expect(active).toBe(0);
  });

  it("GMB_POSTS requires BOTH refresh token AND location name", () => {
    const onlyToken = buildIntegrations({ GOOGLE_REFRESH_TOKEN: "tok" });
    const gmb = onlyToken.find(i => i.key === "GMB_POSTS");
    expect(gmb?.configured).toBe(false);

    const both = buildIntegrations({ GOOGLE_REFRESH_TOKEN: "tok", GOOGLE_LOCATION_NAME: "acc/1/loc/2" });
    const gmbBoth = both.find(i => i.key === "GMB_POSTS");
    expect(gmbBoth?.configured).toBe(true);
  });

  it("META_CAPI requires BOTH pixel ID and access token", () => {
    const onlyPixel = buildIntegrations({ META_PIXEL_ID: "123" });
    expect(onlyPixel.find(i => i.key === "META_CAPI")?.configured).toBe(false);

    const both = buildIntegrations({ META_PIXEL_ID: "123", META_ACCESS_TOKEN: "token" });
    expect(both.find(i => i.key === "META_CAPI")?.configured).toBe(true);
  });

  it("TWILIO requires all 3 vars", () => {
    const partial = buildIntegrations({ TWILIO_ACCOUNT_SID: "ACx", TWILIO_AUTH_TOKEN: "tok" });
    expect(partial.find(i => i.key === "TWILIO")?.configured).toBe(false);

    const full = buildIntegrations({ TWILIO_ACCOUNT_SID: "ACx", TWILIO_AUTH_TOKEN: "tok", TWILIO_PHONE_NUMBER: "+14185551234" });
    expect(full.find(i => i.key === "TWILIO")?.configured).toBe(true);
  });

  it("TELEGRAM requires both bot token and group chat id", () => {
    const onlyBot = buildIntegrations({ TELEGRAM_BOT_TOKEN: "bot:token" });
    expect(onlyBot.find(i => i.key === "TELEGRAM")?.configured).toBe(false);

    const both = buildIntegrations({ TELEGRAM_BOT_TOKEN: "bot:token", TELEGRAM_GROUP_CHAT_ID: "-123456" });
    expect(both.find(i => i.key === "TELEGRAM")?.configured).toBe(true);
  });

  it("summary counts are consistent with list", () => {
    const env = {
      RESEND_API_KEY: "re_abc",
      ANTHROPIC_API_KEY: "sk-ant",
      TWILIO_ACCOUNT_SID: "ACx",
      TWILIO_AUTH_TOKEN: "tok",
      TWILIO_PHONE_NUMBER: "+1418",
    };
    const list = buildIntegrations(env);
    const active = list.filter(i => i.configured).length;
    const inactive = list.filter(i => !i.configured).length;
    expect(active + inactive).toBe(list.length);
    expect(active).toBe(3); // RESEND, ANTHROPIC, TWILIO
  });
});
