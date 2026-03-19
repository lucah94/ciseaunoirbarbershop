"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <>
      <Navbar />
      <main style={{ background: "#0A0A0A", minHeight: "100vh" }}>
        {/* Hero */}
        <section style={{ paddingTop: "140px", paddingBottom: "80px", textAlign: "center", background: "linear-gradient(to bottom, #111 0%, #0A0A0A 100%)" }}>
          <p style={{ color: "#C9A84C", letterSpacing: "6px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Ciseau Noir</p>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 300, letterSpacing: "8px", textTransform: "uppercase", color: "#F5F5F5", marginBottom: "16px" }}>Contact</h1>
          <div style={{ width: "60px", height: "2px", background: "#C9A84C", margin: "0 auto" }} />
        </section>

        <section style={{ padding: "80px 20px 100px", maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "80px", flexWrap: "wrap" }}>

            {/* Info */}
            <div style={{ flex: "1", minWidth: "260px" }}>
              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Adresse</p>
                <p style={{ color: "#F5F5F5", fontSize: "16px", lineHeight: 1.8 }}>375 Boulevard des Chutes<br />Québec, QC<br />Canada</p>
                <a
                  href="https://maps.google.com/?q=375+Boulevard+des+Chutes+Quebec"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#C9A84C", fontSize: "12px", letterSpacing: "1px", textDecoration: "none", display: "inline-block", marginTop: "12px", borderBottom: "1px solid #C9A84C", paddingBottom: "2px" }}
                >
                  Voir sur Google Maps →
                </a>
              </div>

              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Réservations</p>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 1.7, marginBottom: "16px" }}>Réservez en ligne en moins de 2 minutes.</p>
                <Link href="/booking" className="btn-outline" style={{ fontSize: "11px", padding: "10px 24px" }}>Réserver en ligne</Link>
              </div>

              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Walk-ins</p>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 1.7 }}>Bienvenus selon disponibilité.<br />Réservation recommandée.</p>
              </div>

              <div>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Annulation</p>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 1.7 }}>Minimum 1 heure avant<br />votre rendez-vous.</p>
              </div>
            </div>

            {/* Form */}
            <div style={{ flex: "1", minWidth: "280px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "32px" }}>Envoyer un message</p>

              {sent ? (
                <div style={{ background: "#111", border: "1px solid #C9A84C", padding: "40px", textAlign: "center" }}>
                  <p style={{ color: "#C9A84C", fontSize: "32px", marginBottom: "16px" }}>✓</p>
                  <p style={{ color: "#F5F5F5", fontSize: "16px", letterSpacing: "2px", marginBottom: "8px" }}>Message envoyé !</p>
                  <p style={{ color: "#666", fontSize: "13px" }}>Nous vous répondrons dans les plus brefs délais.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    { label: "Nom", key: "name", type: "text", placeholder: "Votre nom" },
                    { label: "Courriel", key: "email", type: "email", placeholder: "votre@courriel.com" },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        required
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        style={{
                          background: "#111", border: "1px solid #2A2A2A", color: "#F5F5F5",
                          padding: "14px 16px", fontSize: "15px", width: "100%", outline: "none",
                        }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>Message</label>
                    <textarea
                      placeholder="Votre message..."
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      style={{
                        background: "#111", border: "1px solid #2A2A2A", color: "#F5F5F5",
                        padding: "14px 16px", fontSize: "15px", width: "100%",
                        outline: "none", resize: "vertical",
                      }}
                    />
                  </div>
                  <button type="submit" className="btn-gold" style={{ marginTop: "8px" }}>
                    Envoyer
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
