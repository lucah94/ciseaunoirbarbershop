"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BarberLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/barber-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/barber/agenda");
    } else {
      setError("Mot de passe incorrect.");
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "380px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <p style={{ fontSize: "16px", letterSpacing: "4px", color: "#F5F5F5", fontWeight: 300 }}>
            CISEAU <span style={{ color: "#C9A84C" }}>NOIR</span>
          </p>
          <p style={{ color: "#444", fontSize: "11px", marginTop: "8px", letterSpacing: "2px" }}>ESPACE BARBIER</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              style={{
                background: "#111", border: "1px solid #2A2A2A", color: "#F5F5F5",
                padding: "14px 16px", fontSize: "15px", width: "100%", outline: "none",
              }}
            />
          </div>
          {error && <p style={{ color: "#e55", fontSize: "13px" }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn-gold" style={{ opacity: loading ? 0.6 : 1 }}>
            {loading ? "..." : "Accéder"}
          </button>
        </form>
      </div>
    </div>
  );
}
