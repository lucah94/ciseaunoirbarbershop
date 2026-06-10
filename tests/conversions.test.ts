/**
 * Tests for src/lib/conversions.ts
 *
 * Covers: normalizePhoneE164() (exported), trackBookingConversion (no-op when env missing),
 * and fetch payload shape when Meta CAPI vars are set.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizePhoneE164, trackBookingConversion } from "@/lib/conversions";

// ─── normalizePhoneE164 ───────────────────────────────────────────────────────

describe("normalizePhoneE164", () => {
  it("returns +1XXXXXXXXXX for a 10-digit Canadian number", () => {
    expect(normalizePhoneE164("4186655703")).toBe("+14186655703");
  });

  it("returns +1XXXXXXXXXX for an 11-digit number starting with 1", () => {
    expect(normalizePhoneE164("14186655703")).toBe("+14186655703");
  });

  it("strips dashes and spaces before normalizing", () => {
    expect(normalizePhoneE164("418-665-5703")).toBe("+14186655703");
    expect(normalizePhoneE164("(418) 665-5703")).toBe("+14186655703");
  });

  it("returns empty string for null input", () => {
    expect(normalizePhoneE164(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(normalizePhoneE164(undefined)).toBe("");
  });

  it("preserves already-formatted +1 numbers (strips + then re-adds)", () => {
    const result = normalizePhoneE164("+14186655703");
    expect(result).toBe("+14186655703");
  });

  it("prefixes + for numbers that are not 10 or 11 digits", () => {
    expect(normalizePhoneE164("33612345678")).toBe("+33612345678");
  });
});

// ─── trackBookingConversion ───────────────────────────────────────────────────

const booking = {
  id: "uuid-1234",
  client_name: "Jean Tremblay",
  client_email: "jean@example.com",
  client_phone: "4186655703",
  price: 35,
  service: "Coupe classique",
};

describe("trackBookingConversion — env vars absent (no-op)", () => {
  beforeEach(() => {
    delete process.env.META_PIXEL_ID;
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.NEXT_PUBLIC_GA_ID;
    delete process.env.GA4_API_SECRET;
    delete process.env.GOOGLE_ADS_CONVERSION_ID;
    delete process.env.GOOGLE_ADS_CONVERSION_LABEL;
    delete process.env.GOOGLE_ADS_API_SECRET;
  });

  it("resolves without throwing when META_PIXEL_ID is not set", async () => {
    await expect(trackBookingConversion(booking)).resolves.toBeUndefined();
  });

  it("resolves without throwing when GA_ID is not set", async () => {
    await expect(trackBookingConversion(booking)).resolves.toBeUndefined();
  });

  it("resolves without throwing when GOOGLE_ADS_CONVERSION_ID is not set", async () => {
    await expect(trackBookingConversion(booking)).resolves.toBeUndefined();
  });

  it("does not call fetch when no tracking env vars are set", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response());
    await trackBookingConversion(booking);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("trackBookingConversion — Meta CAPI active", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.META_PIXEL_ID = "pixel-123";
    process.env.META_ACCESS_TOKEN = "meta-token-abc";
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
    );
  });

  afterEach(() => {
    delete process.env.META_PIXEL_ID;
    delete process.env.META_ACCESS_TOKEN;
    fetchSpy.mockRestore();
  });

  it("fires fetch to Meta CAPI events endpoint", async () => {
    await trackBookingConversion(booking);
    const call = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes("graph.facebook.com")
    );
    expect(call).toBeDefined();
  });

  it("sends event_name 'Schedule' to Meta CAPI", async () => {
    await trackBookingConversion(booking);
    const call = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes("graph.facebook.com")
    );
    expect(call).toBeDefined();
    const body = JSON.parse(call![1]?.body as string);
    expect(body.data[0].event_name).toBe("Schedule");
  });

  it("hashes client_email before sending to Meta (not plain text)", async () => {
    await trackBookingConversion(booking);
    const call = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes("graph.facebook.com")
    );
    const body = JSON.parse(call![1]?.body as string);
    const em = body.data[0].user_data.em[0];
    expect(em).not.toContain("@");
    expect(em).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes client_phone (normalized to E.164) before sending to Meta", async () => {
    await trackBookingConversion(booking);
    const call = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes("graph.facebook.com")
    );
    const body = JSON.parse(call![1]?.body as string);
    const ph = body.data[0].user_data.ph[0];
    expect(ph).not.toContain("4186655703");
    expect(ph).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses Promise.allSettled — one tracker failing does not reject the other", async () => {
    fetchSpy.mockRejectedValue(new Error("network failure"));
    await expect(trackBookingConversion(booking)).resolves.toBeUndefined();
  });

  it("skips client_email fields when client_email is null", async () => {
    await trackBookingConversion({ ...booking, client_email: null });
    const call = fetchSpy.mock.calls.find(([url]) =>
      String(url).includes("graph.facebook.com")
    );
    const body = JSON.parse(call![1]?.body as string);
    expect(body.data[0].user_data.em).toEqual([]);
  });
});
