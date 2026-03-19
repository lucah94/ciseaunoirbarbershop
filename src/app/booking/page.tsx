"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SERVICES = [
  { id: "wash-cut", name: "Coupe + Lavage", price: "35$", duration: "45 min", desc: "Coupe classique avec shampoing" },
  { id: "wash-cut-shave", name: "Coupe + Rasage Lame", price: "50$", duration: "60 min", desc: "Coupe, rasage lame & serviette chaude" },
  { id: "premium", name: "Service Premium", price: "75$", duration: "75 min", desc: "Coupe, rasage, serviette chaude & exfoliant" },
  { id: "shave", name: "Rasage / Barbe", price: "25$", duration: "30 min", desc: "Rasage lame, barbe & tondeuse" },
  { id: "student", name: "Tarif Étudiant", price: "30$", duration: "45 min", desc: "Coupe + lavage (preuve requise)" },
];

const BARBERS = [
  { id: "melynda", name: "Melynda", role: "Barbière & Co-fondatrice", exp: "18+ ans d'expérience" },
  { id: "diodis", name: "Diodis", role: "Barbier", exp: "Expert en dégradés" },
];

const TIMES = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState({
    service: "",
    barber: "",
    date: "",
    time: "",
    name: "",
    phone: "",
    email: "",
    note: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const service = SERVICES.find((s) => s.id === selected.service);
  const barber = BARBERS.find((b) => b.id === selected.barber);

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit() {
    const service = SERVICES.find((s) => s.id === selected.service);
    const price = service ? parseInt(service.price) : 0;
    await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: selected.name,
        client_phone: selected.phone,
        client_email: selected.email,
        barber: BARBERS.find(b => b.id === selected.barber)?.name || selected.barber,
        service: service?.name || "",
        price,
        date: selected.date,
        time: selected.time,
        note: selected.note,
        status: "confirmed",
      }),
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <>
        <Navbar />
        <main style={{ minHeight: "100vh", background: "#0A0A0A", paddingTop: "120px", paddingBottom: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: "0 20px" }}>
            <div style={{ fontSize: "64px", marginBottom: "24px" }}>✓</div>
            <p style={{ color: "#C9A84C", letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Réservation confirmée</p>
            <h1 style={{ fontSize: "36px", fontWeight: 300, letterSpacing: "4px", color: "#F5F5F5", marginBottom: "32px" }}>Merci, {selected.name} !</h1>
            <div style={{ background: "#111", border: "1px solid #222", padding: "32px", maxWidth: "400px", margin: "0 auto 40px", textAlign: "left" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Votre rendez-vous</p>
              <p style={{ color: "#F5F5F5", marginBottom: "8px" }}>{service?.name} — {service?.price}</p>
              <p style={{ color: "#999", fontSize: "14px", marginBottom: "8px" }}>avec {barber?.name}</p>
              <p style={{ color: "#999", fontSize: "14px", marginBottom: "8px" }}>{selected.date} à {selected.time}</p>
              <p style={{ color: "#666", fontSize: "13px", marginTop: "16px" }}>375 Boul. des Chutes, Québec</p>
            </div>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "32px" }}>Un rappel vous sera envoyé 24h avant votre rendez-vous.</p>
            <a href="/" className="btn-gold">Retour à l'accueil</a>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", background: "#0A0A0A", paddingTop: "100px", paddingBottom: "80px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", padding: "40px 20px 60px" }}>
          <p style={{ color: "#C9A84C", letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Ciseau Noir</p>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 300, letterSpacing: "6px", textTransform: "uppercase", color: "#F5F5F5" }}>Réservation</h1>
          <div style={{ width: "60px", height: "2px", background: "#C9A84C", margin: "16px auto 0" }} />
        </div>

        {/* Steps indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "48px", padding: "0 20px" }}>
          {["Service", "Barbier", "Date & Heure", "Coordonnées"].map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: step > i + 1 ? "#C9A84C" : step === i + 1 ? "#C9A84C" : "transparent",
                border: `2px solid ${step >= i + 1 ? "#C9A84C" : "#333"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", color: step >= i + 1 ? "#0A0A0A" : "#555",
                fontWeight: 700, flexShrink: 0
              }}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: "11px", color: step >= i + 1 ? "#C9A84C" : "#444", letterSpacing: "1px", textTransform: "uppercase" }} className="hidden-mobile">
                {label}
              </span>
              {i < 3 && <div style={{ width: "24px", height: "1px", background: step > i + 1 ? "#C9A84C" : "#222" }} className="hidden-mobile" />}
            </div>
          ))}
        </div>

        <div style={{ maxWidth: "700px", margin: "0 auto", padding: "0 20px" }}>

          {/* STEP 1 - Service */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: "20px", letterSpacing: "3px", color: "#F5F5F5", textTransform: "uppercase", marginBottom: "32px", textAlign: "center" }}>Choisissez votre service</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {SERVICES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelected({ ...selected, service: s.id }); setStep(2); }}
                    style={{
                      background: selected.service === s.id ? "#1A1A0A" : "#111",
                      border: `2px solid ${selected.service === s.id ? "#C9A84C" : "#222"}`,
                      padding: "24px 28px", cursor: "pointer", textAlign: "left",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      transition: "all 0.2s", width: "100%"
                    }}
                  >
                    <div>
                      <p style={{ color: "#F5F5F5", fontSize: "15px", letterSpacing: "1px", marginBottom: "4px" }}>{s.name}</p>
                      <p style={{ color: "#666", fontSize: "13px" }}>{s.desc} · {s.duration}</p>
                    </div>
                    <span style={{ color: "#C9A84C", fontSize: "22px", fontWeight: 300, flexShrink: 0, marginLeft: "16px" }}>{s.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 - Barber */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: "20px", letterSpacing: "3px", color: "#F5F5F5", textTransform: "uppercase", marginBottom: "32px", textAlign: "center" }}>Choisissez votre barbier</h2>
              <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
                {BARBERS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setSelected({ ...selected, barber: b.id }); setStep(3); }}
                    style={{
                      background: selected.barber === b.id ? "#1A1A0A" : "#111",
                      border: `2px solid ${selected.barber === b.id ? "#C9A84C" : "#222"}`,
                      padding: "40px 48px", cursor: "pointer", textAlign: "center",
                      flex: "1", minWidth: "200px", maxWidth: "280px",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{
                      width: "80px", height: "80px", borderRadius: "50%",
                      background: "#1A1A1A", border: "2px solid #C9A84C",
                      margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <span style={{ fontSize: "28px", color: "#C9A84C" }}>✂</span>
                    </div>
                    <p style={{ color: "#F5F5F5", fontSize: "18px", letterSpacing: "2px", marginBottom: "8px" }}>{b.name}</p>
                    <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>{b.role}</p>
                    <p style={{ color: "#666", fontSize: "12px" }}>{b.exp}</p>
                  </button>
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: "32px" }}>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", letterSpacing: "1px" }}>← Retour</button>
              </div>
            </div>
          )}

          {/* STEP 3 - Date & Time */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: "20px", letterSpacing: "3px", color: "#F5F5F5", textTransform: "uppercase", marginBottom: "32px", textAlign: "center" }}>Choisissez la date et l'heure</h2>
              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Date</label>
                <input
                  type="date"
                  min={today}
                  value={selected.date}
                  onChange={(e) => setSelected({ ...selected, date: e.target.value })}
                  style={{
                    background: "#111", border: "1px solid #333", color: "#F5F5F5",
                    padding: "14px 16px", fontSize: "15px", width: "100%",
                    outline: "none", colorScheme: "dark"
                  }}
                />
              </div>
              {selected.date && (
                <div>
                  <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Heure</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "10px" }}>
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelected({ ...selected, time: t })}
                        style={{
                          background: selected.time === t ? "#C9A84C" : "#111",
                          border: `1px solid ${selected.time === t ? "#C9A84C" : "#333"}`,
                          color: selected.time === t ? "#0A0A0A" : "#999",
                          padding: "12px", cursor: "pointer", fontSize: "14px",
                          fontWeight: selected.time === t ? 700 : 400,
                          transition: "all 0.2s"
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
                <button onClick={() => setStep(2)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", letterSpacing: "1px" }}>← Retour</button>
                {selected.date && selected.time && (
                  <button onClick={() => setStep(4)} className="btn-gold" style={{ padding: "12px 32px", fontSize: "12px" }}>Continuer →</button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4 - Contact info */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: "20px", letterSpacing: "3px", color: "#F5F5F5", textTransform: "uppercase", marginBottom: "32px", textAlign: "center" }}>Vos coordonnées</h2>

              {/* Summary */}
              <div style={{ background: "#111", border: "1px solid #222", padding: "20px 24px", marginBottom: "32px", display: "flex", gap: "32px", flexWrap: "wrap" }}>
                <div>
                  <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Service</p>
                  <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{service?.name} — {service?.price}</p>
                </div>
                <div>
                  <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Barbier</p>
                  <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{barber?.name}</p>
                </div>
                <div>
                  <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Date & Heure</p>
                  <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{selected.date} à {selected.time}</p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {[
                  { label: "Nom complet", key: "name", type: "text", placeholder: "Jean Tremblay" },
                  { label: "Téléphone", key: "phone", type: "tel", placeholder: "418-555-0000" },
                  { label: "Courriel", key: "email", type: "email", placeholder: "jean@exemple.com" },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>{label}</label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={selected[key as keyof typeof selected]}
                      onChange={(e) => setSelected({ ...selected, [key]: e.target.value })}
                      style={{
                        background: "#111", border: "1px solid #333", color: "#F5F5F5",
                        padding: "14px 16px", fontSize: "15px", width: "100%",
                        outline: "none"
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>Note (optionnel)</label>
                  <textarea
                    placeholder="Demande spéciale..."
                    value={selected.note}
                    onChange={(e) => setSelected({ ...selected, note: e.target.value })}
                    rows={3}
                    style={{
                      background: "#111", border: "1px solid #333", color: "#F5F5F5",
                      padding: "14px 16px", fontSize: "15px", width: "100%",
                      outline: "none", resize: "vertical"
                    }}
                  />
                </div>
              </div>

              <p style={{ color: "#555", fontSize: "12px", marginTop: "20px", lineHeight: 1.6 }}>
                Politique d'annulation : minimum 1 heure avant le rendez-vous.
              </p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px" }}>
                <button onClick={() => setStep(3)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "13px", letterSpacing: "1px" }}>← Retour</button>
                <button
                  onClick={handleSubmit}
                  disabled={!selected.name || !selected.phone || !selected.email}
                  className="btn-gold"
                  style={{ padding: "14px 40px", fontSize: "12px", opacity: (!selected.name || !selected.phone || !selected.email) ? 0.4 : 1 }}
                >
                  Confirmer le rendez-vous
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
