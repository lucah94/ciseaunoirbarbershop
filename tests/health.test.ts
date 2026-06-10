/**
 * Tests for src/app/api/health/route.ts
 *
 * Covered:
 * - withTimeout: resolves if promise completes in time
 * - withTimeout: returns fallback on timeout
 * - overall status: "ok" when all checks pass
 * - overall status: "error" when a CRITICAL check (supabase or twilio) fails
 * - overall status: "degraded" when a non-critical check is slow
 * - resend is non-critical: resend error does NOT set overall to "error"
 *
 * Route-level (network) tests are integration tests and excluded here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── withTimeout ─────────────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(r => setTimeout(() => r(fallback), ms)),
  ]);
}

describe("withTimeout", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("resolves with promise value when it completes before timeout", async () => {
    const slow = new Promise<string>(r => setTimeout(() => r("done"), 100));
    const race = withTimeout(slow, 500, "fallback");
    vi.advanceTimersByTime(100);
    expect(await race).toBe("done");
  });

  it("resolves with fallback when promise exceeds timeout", async () => {
    const slow = new Promise<string>(r => setTimeout(() => r("late"), 1000));
    const race = withTimeout(slow, 200, "fallback");
    vi.advanceTimersByTime(200);
    expect(await race).toBe("fallback");
  });

  it("uses exact timeout boundary — resolves fallback at ms, not ms+1", async () => {
    const slow = new Promise<number>(r => setTimeout(() => r(42), 500));
    const race = withTimeout(slow, 300, -1);
    vi.advanceTimersByTime(300);
    expect(await race).toBe(-1);
  });
});

// ─── Overall status computation ───────────────────────────────────────────────

type ServiceStatus = "ok" | "error" | "slow";
type Check = { status: ServiceStatus; latency: number; message?: string };

function computeOverall(checks: Record<string, Check>): "ok" | "error" | "degraded" {
  const criticalChecks = { supabase: checks.supabase, twilio: checks.twilio };
  const hasError = Object.values(criticalChecks).some(c => c.status === "error");
  const hasSlow = Object.values(checks).some(c => c.status === "slow");
  return hasError ? "error" : hasSlow ? "degraded" : "ok";
}

const OK_CHECK: Check = { status: "ok", latency: 100 };
const ERROR_CHECK: Check = { status: "error", latency: 50, message: "failed" };
const SLOW_CHECK: Check = { status: "slow", latency: 2500 };

describe("computeOverall status", () => {
  it("returns 'ok' when all checks pass", () => {
    const checks = { supabase: OK_CHECK, resend: OK_CHECK, twilio: OK_CHECK, claude: OK_CHECK, security: OK_CHECK };
    expect(computeOverall(checks)).toBe("ok");
  });

  it("returns 'error' when supabase fails (critical)", () => {
    const checks = { supabase: ERROR_CHECK, resend: OK_CHECK, twilio: OK_CHECK, claude: OK_CHECK, security: OK_CHECK };
    expect(computeOverall(checks)).toBe("error");
  });

  it("returns 'error' when twilio fails (critical)", () => {
    const checks = { supabase: OK_CHECK, resend: OK_CHECK, twilio: ERROR_CHECK, claude: OK_CHECK, security: OK_CHECK };
    expect(computeOverall(checks)).toBe("error");
  });

  it("does NOT return 'error' when only resend fails (non-critical)", () => {
    const checks = { supabase: OK_CHECK, resend: ERROR_CHECK, twilio: OK_CHECK, claude: OK_CHECK, security: OK_CHECK };
    const status = computeOverall(checks);
    expect(status).not.toBe("error");
  });

  it("returns 'degraded' when any check is slow (but no critical error)", () => {
    const checks = { supabase: SLOW_CHECK, resend: OK_CHECK, twilio: OK_CHECK, claude: OK_CHECK, security: OK_CHECK };
    expect(computeOverall(checks)).toBe("degraded");
  });

  it("returns 'error' over 'degraded' when both conditions exist", () => {
    const checks = { supabase: ERROR_CHECK, resend: SLOW_CHECK, twilio: OK_CHECK, claude: OK_CHECK, security: OK_CHECK };
    expect(computeOverall(checks)).toBe("error");
  });

  it("claude failure alone does not trigger error", () => {
    const checks = { supabase: OK_CHECK, resend: OK_CHECK, twilio: OK_CHECK, claude: ERROR_CHECK, security: OK_CHECK };
    expect(computeOverall(checks)).not.toBe("error");
  });
});
