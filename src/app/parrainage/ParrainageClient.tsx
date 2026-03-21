"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ParrainageClient() {
  const [form, setForm] = useState({
    referrer_name: "",
    referrer_email: "",
    referred_name: "",
    referred_email: "",
  });
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");
      setCode(data.code);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 18px",
    background: "#111",
    border: "1px solid #222",
    color: "#F5F5F5",
    fontSize: "14px",
    borderRadius: "4px",
    outline: "none",
    fontFamily: "Georgia, serif",
    transition: "border-color 0.2s ease",
  };

  const labelStyle: React.CSSProperties = {
    color: "#888",
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    marginBottom: "8px",
    display: "block",
  };

  return (
    <>
      <Navbar />
      <main style={{ background: "#0A0A0A", minHeight: "100vh" }}>
        {/* Hero */}
        <section
          style={{
            paddingTop: "140px",
            paddingBottom: "80px",
            textAlign: "center",
            background: "linear-gradient(to bottom, #111 0%, #0A0A0A 100%)",
          }}
        >
          <p
            style={{
              color: "#C9A84C",
              letterSpacing: "6px",
              fontSize: "12px",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            Ciseau Noir
          </p>
          <h1
            style={{
              fontSize: "clamp(36px, 6vw, 64px)",
              fontWeight: 300,
              letterSpacing: "8px",
              textTransform: "uppercase",
              color: "#F5F5F5",
              marginBottom: "16px",
            }}
          >
            Parrainage
          </h1>
          <div
            style={{
              width: "60px",
              height: "2px",
              background: "#C9A84C",
              margin: "0 auto",
            }}
          />
        </section>

        <section
          style={{
            padding: "0 20px 100px",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          {/* Explanation */}
          <div
            style={{
              background: "#111",
              border: "1px solid #1A1A1A",
              borderLeft: "3px solid #C9A84C",
              padding: "28px 32px",
              marginBottom: "48px",
            }}
          >
            <h2
              style={{
                color: "#F5F5F5",
                fontSize: "20px",
                fontWeight: 300,
                letterSpacing: "3px",
                marginBottom: "16px",
              }}
            >
              Comment ça fonctionne
            </h2>
            <div style={{ color: "#888", fontSize: "14px", lineHeight: 2 }}>
              <p style={{ marginBottom: "8px" }}>
                1. Remplissez le formulaire ci-dessous avec vos informations et
                celles de votre ami(e).
              </p>
              <p style={{ marginBottom: "8px" }}>
                2. Votre ami(e) reçoit un courriel avec un{" "}
                <strong style={{ color: "#C9A84C" }}>code de 5$ de rabais</strong>{" "}
                sur sa première visite.
              </p>
              <p>
                3. Lorsqu&apos;il/elle complète sa visite, vous recevez aussi{" "}
                <strong style={{ color: "#C9A84C" }}>5$ de rabais</strong> sur
                votre prochaine coupe.
              </p>
            </div>
          </div>

          {sent ? (
            <div
              style={{
                background: "#111",
                border: "1px solid #1A1A1A",
                padding: "48px 32px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(212,175,55,0.1)",
                  border: "2px solid #C9A84C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  fontSize: "28px",
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#C9A84C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2
                style={{
                  color: "#F5F5F5",
                  fontSize: "22px",
                  fontWeight: 300,
                  letterSpacing: "3px",
                  marginBottom: "16px",
                }}
              >
                Parrainage envoyé !
              </h2>
              <p
                style={{
                  color: "#888",
                  fontSize: "14px",
                  lineHeight: 1.7,
                  marginBottom: "24px",
                }}
              >
                Un courriel a été envoyé à votre ami(e) avec le code de rabais.
              </p>
              <div
                style={{
                  background: "#0A0A0A",
                  border: "1px solid #222",
                  padding: "20px",
                  display: "inline-block",
                  marginBottom: "24px",
                }}
              >
                <p
                  style={{
                    color: "#555",
                    fontSize: "10px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  Code de parrainage
                </p>
                <p
                  style={{
                    color: "#C9A84C",
                    fontSize: "28px",
                    fontWeight: 300,
                    letterSpacing: "6px",
                    margin: 0,
                  }}
                >
                  {code}
                </p>
              </div>
              <br />
              <button
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setForm({
                    referrer_name: "",
                    referrer_email: "",
                    referred_name: "",
                    referred_email: "",
                  });
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  color: "#888",
                  padding: "12px 28px",
                  fontSize: "12px",
                  letterSpacing: "2px",
                  cursor: "pointer",
                  marginTop: "16px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#C9A84C";
                  e.currentTarget.style.color = "#C9A84C";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#333";
                  e.currentTarget.style.color = "#888";
                }}
              >
                RÉFÉRER UN AUTRE AMI
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Referrer section */}
              <p
                style={{
                  color: "#C9A84C",
                  fontSize: "11px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  marginBottom: "20px",
                }}
              >
                Vos informations
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginBottom: "24px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={labelStyle}>Votre nom</label>
                  <input
                    type="text"
                    required
                    value={form.referrer_name}
                    onChange={(e) =>
                      setForm({ ...form, referrer_name: e.target.value })
                    }
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#C9A84C")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#222")
                    }
                    placeholder="Jean Tremblay"
                  />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={labelStyle}>Votre courriel</label>
                  <input
                    type="email"
                    required
                    value={form.referrer_email}
                    onChange={(e) =>
                      setForm({ ...form, referrer_email: e.target.value })
                    }
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#C9A84C")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#222")
                    }
                    placeholder="jean@example.com"
                  />
                </div>
              </div>

              {/* Separator */}
              <div
                style={{
                  width: "100%",
                  height: "1px",
                  background: "#1A1A1A",
                  margin: "32px 0",
                }}
              />

              {/* Referred section */}
              <p
                style={{
                  color: "#C9A84C",
                  fontSize: "11px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  marginBottom: "20px",
                }}
              >
                Informations de votre ami(e)
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginBottom: "24px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={labelStyle}>Nom de l&apos;ami(e)</label>
                  <input
                    type="text"
                    required
                    value={form.referred_name}
                    onChange={(e) =>
                      setForm({ ...form, referred_name: e.target.value })
                    }
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#C9A84C")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#222")
                    }
                    placeholder="Marie Gagnon"
                  />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={labelStyle}>Courriel de l&apos;ami(e)</label>
                  <input
                    type="email"
                    required
                    value={form.referred_email}
                    onChange={(e) =>
                      setForm({ ...form, referred_email: e.target.value })
                    }
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#C9A84C")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#222")
                    }
                    placeholder="marie@example.com"
                  />
                </div>
              </div>

              {error && (
                <p
                  style={{
                    color: "#e55",
                    fontSize: "13px",
                    marginBottom: "16px",
                    padding: "12px 16px",
                    background: "rgba(238,85,85,0.08)",
                    border: "1px solid rgba(238,85,85,0.2)",
                    borderRadius: "4px",
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                style={{
                  width: "100%",
                  padding: "16px",
                  background: sending ? "#333" : "#C9A84C",
                  color: sending ? "#666" : "#0A0A0A",
                  border: "none",
                  fontSize: "12px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  cursor: sending ? "not-allowed" : "pointer",
                  borderRadius: "4px",
                  transition: "all 0.2s ease",
                }}
              >
                {sending ? "Envoi en cours..." : "Envoyer l'invitation"}
              </button>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
