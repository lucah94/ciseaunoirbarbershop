/**
 * Tests for src/app/api/admin/sms-optout/route.ts
 *
 * Couvre : garde admin, validation du numéro, et le chemin heureux
 * POST (bloquer) / DELETE (réactiver) avec un supabaseAdmin mocké.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const upsert = vi.fn(() => Promise.resolve({ error: null }));
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const del = vi.fn(() => ({ eq }));
  const order = vi.fn(() => Promise.resolve({ data: [], error: null }));
  const select = vi.fn(() => ({ order }));
  const fromFn = vi.fn(() => ({ select, upsert, delete: del }));
  return { upsert, eq, del, order, select, fromFn, state: { adminAllowed: true } };
});

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: h.fromFn } }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(() => (h.state.adminAllowed ? null : new Response("no", { status: 401 }))),
}));

import { GET, POST, DELETE } from "@/app/api/admin/sms-optout/route";

function reqWithJson(body: unknown) {
  return { json: () => Promise.resolve(body) } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  h.state.adminAllowed = true;
  h.upsert.mockClear();
  h.fromFn.mockClear();
});

describe("sms-optout — garde admin", () => {
  it("GET refuse si non-admin", async () => {
    h.state.adminAllowed = false;
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });
});

describe("sms-optout — validation numéro", () => {
  it("POST 400 si numéro trop court", async () => {
    const res = await POST(reqWithJson({ phone: "123" }));
    expect(res.status).toBe(400);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("DELETE 400 si numéro manquant", async () => {
    const res = await DELETE(reqWithJson({}));
    expect(res.status).toBe(400);
  });
});

describe("sms-optout — chemin heureux", () => {
  it("POST normalise le numéro et écrit source 'admin'", async () => {
    const res = await POST(reqWithJson({ phone: "(418) 555-0192", note: "demande au comptoir" }));
    expect(res.status).toBe(200);
    expect(h.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "4185550192", source: "admin", note: "demande au comptoir" }),
      { onConflict: "phone" }
    );
  });

  it("DELETE répond ok avec le numéro à 10 chiffres", async () => {
    const res = await DELETE(reqWithJson({ phone: "1-418-555-0192" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, phone: "4185550192" });
  });
});
