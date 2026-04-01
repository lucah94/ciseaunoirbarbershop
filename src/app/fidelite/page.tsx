"use client";
import { useState } from "react";
import Link from "next/link";

type Loyalty = { visits: number; progress: number; nextFree: boolean; isFree: boolean };

export default function FidelitePage() {
  const [email, setEmail] = useState("");
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setNotFound(false);
    setLoyalty(null);
    const res = await fetch(`/api/loyalty?email=${encodeURIComponent(email.trim())}`);
    const data = await res.json();
    setLoading(false);
    if (data.error || data.visits === undefined) { setNotFound(true); return; }
    if (data.visits === 0) { setNotFound(true); return; }
    setLoyalty(data);
  }

  const dots = Array.from({ length: 10 }, (_, i) => i);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", fontFamily: "var(--font-geist-sans, sans-serif)" }}>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: "48px", textAlign: "center" }}>
        <p style={{ fontSize: "22px", fontWeight: 300, letterSpacing: "8px", color: "#F5F5F5" }}>CISEAU NOIR</p>
        <p style={{ fontSize: "10px", letterSpacing: "4px", color: "#555", marginTop: "4px" }}>BARBERSHOP</p>
      </Link>

      <div style={{ width: "100%", maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "12px" }}>Programme Fidélité</p>
          <h1 style={{ color: "#F5F5F5", fontSize: "28px", fontWeight: 300, letterSpacing: "1px", marginBottom: "12px" }}>Votre 10e coupe est gratuite</h1>
          <p style={{ color: "#555", fontSize: "14px" }}>Entrez votre courriel pour voir votre progression</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleCheck} style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setNotFound(false); setLoyalty(null); }}
            placeholder="votre@courriel.com"
            style={{ flex: 1, background: "#111", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "14px 16px", fontSize: "14px", borderRadius: "8px", outline: "none" }}
          />
          <button type="submit" disabled={loading}
            style={{ background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", border: "none", padding: "14px 22px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer", letterSpacing: "1px", minWidth: "90px" }}>
            {loading ? "..." : "Vérifier"}
          </button>
        </form>

        {/* Pas trouvé */}
        {notFound && (
          <div style={{ textAlign: "center", padding: "24px", background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", marginBottom: "24px" }}>
            <p style={{ color: "#555", fontSize: "14px", marginBottom: "12px" }}>Aucune visite trouvée pour ce courriel.</p>
            <p style={{ color: "#444", fontSize: "13px" }}>Réservez votre première visite pour commencer !</p>
          </div>
        )}

        {/* Résultat */}
        {loyalty && (
          <div style={{ background: "#0D0D0D", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "16px", padding: "32px", textAlign: "center" }}>

            {loyalty.isFree ? (
              <div style={{ marginBottom: "28px", padding: "16px", background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "10px" }}>
                <p style={{ fontSize: "24px", marginBottom: "8px" }}>🎉</p>
                <p style={{ color: "#D4AF37", fontSize: "16px", fontWeight: 600, letterSpacing: "1px" }}>Votre prochaine coupe est GRATUITE !</p>
                <p style={{ color: "#999", fontSize: "13px", marginTop: "6px" }}>Mentionnez-le lors de votre réservation</p>
              </div>
            ) : loyalty.nextFree ? (
              <div style={{ marginBottom: "28px", padding: "14px", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: "10px" }}>
                <p style={{ color: "#D4AF37", fontSize: "14px", letterSpacing: "1px" }}>⭐ Encore 1 visite et votre prochaine coupe est gratuite !</p>
              </div>
            ) : null}

            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "8px" }}>Vos visites</p>
            <p style={{ color: "#F5F5F5", fontSize: "48px", fontWeight: 300, marginBottom: "24px" }}>{loyalty.visits}</p>

            {/* Points ronds */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px", flexWrap: "wrap" }}>
              {dots.map(i => (
                <div key={i} style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: i < loyalty.progress
                    ? "linear-gradient(135deg, #D4AF37, #B8860B)"
                    : "#1A1A1A",
                  border: `1px solid ${i < loyalty.progress ? "#D4AF37" : "#2A2A2A"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", color: i < loyalty.progress ? "#080808" : "#333",
                  fontWeight: 600,
                }}>
                  {i === 9 ? "✦" : i + 1}
                </div>
              ))}
            </div>
            <p style={{ color: "#555", fontSize: "12px", marginBottom: "28px" }}>{loyalty.progress}/10 — Plus que {10 - loyalty.progress} visite{10 - loyalty.progress > 1 ? "s" : ""} avant la coupe gratuite</p>

            <Link href="/booking" style={{ display: "inline-block", background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", textDecoration: "none", padding: "14px 32px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase" }}>
              Réserver
            </Link>
          </div>
        )}

        {/* Explication programme */}
        {!loyalty && !notFound && (
          <div style={{ display: "flex", justifyContent: "center", gap: "32px", marginTop: "16px" }}>
            {[{ n: "1–9", label: "Coupes régulières" }, { n: "10", label: "Coupe gratuite !" }].map(s => (
              <div key={s.n} style={{ textAlign: "center" }}>
                <p style={{ color: "#D4AF37", fontSize: "20px", fontWeight: 300, marginBottom: "4px" }}>{s.n}</p>
                <p style={{ color: "#444", fontSize: "12px" }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
