"use client";
import { useEffect, useState, useCallback } from "react";
import BarberSidebar from "@/components/BarberSidebar";

type Booking = {
  id: string; client_name: string; client_phone: string; client_email: string;
  barber: string; service: string; price: number; date: string; time: string;
  status: string; note: string;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  confirmed: { color: "#D4AF37", bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.25)", label: "Confirmé" },
  completed: { color: "#5a5",    bg: "rgba(85,170,85,0.08)",  border: "rgba(85,170,85,0.2)",   label: "Complété" },
  cancelled: { color: "#e55",    bg: "rgba(238,85,85,0.08)",  border: "rgba(238,85,85,0.2)",   label: "Annulé" },
  no_show:   { color: "#f90",    bg: "rgba(255,153,0,0.08)",  border: "rgba(255,153,0,0.2)",   label: "No-show" },
};

const SERVICES = [
  { label: "Coupe + Lavage", price: 35 },
  { label: "Coupe + Rasage Lame & Serviette Chaude", price: 50 },
  { label: "Service Premium", price: 75 },
  { label: "Rasage / Barbe", price: 25 },
  { label: "Tarif Etudiant", price: 30 },
];

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

export default function BarberAgendaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [showNew, setShowNew] = useState(false);
  const [newRDV, setNewRDV] = useState({
    client_name: "", client_phone: "", client_email: "",
    service: "Coupe + Lavage", price: 35,
    date: new Date().toISOString().split("T")[0], time: "09:00", note: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const fetchBookings = useCallback(() => {
    setLoading(true);
    fetch("/api/bookings?start=2026-01-01")
      .then(r => r.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : []).filter((b: Booking) =>
          b.barber?.toLowerCase() === "diodis"
        );
        setBookings(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function updateStatus(id: string, status: string) {
    if (status === "cancelled" && !confirm("Annuler ce rendez-vous ?")) return;
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  }

  async function submitNewRDV() {
    if (!newRDV.client_name.trim() || !newRDV.date || !newRDV.time) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newRDV, barber: "Diodis", status: "confirmed" }),
      });
      if (res.ok) {
        setShowNew(false);
        setNewRDV({ client_name: "", client_phone: "", client_email: "", service: "Coupe + Lavage", price: 35, date: todayStr, time: "09:00", note: "" });
        fetchBookings();
      }
    } finally { setSubmitting(false); }
  }

  // Calendar
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function toDateStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const bookingsByDate = bookings.reduce((acc, b) => {
    if (!acc[b.date]) acc[b.date] = [];
    acc[b.date].push(b);
    return acc;
  }, {} as Record<string, Booking[]>);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const dayBookings = bookingsByDate[selectedDate] ?? [];

  const todayBookings = bookings.filter(b => b.date === todayStr && b.status !== "cancelled");
  const upcomingBookings = bookings
    .filter(b => b.date > todayStr && b.status === "confirmed")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 5);

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <BarberSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "6px" }}>Mon Agenda</h1>
            <p style={{ color: "#555", fontSize: "13px" }}>Mes rendez-vous — Diodis</p>
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", border: "none", padding: "10px 22px", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 700, cursor: "pointer", borderRadius: "8px" }}>
            + Nouveau RDV
          </button>
        </div>

        {/* Aujourd'hui */}
        {todayBookings.length > 0 && (
          <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: "12px", padding: "20px 24px", marginBottom: "32px" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "14px" }}>Aujourd'hui — {todayBookings.length} RDV</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {todayBookings.sort((a, b) => a.time.localeCompare(b.time)).map(b => (
                <div key={b.id} onClick={() => { setSelected(b); setSelectedDate(b.date); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", border: "1px solid #1A1A1A", borderRadius: "8px", padding: "12px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <span style={{ color: "#D4AF37", fontSize: "14px", fontWeight: 500, minWidth: "50px" }}>{b.time}</span>
                    <div>
                      <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{b.client_name}</p>
                      <p style={{ color: "#555", fontSize: "12px" }}>{b.service}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ color: "#D4AF37", fontSize: "13px" }}>{b.price}$</span>
                    <span style={{ fontSize: "10px", letterSpacing: "1px", padding: "3px 10px", borderRadius: "20px", background: STATUS_CONFIG[b.status]?.bg, border: `1px solid ${STATUS_CONFIG[b.status]?.border}`, color: STATUS_CONFIG[b.status]?.color }}>
                      {STATUS_CONFIG[b.status]?.label ?? b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
          {/* Calendrier */}
          <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <button onClick={() => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); }}
                style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", color: "#D4AF37", padding: "6px 14px", cursor: "pointer", borderRadius: "6px", fontSize: "18px" }}>‹</button>
              <span style={{ color: "#F5F5F5", fontSize: "14px", letterSpacing: "2px" }}>{MONTHS_FR[viewMonth]} {viewYear}</span>
              <button onClick={() => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); }}
                style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", color: "#D4AF37", padding: "6px 14px", cursor: "pointer", borderRadius: "6px", fontSize: "18px" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "8px" }}>
              {["Di","Lu","Ma","Me","Je","Ve","Sa"].map(d => (
                <div key={d} style={{ textAlign: "center", color: "#555", fontSize: "11px", padding: "6px 0", letterSpacing: "1px" }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = toDateStr(viewYear, viewMonth, day);
                const hasBookings = !!(bookingsByDate[dateStr]?.some(b => b.status !== "cancelled"));
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                return (
                  <button key={i} onClick={() => setSelectedDate(dateStr)}
                    style={{
                      padding: "8px 4px", borderRadius: "6px", fontSize: "13px", cursor: "pointer",
                      background: isSelected ? "rgba(212,175,55,0.2)" : "transparent",
                      border: isSelected ? "1px solid rgba(212,175,55,0.5)" : isToday ? "1px solid rgba(212,175,55,0.2)" : "1px solid transparent",
                      color: isSelected ? "#D4AF37" : isToday ? "#D4AF37" : "#AAA",
                      fontWeight: isSelected ? 600 : 400,
                      position: "relative",
                    }}>
                    {day}
                    {hasBookings && <div style={{ position: "absolute", bottom: "2px", left: "50%", transform: "translateX(-50%)", width: "4px", height: "4px", borderRadius: "50%", background: "#7B68EE" }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RDV du jour sélectionné */}
          <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", padding: "24px" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", marginBottom: "16px", textTransform: "capitalize" as React.CSSProperties["textTransform"] }}>
              {formatDate(selectedDate)}
            </p>
            {loading ? (
              <p style={{ color: "#444", fontSize: "13px" }}>Chargement...</p>
            ) : dayBookings.length === 0 ? (
              <p style={{ color: "#444", fontSize: "13px" }}>Aucun rendez-vous</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {dayBookings.sort((a, b) => a.time.localeCompare(b.time)).map(b => {
                  const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.confirmed;
                  return (
                    <div key={b.id} onClick={() => setSelected(b)}
                      style={{ background: "#0A0A0A", border: `1px solid ${cfg.border}`, borderRadius: "8px", padding: "12px 16px", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ color: "#D4AF37", fontWeight: 500, fontSize: "14px" }}>{b.time}</span>
                        <span style={{ fontSize: "10px", letterSpacing: "1px", padding: "3px 8px", borderRadius: "20px", background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>
                      <p style={{ color: "#F5F5F5", fontSize: "13px" }}>{b.client_name}</p>
                      <p style={{ color: "#555", fontSize: "12px" }}>{b.service} · {b.price}$</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Prochains RDV */}
        {upcomingBookings.length > 0 && (
          <div style={{ marginTop: "32px", background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", padding: "24px" }}>
            <p style={{ color: "#7D8590", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Prochains rendez-vous</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {upcomingBookings.map(b => (
                <div key={b.id} onClick={() => setSelected(b)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1A1A1A", cursor: "pointer" }}>
                  <div>
                    <p style={{ color: "#F5F5F5", fontSize: "13px" }}>{b.client_name}</p>
                    <p style={{ color: "#555", fontSize: "12px", textTransform: "capitalize" }}>{formatDate(b.date)} à {b.time}</p>
                  </div>
                  <span style={{ color: "#777", fontSize: "12px" }}>{b.service}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal détail RDV */}
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: "20px" }}
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <div style={{ background: "#111318", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "16px", width: "100%", maxWidth: "480px", padding: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
                <div>
                  <p style={{ color: "#F5F5F5", fontSize: "18px", fontWeight: 400 }}>{selected.client_name}</p>
                  <p style={{ color: "#555", fontSize: "12px", textTransform: "capitalize", marginTop: "4px" }}>{formatDate(selected.date)} à {selected.time}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#666", fontSize: "24px", cursor: "pointer" }}>×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {[
                  ["Service", selected.service],
                  ["Prix", `${selected.price}$`],
                  selected.client_phone && ["Téléphone", selected.client_phone],
                  selected.client_email && ["Email", selected.client_email],
                  selected.note && ["Note", selected.note],
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                    <span style={{ color: "#555", fontSize: "12px" }}>{label}</span>
                    <span style={{ color: "#AAA", fontSize: "13px" }}>{value}</span>
                  </div>
                ))}
              </div>

              {selected.status === "confirmed" && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button onClick={() => updateStatus(selected.id, "completed")}
                    style={{ flex: 1, background: "rgba(85,170,85,0.1)", border: "1px solid rgba(85,170,85,0.3)", color: "#5a5", padding: "10px", cursor: "pointer", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
                    ✓ Complété
                  </button>
                  <button onClick={() => updateStatus(selected.id, "no_show")}
                    style={{ flex: 1, background: "rgba(255,153,0,0.08)", border: "1px solid rgba(255,153,0,0.2)", color: "#f90", padding: "10px", cursor: "pointer", borderRadius: "8px", fontSize: "12px" }}>
                    No-show
                  </button>
                  <button onClick={() => updateStatus(selected.id, "cancelled")}
                    style={{ flex: 1, background: "rgba(238,85,85,0.06)", border: "1px solid rgba(238,85,85,0.15)", color: "#e55", padding: "10px", cursor: "pointer", borderRadius: "8px", fontSize: "12px" }}>
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal nouveau RDV */}
        {showNew && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: "20px" }}
            onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
            <div style={{ background: "#111318", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "16px", width: "100%", maxWidth: "480px", padding: "32px", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Nouveau rendez-vous</p>
                <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", color: "#666", fontSize: "24px", cursor: "pointer" }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { label: "Nom client", key: "client_name", type: "text", placeholder: "Prénom Nom" },
                  { label: "Téléphone", key: "client_phone", type: "tel", placeholder: "418-000-0000" },
                  { label: "Email", key: "client_email", type: "email", placeholder: "client@email.com" },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{label}</label>
                    <input type={type} placeholder={placeholder} value={(newRDV as unknown as Record<string, string>)[key]}
                      onChange={e => setNewRDV(f => ({ ...f, [key]: e.target.value }))}
                      style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.15)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%" }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Service</label>
                  <select value={newRDV.service} onChange={e => { const svc = SERVICES.find(s => s.label === e.target.value); setNewRDV(f => ({ ...f, service: e.target.value, price: svc?.price ?? f.price })); }}
                    style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.15)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%" }}>
                    {SERVICES.map(s => <option key={s.label} value={s.label}>{s.label} — {s.price}$</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Date</label>
                    <input type="date" min={todayStr} value={newRDV.date} onChange={e => setNewRDV(f => ({ ...f, date: e.target.value }))}
                      style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.15)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%", colorScheme: "dark" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Heure</label>
                    <input type="time" value={newRDV.time} onChange={e => setNewRDV(f => ({ ...f, time: e.target.value }))}
                      style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.15)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%", colorScheme: "dark" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Note (optionnel)</label>
                  <textarea value={newRDV.note} onChange={e => setNewRDV(f => ({ ...f, note: e.target.value }))} rows={2}
                    style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.15)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%", resize: "none" }} />
                </div>
                <button onClick={submitNewRDV} disabled={!newRDV.client_name || !newRDV.date || submitting}
                  style={{ background: newRDV.client_name ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#1A1A1A", color: newRDV.client_name ? "#080808" : "#444", border: "none", padding: "14px", cursor: "pointer", borderRadius: "8px", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", marginTop: "8px" }}>
                  {submitting ? "..." : "Créer le rendez-vous"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
