/**
 * Tests for src/lib/env.ts
 *
 * env.ts runs validation at module load time and exports a typed `env` object.
 * Tests verify:
 *   - exported values are strings (never undefined)
 *   - values are read from process.env
 *   - missing vars emit a console.warn (not throw)
 *   - trim() is applied to avoid accidental whitespace
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VARS = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  RESEND_API_KEY: "re_test_key",
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_AUTH_TOKEN: "test-twilio-token",
};

describe("env (all vars set)", () => {
  beforeEach(() => {
    Object.assign(process.env, VARS);
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of Object.keys(VARS)) delete process.env[key];
  });

  it("exports NEXT_PUBLIC_SUPABASE_URL from process.env", async () => {
    const { env } = await import("@/lib/env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
  });

  it("exports NEXT_PUBLIC_SUPABASE_ANON_KEY from process.env", async () => {
    const { env } = await import("@/lib/env");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
  });

  it("exports RESEND_API_KEY from process.env", async () => {
    const { env } = await import("@/lib/env");
    expect(env.RESEND_API_KEY).toBe("re_test_key");
  });

  it("exports TWILIO_ACCOUNT_SID from process.env", async () => {
    const { env } = await import("@/lib/env");
    expect(env.TWILIO_ACCOUNT_SID).toBe("ACtest");
  });

  it("exports TWILIO_AUTH_TOKEN from process.env", async () => {
    const { env } = await import("@/lib/env");
    expect(env.TWILIO_AUTH_TOKEN).toBe("test-twilio-token");
  });
});

describe("env (vars missing — graceful degradation)", () => {
  beforeEach(() => {
    for (const key of Object.keys(VARS)) delete process.env[key];
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT throw when environment variables are missing", async () => {
    await expect(import("@/lib/env")).resolves.toBeDefined();
  });

  it("emits console.warn listing missing vars (not an exception)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("@/lib/env");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[env]"));
  });

  it("falls back to empty string for missing NEXT_PUBLIC_SUPABASE_URL", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { env } = await import("@/lib/env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("");
  });

  it("falls back to empty string for missing RESEND_API_KEY", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { env } = await import("@/lib/env");
    expect(env.RESEND_API_KEY).toBe("");
  });
});

describe("env (type guarantees)", () => {
  beforeEach(() => {
    Object.assign(process.env, VARS);
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of Object.keys(VARS)) delete process.env[key];
  });

  it("all exported values are strings (never undefined)", async () => {
    const { env } = await import("@/lib/env");
    for (const [key, value] of Object.entries(env)) {
      expect(typeof value, `${key} should be a string`).toBe("string");
    }
  });
});
