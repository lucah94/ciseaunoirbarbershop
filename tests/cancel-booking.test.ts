/**
 * Tests for src/app/api/bookings/[id]/cancel/route.ts
 *
 * SÉCURITÉ : le GET ne MUTE plus rien. Avant, il annulait le RDV au simple chargement de
 * l'URL (vulnérable au prefetch / scanner de courriel qui annulait de vrais RDV). Il redirige
 * désormais vers la page de confirmation /booking/cancel où l'annulation se fait par un clic
 * explicite (bouton → PATCH). Ces tests vérifient la redirection et l'ABSENCE de mutation.
 */
import { describe, it, expect } from "vitest";

function makeRequest(id: string) {
  return new Request(`https://ciseaunoirbarbershop.com/api/bookings/${id}/cancel`);
}

describe("GET /api/bookings/[id]/cancel", () => {
  it("redirige vers /booking/cancel avec l'id (ne mute pas)", async () => {
    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("abc-123") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "abc-123" }),
    });

    expect([301, 302, 307, 308]).toContain(res.status);
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("/booking/cancel");
    expect(loc).toContain("id=abc-123");
  });

  it("encode l'id dans l'URL de redirection", async () => {
    const { GET } = await import("@/app/api/bookings/[id]/cancel/route");
    const res = await GET(makeRequest("a b/c") as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: "a b/c" }),
    });

    const loc = res.headers.get("location") || "";
    expect(loc).toContain("id=a%20b%2Fc");
  });
});
