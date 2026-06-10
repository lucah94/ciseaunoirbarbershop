import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/sanitize";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's here")).toBe("it&#039;s here");
  });

  it("escapes all special chars in one string", () => {
    expect(escapeHtml(`<a href="test" class='x'>AT&T</a>`)).toBe(
      "&lt;a href=&quot;test&quot; class=&#039;x&#039;&gt;AT&amp;T&lt;/a&gt;"
    );
  });

  it("returns plain strings unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles string with no special chars", () => {
    expect(escapeHtml("Ciseau Noir Barbershop")).toBe("Ciseau Noir Barbershop");
  });

  // Edge case: XSS payload
  it("neutralises a typical XSS payload", () => {
    const xss = '<img src=x onerror="alert(1)">';
    expect(escapeHtml(xss)).not.toContain("<");
    expect(escapeHtml(xss)).not.toContain(">");
  });
});
