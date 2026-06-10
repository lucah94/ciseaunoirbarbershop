import { describe, it, expect } from "vitest";
import { localDateStr, cn } from "@/lib/utils";

describe("localDateStr", () => {
  it("formats a date in YYYY-MM-DD local format", () => {
    const d = new Date(2026, 0, 5); // Jan 5 2026
    expect(localDateStr(d)).toBe("2026-01-05");
  });

  it("pads single-digit month", () => {
    const d = new Date(2026, 2, 3); // Mar 3 2026
    expect(localDateStr(d)).toBe("2026-03-03");
  });

  it("pads single-digit day", () => {
    const d = new Date(2026, 11, 9); // Dec 9 2026
    expect(localDateStr(d)).toBe("2026-12-09");
  });

  it("handles end of year", () => {
    const d = new Date(2025, 11, 31); // Dec 31 2025
    expect(localDateStr(d)).toBe("2025-12-31");
  });

  it("handles leap day", () => {
    const d = new Date(2024, 1, 29); // Feb 29 2024
    expect(localDateStr(d)).toBe("2024-02-29");
  });

  it("uses current date when no argument passed", () => {
    const result = localDateStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const today = new Date();
    expect(result).toBe(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    );
  });

  it("does not use UTC — local date is preserved", () => {
    // UTC midnight of 2026-06-24 could show 2026-06-23 in UTC-5,
    // but localDateStr must always return the LOCAL date.
    const d = new Date(2026, 5, 24, 0, 30); // Jun 24 local, 0:30am
    expect(localDateStr(d)).toBe("2026-06-24");
  });
});

// ─── cn() ─────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
    expect(cn("a", false as never, "b")).toBe("a b");
    expect(cn("a", null as never, "b")).toBe("a b");
  });

  it("resolves tailwind conflicts — last wins", () => {
    // tailwind-merge resolves p-4 p-2 → p-2
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("handles empty call", () => {
    expect(cn()).toBe("");
  });

  it("handles a single class", () => {
    expect(cn("font-bold")).toBe("font-bold");
  });

  it("supports conditional objects (clsx feature)", () => {
    expect(cn({ "bg-red-500": true, "bg-blue-500": false })).toBe("bg-red-500");
  });
});
