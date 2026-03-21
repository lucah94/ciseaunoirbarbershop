"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  { id: "diodis", name: "Diodis", role: "Barbière", exp: "Experte en dégradés" },
];

// Horaires selon le jour : 0=dim, 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven, 6=sam
const CLOSED_DAYS = [0, 1]; // Dimanche et Lundi fermés

const TIMES_SHORT = ["8:30","9:00","9:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00"]; // mar/mer/sam
const TIMES_LONG  = ["8:30","9:00","9:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"]; // jeu/ven

function getTimesForDate(dateStr: string): string[] {
  if (!dateStr) return [];
  const day = new Date(dateStr + "T12:00:00").getDay();
  if (day === 4 || day === 5) return TIMES_LONG;
  return TIMES_SHORT;
}

function isDateDisabled(dateStr: string): boolean {
  const day = new Date(dateStr + "T12:00:00").getDay();
  return CLOSED_DAYS.includes(day);
}

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

function CalendarPicker({ today, selected, onSelect }: { today: string; selected: string; onSelect: (d: string) => void }) {
  const todayDate = new Date(today + "T12:00:00");
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function toStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div style={{ background: "#111", border: "1px solid #333", padding: "24px" }}>
      {/* Header mois */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button
          onClick={prevMonth}
          aria-label="Mois précédent"
          style={{ background: "none", border: "none", color: "#C9A84C", fontSize: "20px", cursor: "pointer", padding: "4px 12px" }}
        >
          ‹
        </button>
        <span style={{ color: "#F5F5F5", fontSize: "15px", letterSpacing: "2px", textTransform: "uppercase" }}>
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Mois suivant"
          style={{ background: "none", border: "none", color: "#C9A84C", fontSize: "20px", cursor: "pointer", padding: "4px 12px" }}
        >
          ›
        </button>
      </div>

      {/* Jours de la semaine */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "8px" }}>
        {DAYS_FR.map(d => (
          <div key={d} style={{ textAlign: "center", color: "#555", fontSize: "11px", letterSpacing: "1px", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Jours */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = toStr(viewYear, viewMonth, day);
          const isPast = dateStr < today;
          const isClosed = isDateDisabled(dateStr);
          const isSelected = dateStr === selected;
          const isToday = dateStr === today;
          const disabled = isPast || isClosed;

          return (
            <button
              key={dateStr}
              onClick={() => !disabled && onSelect(dateStr)}
              disabled={disabled}
              aria-label={`${day} ${MONTHS_FR[viewMonth]} ${viewYear}${isClosed ? " — fermé" : ""}`}
              aria-pressed={isSelected}
              style={{
                padding: "10px 0",
                fontSize: "14px",
                textAlign: "center",
                border: isSelected ? "2px solid #C9A84C" : isToday ? "1px solid #555" : "1px solid transparent",
                background: isSelected ? "#C9A84C" : "transparent",
                color: disabled ? "#2A2A2A" : isSelected ? "#0A0A0A" : isClosed ? "#333" : "#E5E5E5",
                cursor: disabled ? "default" : "pointer",
                fontWeight: isSelected ? 700 : 400,
                borderRadius: "2px",
                transition: "all 0.15s",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selected && !isDateDisabled(selected) && (
        <p style={{ color: "#C9A84C", fontSize: "12px", marginTop: "16px", textAlign: "center", letterSpacing: "1px" }}>
          {new Date(selected + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}
    </div>
  );
}

function BookingContent() {
  const params = useSearchParams();
  const preBarber = params.get("barber") || "";
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState({
    service: "",
    barber: preBarber,
    date: "",
    time: "",
    name: "",
    phone: "",
    email: "",
    note: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [waitlistModal, setWaitlistModal] = useState<{time: string} | null>(null);
  const [waitlistForm, setWaitlistForm] = useState({ name: "", phone: "", email: "" });
  const [waitlistSent, setWaitlistSent] = useState(false);

  const service = SERVICES.find((s) => s.id === selected.service);
  const barber = BARBERS.find((b) => b.id === selected.barber);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!selected.date || !selected.barber) return;
    const barberName = BARBERS.find(b => b.id === selected.barber)?.name || selected.barber;
    fetch(`/api/bookings?date=${selected.date}&barber=${encodeURIComponent(barberName)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBookedTimes(data.filter(b => b.status !== "cancelled").map((b: { time: string }) => b.time));
        }
      });
  }, [selected.date, selected.barber]);

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
            <div style={{ fontSize: "64px", marginBottom: "24px" }} aria-hidden="true">✓</div>
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
        <nav aria-label="Étapes de réservation">
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "48px", padding: "0 20px" }}>
            {["Service", "Barbier", "Date & Heure", "Coordonnées"].map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  aria-current={step === i + 1 ? "step" : undefined}
                  style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: step > i + 1 ? "#C9A84C" : step === i + 1 ? "#C9A84C" : "transparent",
                    border: `2px solid ${step >= i + 1 ? "#C9A84C" : "#333"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", color: step >= i + 1 ? "#0A0A0A" : "#555",
                    fontWeight: 700, flexShrink: 0
                  }}
                >
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: "11px", color: step >= i + 1 ? "#C9A84C" : "#444", letterSpacing: "1px", textTransform: "uppercase" }} className="hidden-mobile">
                  {label}
                </span>
                {i < 3 && <div style={{ width: "24px", height: "1px", background: step > i + 1 ? "#C9A84C" : "#222" }} className="hidden-mobile" />}
              </div>
            ))}
          </div>
        </nav>

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
                    aria-pressed={selected.service === s.id}
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
                    aria-pressed={selected.barber === b.id}
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
                      <span style={{ fontSize: "28px", color: "#C9A84C" }} aria-hidden="true">✂</span>
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
                <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Date</label>
                <CalendarPicker
                  today={today}
                  selected={selected.date}
                  onSelect={(val) => setSelected({ ...selected, date: val, time: "" })}
                />
                {selected.date && !isDateDisabled(selected.date) && (
                  <p style={{ color: "#555", fontSize: "12px", marginTop: "12px" }}>
                    {[4,5].includes(new Date(selected.date + "T12:00:00").getDay()) ? "Horaire étendu : 8h30–20h30" : "Horaire : 8h30–16h30"}
                  </p>
                )}
              </div>
              {selected.date && !isDateDisabled(selected.date) && (
                <div>
                  <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Heure</label>
                  <p style={{ color: "#555", fontSize: "12px", marginBottom: "12px" }}>
                    Les créneaux barrés sont complets — cliquez dessus pour rejoindre la liste d'attente.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "10px" }}>
                    {getTimesForDate(selected.date).map((t) => {
                      const isBooked = bookedTimes.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => isBooked ? setWaitlistModal({ time: t }) : setSelected({ ...selected, time: t })}
                          aria-label={`${t}${isBooked ? " — déjà réservé, rejoindre la liste d'attente" : ""}`}
                          aria-pressed={selected.time === t}
                          style={{
                            background: isBooked ? "#0A0A0A" : selected.time === t ? "#C9A84C" : "#111",
                            border: `1px solid ${isBooked ? "#1A1A1A" : selected.time === t ? "#C9A84C" : "#333"}`,
                            color: isBooked ? "#2A2A2A" : selected.time === t ? "#0A0A0A" : "#999",
                            padding: "12px", cursor: "pointer", fontSize: "14px",
                            fontWeight: selected.time === t ? 700 : 400,
                            transition: "all 0.2s",
                            textDecoration: isBooked ? "line-through" : "none",
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
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
                    <label htmlFor={`field-${key}`} style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>{label}</label>
                    <input
                      id={`field-${key}`}
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
                  <label htmlFor="field-note" style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>Note (optionnel)</label>
                  <textarea
                    id="field-note"
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
      {waitlistModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#111", border: "1px solid #333", padding: "40px", maxWidth: "480px", width: "100%" }}>
            {!waitlistSent ? (
              <>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "8px" }}>Liste d'attente</p>
                <h3 style={{ color: "#F5F5F5", fontSize: "20px", fontWeight: 300, letterSpacing: "2px", marginBottom: "8px" }}>
                  {waitlistModal.time} — {BARBERS.find(b => b.id === selected.barber)?.name}
                </h3>
                <p style={{ color: "#666", fontSize: "13px", marginBottom: "32px" }}>
                  Inscrivez-vous et vous serez contacté automatiquement si ce créneau se libère.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                  {[
                    { label: "Nom complet", key: "name", type: "text", placeholder: "Jean Tremblay" },
                    { label: "Téléphone", key: "phone", type: "tel", placeholder: "418-555-0000" },
                    { label: "Courriel (optionnel)", key: "email", type: "email", placeholder: "jean@exemple.com" },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={waitlistForm[key as keyof typeof waitlistForm]}
                        onChange={e => setWaitlistForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ background: "#0A0A0A", border: "1px solid #333", color: "#F5F5F5", padding: "12px 14px", fontSize: "14px", width: "100%", outline: "none" }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => { setWaitlistModal(null); setWaitlistForm({ name: "", phone: "", email: "" }); }}
                    style={{ flex: 1, background: "none", border: "1px solid #333", color: "#666", padding: "12px", cursor: "pointer", fontSize: "13px" }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      const barberName = BARBERS.find(b => b.id === selected.barber)?.name || selected.barber;
                      const serviceName = SERVICES.find(s => s.id === selected.service)?.name || "";
                      await fetch("/api/waitlist", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          date: selected.date,
                          time: waitlistModal.time,
                          barber: barberName,
                          service: serviceName,
                          client_name: waitlistForm.name,
                          client_phone: waitlistForm.phone,
                          client_email: waitlistForm.email,
                        }),
                      });
                      setWaitlistSent(true);
                    }}
                    disabled={!waitlistForm.name || !waitlistForm.phone}
                    style={{ flex: 2, background: "#C9A84C", border: "none", color: "#0A0A0A", padding: "12px", cursor: "pointer", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 700, opacity: (!waitlistForm.name || !waitlistForm.phone) ? 0.4 : 1 }}
                  >
                    S'inscrire
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Inscrit !</p>
                <p style={{ color: "#999", fontSize: "14px", marginBottom: "32px" }}>Vous recevrez un SMS dès qu'un créneau se libère.</p>
                <button
                  onClick={() => { setWaitlistModal(null); setWaitlistSent(false); setWaitlistForm({ name: "", phone: "", email: "" }); }}
                  style={{ background: "none", border: "1px solid #333", color: "#666", padding: "10px 24px", cursor: "pointer", fontSize: "13px" }}
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}

export default function BookingClient() {
  return (
    <Suspense fallback={<><Navbar /><main style={{ minHeight: "100vh", background: "#0A0A0A" }} aria-busy="true" /><Footer /></>}>
      <BookingContent />
    </Suspense>
  );
}
