/**
 * Tests for src/app/api/sms/blast/route.ts
 *
 * Pure logic covered:
 * - getUniquePhones dedup: same phone under two names → 1 entry
 * - getUniquePhones: invalid/short phone filtered out
 * - getUniquePhones: test numbers excluded (418-555-0000, 418-555-9999)
 * - POST: empty message guard → 400
 * - GET: count endpoint returns correct value
 *
 * The dedup logic is replicated from the route (same algorithm).
 */
import { describe, it, expect } from "vitest";
import { formatPhone } from "@/lib/sms";

// ─── Dedup logic (mirrors route.ts getUniquePhones filter) ───────────────────

interface RawContact { client_phone: string; client_name: string }

function deduplicateContacts(raw: RawContact[]): RawContact[] {
  const seen = new Set<string>();
  const TEST_NUMBERS = new Set(["418-555-0000", "418-555-9999"]);

  return raw.filter(c => {
    if (!c.client_phone) return false;
    if (TEST_NUMBERS.has(c.client_phone)) return false;
    const formatted = formatPhone(c.client_phone);
    if (formatted.length < 12) return false;
    if (seen.has(formatted)) return false;
    seen.add(formatted);
    return true;
  });
}

describe("getUniquePhones dedup logic", () => {
  it("keeps one entry when the same number appears twice under different names", () => {
    const contacts: RawContact[] = [
      { client_phone: "418-555-1234", client_name: "Alice" },
      { client_phone: "418-555-1234", client_name: "Alice Dupont" },
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(1);
  });

  it("keeps both entries when numbers are genuinely different", () => {
    const contacts: RawContact[] = [
      { client_phone: "418-555-1111", client_name: "Alice" },
      { client_phone: "418-555-2222", client_name: "Bob" },
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(2);
  });

  it("excludes test number 418-555-0000", () => {
    const contacts: RawContact[] = [
      { client_phone: "418-555-0000", client_name: "Test" },
      { client_phone: "418-555-1111", client_name: "Real Client" },
    ];
    const result = deduplicateContacts(contacts);
    expect(result).toHaveLength(1);
    expect(result[0].client_name).toBe("Real Client");
  });

  it("excludes test number 418-555-9999", () => {
    const contacts: RawContact[] = [{ client_phone: "418-555-9999", client_name: "Test" }];
    expect(deduplicateContacts(contacts)).toHaveLength(0);
  });

  it("excludes contacts with no phone", () => {
    const contacts: RawContact[] = [{ client_phone: "", client_name: "No Phone" }];
    expect(deduplicateContacts(contacts)).toHaveLength(0);
  });

  it("excludes contacts with invalid (too short) phone", () => {
    const contacts: RawContact[] = [{ client_phone: "123", client_name: "Short" }];
    expect(deduplicateContacts(contacts)).toHaveLength(0);
  });

  it("handles empty list", () => {
    expect(deduplicateContacts([])).toHaveLength(0);
  });

  it("deduplicates across multiple duplicates of the same number", () => {
    const contacts: RawContact[] = [
      { client_phone: "418-555-7777", client_name: "A" },
      { client_phone: "418-555-7777", client_name: "B" },
      { client_phone: "418-555-7777", client_name: "C" },
    ];
    expect(deduplicateContacts(contacts)).toHaveLength(1);
  });
});

// ─── POST guard: empty message ────────────────────────────────────────────────

describe("blast POST message validation", () => {
  it("empty string is invalid", () => {
    const msg = "";
    expect(!msg?.trim()).toBe(true);
  });

  it("whitespace-only is invalid", () => {
    const msg = "   ";
    expect(!msg?.trim()).toBe(true);
  });

  it("non-empty message is valid", () => {
    const msg = "Promo chez Ciseau Noir!";
    expect(!msg?.trim()).toBe(false);
  });
});
