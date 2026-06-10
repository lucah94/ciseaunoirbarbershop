/**
 * Tests for src/lib/translations.ts and src/lib/language-context.tsx
 *
 * Validates:
 * - Every translation key has both 'fr' and 'en' values (non-empty strings)
 * - The t() lookup function returns the right value per language
 * - Unknown keys fall back to the key itself
 */
import { describe, it, expect } from "vitest";
import { translations } from "@/lib/translations";

// ─── Translation completeness ─────────────────────────────────────────────────

describe("translations completeness", () => {
  const keys = Object.keys(translations);

  it("has at least one translation key", () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it("every key has a non-empty French translation", () => {
    const missingFr = keys.filter((k) => !translations[k].fr || translations[k].fr.trim() === "");
    expect(missingFr, `Keys missing FR: ${missingFr.join(", ")}`).toHaveLength(0);
  });

  it("every key has a non-empty English translation", () => {
    const missingEn = keys.filter((k) => !translations[k].en || translations[k].en.trim() === "");
    expect(missingEn, `Keys missing EN: ${missingEn.join(", ")}`).toHaveLength(0);
  });

  it("fr and en values are different (no accidental copy-paste)", () => {
    // Some keys legitimately have the same value in both languages (e.g. proper nouns, emails).
    // We just check that the ratio of identical pairs is not suspiciously high.
    const identical = keys.filter((k) => translations[k].fr === translations[k].en);
    const ratio = identical.length / keys.length;
    // Allow up to 40% identical — brand names, short labels, etc. are OK
    expect(ratio).toBeLessThan(0.4);
  });
});

// ─── Specific known keys ──────────────────────────────────────────────────────

describe("specific translation keys", () => {
  it("nav.home has correct values", () => {
    expect(translations["nav.home"].fr).toBe("Accueil");
    expect(translations["nav.home"].en).toBe("Home");
  });

  it("nav.book has correct values", () => {
    expect(translations["nav.book"].fr).toBe("Réserver");
    expect(translations["nav.book"].en).toBe("Book Now");
  });

  it("booking.confirm is defined in both languages", () => {
    expect(translations["booking.confirm"]).toBeDefined();
    expect(translations["booking.confirm"].fr).toBeTruthy();
    expect(translations["booking.confirm"].en).toBeTruthy();
  });
});

// ─── t() lookup logic (extracted from LanguageContext) ───────────────────────
// We test the pure lookup logic directly without rendering React.

function makeLookup(language: "fr" | "en") {
  return (key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language];
  };
}

describe("t() lookup function", () => {
  it("returns French value when language is fr", () => {
    const t = makeLookup("fr");
    expect(t("nav.home")).toBe("Accueil");
  });

  it("returns English value when language is en", () => {
    const t = makeLookup("en");
    expect(t("nav.home")).toBe("Home");
  });

  it("returns the key itself when key is not found", () => {
    const t = makeLookup("fr");
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("returns the key itself for an empty string key", () => {
    const t = makeLookup("fr");
    expect(t("")).toBe("");
  });

  it("returns French for hero.cta", () => {
    const t = makeLookup("fr");
    expect(t("hero.cta")).toBe("Réserver maintenant");
  });

  it("returns English for hero.cta", () => {
    const t = makeLookup("en");
    expect(t("hero.cta")).toBe("Book Now");
  });
});
