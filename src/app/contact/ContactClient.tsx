"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/lib/language-context";

export default function ContactClient() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(t("contact.error"));
    } finally {
      setSending(false);
    }
  }

  const hoursLines = t("contact.hours_detail").split("\n");

  return (
    <>
      <Navbar />
      <main style={{ background: "#0A0A0A", minHeight: "100vh" }}>
        {/* Hero */}
        <section style={{ paddingTop: "140px", paddingBottom: "80px", textAlign: "center", background: "linear-gradient(to bottom, #111 0%, #0A0A0A 100%)" }}>
          <p style={{ color: "#C9A84C", letterSpacing: "6px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Ciseau Noir</p>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 300, letterSpacing: "8px", textTransform: "uppercase", color: "#F5F5F5", marginBottom: "16px" }}>{t("contact.title")}</h1>
          <div style={{ width: "60px", height: "2px", background: "#C9A84C", margin: "0 auto" }} />
        </section>

        <section style={{ padding: "80px 20px 100px", maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "80px", flexWrap: "wrap" }}>

            {/* Info */}
            <div style={{ flex: "1", minWidth: "260px" }}>
              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{t("contact.address")}</p>
                <address style={{ color: "#F5F5F5", fontSize: "16px", lineHeight: 1.8, fontStyle: "normal" }}>
                  375 Boulevard des Chutes<br />
                  Qu&eacute;bec, QC<br />
                  Canada
                </address>
                <a
                  href="https://maps.google.com/?q=375+Boulevard+des+Chutes+Quebec"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#C9A84C", fontSize: "12px", letterSpacing: "1px", textDecoration: "none", display: "inline-block", marginTop: "12px", borderBottom: "1px solid #C9A84C", paddingBottom: "2px" }}
                >
                  {t("contact.maps_link")}
                </a>
              </div>

              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{t("contact.reservations")}</p>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 1.7, marginBottom: "16px" }}>{t("contact.reservations_text")}</p>
                <Link href="/booking" className="btn-outline" style={{ fontSize: "11px", padding: "10px 24px" }}>{t("contact.book_online")}</Link>
              </div>

              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{t("contact.walkins")}</p>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 1.7 }}>{t("contact.walkins_text").split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</p>
              </div>

              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{t("contact.phone")}</p>
                <a href="tel:4186655703" style={{ color: "#F5F5F5", fontSize: "16px", textDecoration: "none" }}>(418) 665-5703</a>
              </div>

              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{t("contact.hours")}</p>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 2 }}>
                  {hoursLines.map((line, i) => <span key={i}>{line}<br /></span>)}
                  <span style={{ color: "#555" }}>{t("contact.hours_closed")}</span>
                </p>
              </div>

              <div style={{ marginBottom: "48px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{t("contact.cancellation")}</p>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 1.7 }}>{t("contact.cancellation_text").split("\n").map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</p>
              </div>

              <div>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{t("contact.social")}</p>
                <a href="https://www.facebook.com/profile.php?id=61575695811602" target="_blank" rel="noopener noreferrer"
                  style={{ color: "#888", fontSize: "14px", textDecoration: "none", display: "block", marginBottom: "8px" }}>
                  Facebook &rarr;
                </a>
              </div>
            </div>

            {/* Form */}
            <div style={{ flex: "1", minWidth: "280px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "32px" }}>{t("contact.send_message")}</p>

              {sent ? (
                <div style={{ background: "#111", border: "1px solid #C9A84C", padding: "40px", textAlign: "center" }} role="alert">
                  <p style={{ color: "#C9A84C", fontSize: "32px", marginBottom: "16px" }} aria-hidden="true">&#10003;</p>
                  <p style={{ color: "#F5F5F5", fontSize: "16px", letterSpacing: "2px", marginBottom: "8px" }}>{t("contact.sent_title")}</p>
                  <p style={{ color: "#666", fontSize: "13px" }}>{t("contact.sent_text")}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }} noValidate>
                  {[
                    { label: t("contact.name"), key: "name", type: "text", placeholder: t("contact.name_placeholder") },
                    { label: t("contact.email"), key: "email", type: "email", placeholder: t("contact.email_placeholder") },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label htmlFor={`contact-${key}`} style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>{label}</label>
                      <input
                        id={`contact-${key}`}
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
                    <label htmlFor="contact-message" style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>{t("contact.message")}</label>
                    <textarea
                      id="contact-message"
                      placeholder={t("contact.message_placeholder")}
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
                  {error && <p style={{ color: "#e55", fontSize: "13px" }} role="alert">{error}</p>}
                  <button type="submit" disabled={sending} className="btn-gold" style={{ marginTop: "8px", opacity: sending ? 0.6 : 1 }}>
                    {sending ? t("contact.sending") : t("contact.send")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Google Maps */}
        <section style={{ padding: "0 20px 80px", maxWidth: "1000px", margin: "0 auto" }}>
          <p style={{
            color: "#C9A84C",
            fontSize: "11px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: "24px",
            textAlign: "center",
          }}>
            {t("contact.find_us")}
          </p>
          <div style={{ width: "60px", height: "2px", background: "#C9A84C", margin: "0 auto 32px" }} />
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2727.5!2d-71.2150!3d46.8800!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zQ2lzZWF1K05vaXIrQmFyYmVyc2hvcCtRdWViZWMrQ2FuYWRh!5e0!3m2!1sfr!2sca!4v1&q=Ciseau+Noir+Barbershop+Quebec+Canada"
            width="100%"
            height="400"
            style={{
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: "16px",
              display: "block",
              filter: "grayscale(100%) invert(90%) contrast(90%)",
            }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Ciseau Noir Barbershop — 375 Boul. des Chutes, Qu&#233;bec"
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
