import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeEmail, normalizePhone, hasClientReturnedSince } from "@/lib/client-dedupe";
import { supabaseAdmin } from "@/lib/supabase";

// vi.mock is hoisted before imports, so supabaseAdmin will be the mock
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  TEST@EXAMPLE.COM  ")).toBe("test@example.com");
  });

  it("returns null for null input", () => {
    expect(normalizeEmail(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeEmail(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeEmail("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("returns null for string without @", () => {
    expect(normalizeEmail("notanemail")).toBeNull();
  });

  it("preserves valid email with subdomain", () => {
    expect(normalizeEmail("User@Sub.Domain.com")).toBe("user@sub.domain.com");
  });

  it("returns '@' for bare @ (documents edge case in current implementation)", () => {
    // "@".includes("@") is true, trimmed length > 0 → implementation returns "@"
    expect(normalizeEmail("@")).toBe("@");
  });
});

describe("normalizePhone", () => {
  it("returns last 10 digits for a 10-digit number", () => {
    expect(normalizePhone("4186655703")).toBe("4186655703");
  });

  it("strips formatting characters", () => {
    expect(normalizePhone("(418) 665-5703")).toBe("4186655703");
  });

  it("strips +1 country code for 11-digit numbers", () => {
    expect(normalizePhone("+14186655703")).toBe("4186655703");
  });

  it("returns null for less than 10 digits", () => {
    expect(normalizePhone("123456")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("handles dots and spaces", () => {
    expect(normalizePhone("418.665.5703")).toBe("4186655703");
  });

  it("handles 12-digit numbers — takes last 10", () => {
    expect(normalizePhone("011234567890")).toBe("1234567890");
  });
});

describe("hasClientReturnedSince", () => {
  const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

  function mockChain(rows: object[]) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: rows }),
    };
    mockFrom.mockReturnValue(chain);
    return chain;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when both phone and email are null", async () => {
    const result = await hasClientReturnedSince(null, null, "2026-01-01");
    expect(result).toBe(false);
  });

  it("returns true when a booking matches by phone", async () => {
    mockChain([{ client_phone: "4186655703", client_email: null, client_name: "Jean" }]);
    const result = await hasClientReturnedSince("4186655703", null, "2026-01-01");
    expect(result).toBe(true);
  });

  it("returns true when a booking matches by email", async () => {
    mockChain([{ client_phone: null, client_email: "jean@example.com", client_name: "Jean" }]);
    const result = await hasClientReturnedSince(null, "jean@example.com", "2026-01-01");
    expect(result).toBe(true);
  });

  it("returns true when a booking matches by name (case-insensitive)", async () => {
    mockChain([{ client_phone: null, client_email: null, client_name: "Jean Tremblay" }]);
    const result = await hasClientReturnedSince("0000000000", null, "2026-01-01", "JEAN TREMBLAY");
    expect(result).toBe(true);
  });

  it("returns false when no bookings match", async () => {
    mockChain([{ client_phone: "5140000000", client_email: "other@example.com", client_name: "Other" }]);
    const result = await hasClientReturnedSince("4186655703", "jean@example.com", "2026-01-01");
    expect(result).toBe(false);
  });

  it("returns false when data is empty", async () => {
    mockChain([]);
    const result = await hasClientReturnedSince("4186655703", null, "2026-01-01");
    expect(result).toBe(false);
  });

  it("normalises phone formats before comparing", async () => {
    mockChain([{ client_phone: "(418) 665-5703", client_email: null, client_name: "Test" }]);
    const result = await hasClientReturnedSince("+14186655703", null, "2026-01-01");
    expect(result).toBe(true);
  });
});
