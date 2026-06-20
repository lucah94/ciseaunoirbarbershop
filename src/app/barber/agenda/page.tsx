"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import BarberSidebar from "@/components/BarberSidebar";
import { localDateStr } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { serviceDuration } from "@/lib/serviceDuration";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type Booking = {
  id: string; client_name: string; client_phone: string; client_email: string;
  barber: string; service: string; price: number; date: string; time: string;
  status: string; note: string; end_time?: string;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  confirmed: { color: "#D4AF37", bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.25)", label: "Confirmé" },
  completed: { color: "#5a5",    bg: "rgba(85,170,85,0.08)",  border: "rgba(85,170,85,0.2)",   label: "Complété" },
  cancelled: { color: "#e55",    bg: "rgba(238,85,85,0.08)",  border: "rgba(238,85,85,0.2)",   label: "Annulé" },
  no_show:   { color: "#f90",    bg: "rgba(255,153,0,0.08)",  border: "rgba(255,153,0,0.2)",   label: "No-show" },
};

const SERVICES = [
  { label: "Coupe + Lavage", price: 35 },
  { label: "Coupe + Barbe à la lame", price: 50 },
  { label: "Coupe + Barbe Shaver", price: 45 },
  { label: "Service Premium", price: 75 },
  { label: "Rasage / Barbe", price: 25 },
  { label: "Enfant (12 ans et moins)", price: 30 },
];

const TIME_SLOTS: string[] = [];
for (let h = 8; h < 21; h++) {
  for (const m of [0, 15, 30, 45]) {
    if (h === 8 && m === 0) continue;
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

export default function BarberAgendaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newRDV, setNewRDV] = useState({
    client_name: "", client_phone: "", client_email: "",
    service: "Coupe + Lavage", price: 35,
    date: localDateStr(), time: "09:00", note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [barberSlug, setBarberSlug] = useState("melynda");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ date: "", time: "", service: "" });
  const [isMobile, setIsMobile] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);

  // Nom canonique du barbier (avec accent) pour écrire dans bookings + afficher
  const canonicalBarber = barberSlug === "stephanie" ? "Stéphanie" : "Melynda";

  const todayStr = localDateStr();

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Charger 60 jours dans le passé + tout le futur
  const getStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const getBarberName = (): string => {
    if (typeof document === "undefined") return "melynda";
    const match = document.cookie.match(/(?:^|;\s*)barber_name=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : "melynda";
  };

  const fetchBookings = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const barberName = norm(getBarberName());
    fetch(`/api/bookings?start=${getStartDate()}&_=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : []).filter((b: Booking) =>
          norm(b.barber) === barberName
        );
        setBookings(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Chargement initial + Supabase Realtime + polling 5 min
  useEffect(() => {
    setBarberSlug(getBarberName());
    fetchBookings();

    const channel = supabase
      .channel("bookings-barber-agenda-fc")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => { if (!selected && !showNew) fetchBookings(true); }
      )
      .subscribe();

    const interval = setInterval(() => {
      if (!selected && !showNew) fetchBookings(true);
    }, 300000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchBookings, selected, showNew]);

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

  // No-show passe par la route dédiée → SMS au client + email admin + Telegram (👻)
  async function markNoShow(id: string) {
    if (!confirm("Marquer comme no-show ? Le client recevra un SMS.")) return;
    const res = await fetch("/api/bookings/no-show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "no_show" } : b));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: "no_show" } : null);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Erreur: ${err.error || "impossible de marquer no-show"}`);
    }
  }

  function startEdit() {
    if (!selected) return;
    setEditForm({ date: selected.date, time: selected.time, service: selected.service });
    setEditing(true);
  }

  async function saveEdit() {
    if (!selected) return;
    const res = await fetch("/api/barber/manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "editBooking", id: selected.id, date: editForm.date, time: editForm.time, service: editForm.service }),
    });
    const data = await res.json().catch(() => ({ error: "Erreur" }));
    if (data.error) { alert("Erreur: " + data.error); return; }
    setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, ...editForm } : b));
    setSelected(prev => prev ? { ...prev, ...editForm } : null);
    setEditing(false);
    fetchBookings(true);
  }

  async function submitNewRDV() {
    if (!newRDV.client_name.trim() || !newRDV.date || !newRDV.time) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newRDV, barber: canonicalBarber, status: "confirmed", force: true }),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData?.id) {
        setBookings(prev => [...prev, resData as Booking]);
        if (calendarRef.current) {
          calendarRef.current.getApi().gotoDate(newRDV.date);
        }
        setShowNew(false);
        setSubmitError(null);
        setNewRDV({ client_name: "", client_phone: "", client_email: "", service: "Coupe + Lavage", price: 35, date: todayStr, time: "09:00", note: "" });
      } else {
        setSubmitError(res.status === 409
          ? `⚠️ ${resData?.error || "Ce créneau est déjà occupé."}`
          : `Erreur: ${resData?.error || "Impossible de créer le RDV."}`
        );
      }
    } catch {
      setSubmitError("Erreur de connexion. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  // Build FullCalendar events from bookings
  const events = bookings
    .filter(b => b.status !== "cancelled")
    .map(b => {
      const [h, m] = (b.time || "0:0").split(":").map(Number);
      const padded = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const start = new Date(`${b.date}T${padded}:00`);
      const end = new Date(start.getTime());
      if (b.end_time) {
        const [eh, em] = b.end_time.split(":").map(Number);
        end.setHours(eh, em, 0, 0);
      } else {
        end.setMinutes(end.getMinutes() + serviceDuration(b.service));
      }
      const startStr = isNaN(start.getTime()) ? b.date : start.toISOString();
      const endStr = isNaN(end.getTime()) ? b.date : end.toISOString();
      const isNoShow = b.status === "no_show";
      return {
        id: b.id,
        title: `${b.client_name} — ${b.service}`,
        start: startStr,
        end: endStr,
        backgroundColor: isNoShow ? "rgba(255,153,0,0.3)" : "rgba(212,175,55,0.85)",
        borderColor: isNoShow ? "#f90" : "#D4AF37",
        textColor: "#080808",
        extendedProps: { booking: b },
        classNames: isNoShow ? ["event-noshow"] : [],
      };
    });

  const inputStyle: React.CSSProperties = {
    background: "#1C2129",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#F0F0F0",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    color: "#8B949E",
    fontSize: "11px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex" }}>
      <BarberSidebar />

      <main style={{ marginLeft: isMobile ? 0 : "260px", flex: 1, padding: isMobile ? "16px 16px 88px" : "32px 40px" }}>

        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "28px",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "16px" : "0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={barberSlug === "stephanie" ? "/images/stephanie.jpg" : barberSlug === "melynda" ? "/images/melynda.jpg" : "/images/chair-barbier.jpg"}
              alt={canonicalBarber}
              style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(212,175,55,0.5)", flexShrink: 0 }}
            />
            <div>
              <h1 style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>
                Bonjour {canonicalBarber}
              </h1>
              <p style={{ color: "#555", fontSize: "13px" }}>
                {bookings.filter(b => b.status !== "cancelled").length} RDV actifs
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowNew(true)}
            style={{
              background: "linear-gradient(135deg, #D4AF37, #B8860B)",
              color: "#080808", border: "none",
              padding: isMobile ? "8px 18px" : "10px 22px",
              fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase",
              fontWeight: 700, cursor: "pointer", borderRadius: "8px",
              whiteSpace: "nowrap",
            }}
          >
            + Nouveau RDV
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{
              width: "40px", height: "40px", border: "3px solid rgba(212,175,55,0.2)",
              borderTop: "3px solid #D4AF37", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</p>
          </div>
        ) : (
          /* Calendar container */
          <div style={{
            background: "#161B22",
            border: "1px solid rgba(212,175,55,0.18)",
            borderRadius: "16px",
            padding: isMobile ? "12px" : "24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}>
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              .fc {
                --fc-border-color: rgba(212,175,55,0.15);
                --fc-today-bg-color: rgba(212,175,55,0.08);
                --fc-page-bg-color: #111318;
                --fc-neutral-bg-color: #161B22;
                --fc-list-event-hover-bg-color: rgba(212,175,55,0.12);
                font-family: inherit;
              }
              .fc .fc-toolbar-title {
                font-size: ${isMobile ? "14px" : "20px"} !important;
                font-weight: 300 !important;
                letter-spacing: ${isMobile ? "1px" : "4px"} !important;
                color: #F0F0F0 !important;
                text-transform: uppercase !important;
                background: linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B) !important;
                background-size: 200% auto !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
              }
              .fc .fc-button {
                background: #1C2129 !important;
                border: 1px solid rgba(212,175,55,0.2) !important;
                color: #999 !important;
                font-size: ${isMobile ? "9px" : "11px"} !important;
                letter-spacing: 1px !important;
                text-transform: uppercase !important;
                padding: ${isMobile ? "5px 8px" : "8px 18px"} !important;
                border-radius: 6px !important;
                transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1) !important;
              }
              .fc .fc-button:hover {
                background: rgba(212,175,55,0.1) !important;
                color: #D4AF37 !important;
                border-color: rgba(212,175,55,0.5) !important;
                box-shadow: 0 0 20px rgba(212,175,55,0.15), 0 4px 12px rgba(212,175,55,0.1) !important;
              }
              .fc .fc-button-active {
                background: linear-gradient(135deg, #D4AF37, #B8860B) !important;
                color: #080808 !important;
                border-color: #D4AF37 !important;
                font-weight: 600 !important;
                box-shadow: 0 0 25px rgba(212,175,55,0.3), 0 4px 16px rgba(212,175,55,0.2) !important;
              }
              .fc .fc-col-header-cell {
                background: #1C2129 !important;
                padding: ${isMobile ? "8px 0" : "14px 0"} !important;
                border-bottom: 1px solid rgba(212,175,55,0.12) !important;
              }
              .fc .fc-col-header-cell-cushion {
                color: #D4AF37 !important;
                font-size: ${isMobile ? "10px" : "12px"} !important;
                letter-spacing: ${isMobile ? "1px" : "3px"} !important;
                text-transform: uppercase !important;
                text-decoration: none !important;
                font-weight: 500 !important;
              }
              .fc .fc-timegrid-slot {
                height: ${isMobile ? "44px" : "56px"} !important;
                border-color: rgba(212,175,55,0.10) !important;
              }
              .fc .fc-timegrid-slot-label-cushion {
                color: #8B949E !important;
                font-size: ${isMobile ? "10px" : "12px"} !important;
                font-variant-numeric: tabular-nums !important;
                font-weight: 400 !important;
              }
              .fc .fc-timegrid-event {
                border-radius: 8px !important;
                border-width: 0 0 0 4px !important;
                padding: ${isMobile ? "4px 6px" : "6px 10px"} !important;
                font-size: ${isMobile ? "11px" : "13px"} !important;
                cursor: pointer !important;
                transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1) !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
              }
              .fc .fc-timegrid-event:hover {
                transform: scale(1.03) !important;
                box-shadow: 0 4px 20px rgba(212,175,55,0.25), 0 0 30px rgba(212,175,55,0.1) !important;
                z-index: 10 !important;
              }
              .fc .fc-timegrid-event .fc-event-title {
                font-weight: 600 !important;
                font-size: ${isMobile ? "11px" : "13px"} !important;
              }
              .fc .fc-timegrid-event .fc-event-time {
                font-size: ${isMobile ? "9px" : "11px"} !important;
                opacity: 0.85 !important;
                font-weight: 500 !important;
              }
              .fc .fc-daygrid-event {
                border-radius: 6px !important;
                padding: 4px 8px !important;
                font-size: 12px !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
              }
              .fc .fc-daygrid-event:hover {
                box-shadow: 0 4px 16px rgba(212,175,55,0.2) !important;
                transform: translateY(-1px) !important;
              }
              .fc .fc-scrollgrid {
                border-color: rgba(212,175,55,0.15) !important;
                border-radius: 12px !important;
                overflow: hidden !important;
              }
              .fc td, .fc th {
                border-color: rgba(212,175,55,0.12) !important;
              }
              .fc .fc-timegrid-now-indicator-line {
                border-color: #D4AF37 !important;
                border-width: 2px !important;
                box-shadow: 0 0 12px rgba(212,175,55,0.5), 0 0 24px rgba(212,175,55,0.2) !important;
              }
              .fc .fc-timegrid-now-indicator-arrow {
                border-color: #D4AF37 !important;
                border-top-color: transparent !important;
                border-bottom-color: transparent !important;
              }
              .fc .fc-day-today {
                background: rgba(212,175,55,0.06) !important;
              }
              .fc .fc-day-today .fc-col-header-cell-cushion {
                color: #F0F0F0 !important;
                font-weight: 700 !important;
                text-shadow: 0 0 10px rgba(212,175,55,0.5) !important;
              }
              .fc .fc-daygrid-day:hover {
                background: rgba(212,175,55,0.05) !important;
              }
              .fc .fc-daygrid-day-number {
                color: #8B949E !important;
              }
              .fc .fc-daygrid-day:hover .fc-daygrid-day-number {
                color: #D4AF37 !important;
              }
              .event-noshow { background-color: rgba(255,153,0,0.28) !important; border-color: #f90 !important; border-left: 4px solid #f90 !important; opacity: 1 !important; }
              .event-noshow .fc-event-title { color: #ffb84d !important; font-weight: 700 !important; }
              ${isMobile ? `
              .fc .fc-toolbar {
                flex-direction: column !important;
                gap: 8px !important;
              }
              .fc .fc-toolbar-chunk {
                display: flex !important;
                justify-content: center !important;
              }
              ` : ""}
            `}</style>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "timeGridDay,timeGridWeek,dayGridMonth",
              }}
              locale="fr"
              firstDay={1}
              slotMinTime="08:00:00"
              slotMaxTime="21:00:00"
              slotDuration="00:30:00"
              snapDuration="00:15:00"
              allDaySlot={false}
              nowIndicator={true}
              height="auto"
              expandRows={true}
              editable={false}
              events={events}
              eventClick={(info) => {
                const b = info.event.extendedProps.booking as Booking;
                setSelected(b);
              }}
              buttonText={{
                today: "Aujourd'hui",
                month: "Mois",
                week: "Semaine",
                day: "Jour",
              }}
            />
          </div>
        )}

        {/* Modal détail RDV */}
        {selected && (
          <>
            <div
              onClick={() => { setSelected(null); setEditing(false); }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 400 }}
            />
            <div style={{
              position: "fixed",
              ...(isMobile
                ? { bottom: "72px", left: 0, right: 0, maxHeight: "80vh", borderRadius: "16px 16px 0 0", borderTop: "2px solid #D4AF37" }
                : { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "460px", maxHeight: "90vh", borderRadius: "16px", border: "1px solid rgba(212,175,55,0.25)" }
              ),
              overflowY: "auto",
              background: "#111318",
              zIndex: 410,
              padding: isMobile ? "24px 20px 32px" : "32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <p style={{ color: "#F5F5F5", fontSize: "18px", fontWeight: 400 }}>{selected.client_name}</p>
                  <p style={{ color: "#555", fontSize: "12px", marginTop: "4px", textTransform: "capitalize" }}>
                    {formatDate(selected.date)} à {selected.time}
                  </p>
                </div>
                <button
                  onClick={() => { setSelected(null); setEditing(false); }}
                  style={{ background: "none", border: "none", color: "#666", fontSize: "24px", cursor: "pointer" }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {([
                  ["Service", selected.service],
                  ["Prix", `${selected.price}$`],
                  selected.client_phone ? ["Téléphone", selected.client_phone] : null,
                  selected.client_email ? ["Email", selected.client_email] : null,
                  selected.note ? ["Note", selected.note] : null,
                ] as ([string, string] | null)[]).filter(Boolean).map(row => {
                  const [label, value] = row as [string, string];
                  return (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                      <span style={{ color: "#555", fontSize: "12px" }}>{label}</span>
                      <span style={{ color: "#AAA", fontSize: "13px", textAlign: "right", maxWidth: "60%" }}>
                        {label === "Téléphone" ? (
                          <a href={`tel:${value}`} style={{ color: "inherit", textDecoration: "none" }}>{value}</a>
                        ) : (
                          value
                        )}
                      </span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                  <span style={{ color: "#555", fontSize: "12px" }}>Statut</span>
                  <span style={{ color: STATUS_CONFIG[selected.status]?.color ?? "#999", fontSize: "12px", fontWeight: 600 }}>
                    {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                  </span>
                </div>
              </div>

              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Date</label>
                    <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                      style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#F0F0F0", padding: "10px 12px", borderRadius: "6px", colorScheme: "dark", fontSize: "14px", width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Heure</label>
                    <input type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                      style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#F0F0F0", padding: "10px 12px", borderRadius: "6px", colorScheme: "dark", fontSize: "14px", width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>Service</label>
                    <select value={editForm.service} onChange={e => setEditForm(f => ({ ...f, service: e.target.value }))}
                      style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#F0F0F0", padding: "10px 12px", borderRadius: "6px", fontSize: "14px", width: "100%" }}>
                      {!SERVICES.some(s => s.label === editForm.service) && <option value={editForm.service}>{editForm.service}</option>}
                      {SERVICES.map(s => <option key={s.label} value={s.label}>{s.label} — {s.price}$</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <button onClick={() => setEditing(false)} style={{ flex: 1, background: "none", border: "1px solid #2A2A2A", color: "#888", padding: "11px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Annuler</button>
                    <button onClick={saveEdit} style={{ flex: 1, background: "linear-gradient(135deg,#D4AF37,#B8860B)", color: "#080808", border: "none", padding: "11px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>Sauvegarder</button>
                  </div>
                </div>
              ) : selected.status === "confirmed" && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button onClick={startEdit}
                    style={{ flexBasis: "100%", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", padding: "11px", cursor: "pointer", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}>
                    Modifier (date / heure / service)
                  </button>
                  <button onClick={() => updateStatus(selected.id, "completed")}
                    style={{ flex: 1, background: "rgba(85,170,85,0.1)", border: "1px solid rgba(85,170,85,0.3)", color: "#5a5", padding: "10px", cursor: "pointer", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
                    Complété
                  </button>
                  <button onClick={() => markNoShow(selected.id)}
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
          </>
        )}

        {/* Modal nouveau RDV */}
        {showNew && (
          <>
            <div
              onClick={() => setShowNew(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 500 }}
            />
            <div style={{
              position: "fixed",
              ...(isMobile
                ? { bottom: "72px", left: 0, right: 0, maxHeight: "85vh", borderRadius: "16px 16px 0 0", borderTop: "2px solid #D4AF37" }
                : { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "480px", maxHeight: "90vh", borderRadius: "16px", border: "1px solid rgba(212,175,55,0.2)" }
              ),
              overflowY: "auto",
              background: "#0D0D0D",
              zIndex: 510,
              padding: isMobile ? "24px 20px 32px" : "32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 80px rgba(212,175,55,0.06)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Nouveau rendez-vous</p>
                <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", color: "#666", fontSize: "24px", cursor: "pointer" }}>&times;</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { label: "Nom client *", key: "client_name", type: "text", placeholder: "Prénom Nom" },
                  { label: "Téléphone", key: "client_phone", type: "tel", placeholder: "418-000-0000" },
                  { label: "Email", key: "client_email", type: "email", placeholder: "client@email.com" },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input type={type} placeholder={placeholder} value={(newRDV as unknown as Record<string, string>)[key]}
                      onChange={e => setNewRDV(f => ({ ...f, [key]: e.target.value }))}
                      style={inputStyle} />
                  </div>
                ))}
                <div>
                  <label style={labelStyle}>Service *</label>
                  <select value={newRDV.service} onChange={e => { const svc = SERVICES.find(s => s.label === e.target.value); setNewRDV(f => ({ ...f, service: e.target.value, price: svc?.price ?? f.price })); }}
                    style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as React.CSSProperties["appearance"] }}>
                    {SERVICES.map(s => <option key={s.label} value={s.label}>{s.label} — {s.price}$</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Date *</label>
                    <input type="date" min={todayStr} value={newRDV.date} onChange={e => setNewRDV(f => ({ ...f, date: e.target.value }))}
                      style={{ ...inputStyle, colorScheme: "dark" as React.CSSProperties["colorScheme"] }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Heure *</label>
                    <select value={newRDV.time} onChange={e => setNewRDV(f => ({ ...f, time: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as React.CSSProperties["appearance"] }}>
                      {TIME_SLOTS.map(t => {
                        const now = new Date();
                        const isToday = newRDV.date === localDateStr(now);
                        const [tH, tM] = t.split(":").map(Number);
                        const isPast = isToday && (tH < now.getHours() || (tH === now.getHours() && tM <= now.getMinutes()));
                        return (
                          <option key={t} value={t} disabled={isPast} style={isPast ? { color: "#666" } : undefined}>
                            {t}{isPast ? " (passé)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Note (optionnel)</label>
                  <textarea value={newRDV.note} onChange={e => setNewRDV(f => ({ ...f, note: e.target.value }))} rows={2}
                    style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <div style={{ background: "rgba(212,175,55,0.06)", borderRadius: "8px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#888", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>Prix</span>
                  <span style={{ color: "#D4AF37", fontSize: "18px", fontWeight: 600 }}>{newRDV.price}$</span>
                </div>
                {submitError && (
                  <div style={{ background: "rgba(238,85,85,0.1)", border: "1px solid rgba(238,85,85,0.3)", borderRadius: "8px", padding: "12px 16px", color: "#e55", fontSize: "13px" }}>
                    {submitError}
                  </div>
                )}
                <button onClick={submitNewRDV} disabled={!newRDV.client_name.trim() || !newRDV.date || submitting}
                  style={{
                    background: newRDV.client_name.trim() ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#1A1A1A",
                    color: newRDV.client_name.trim() ? "#080808" : "#444",
                    border: "none", padding: "14px", cursor: "pointer", borderRadius: "8px",
                    fontSize: "13px", fontWeight: 700, letterSpacing: "1px", marginTop: "8px", width: "100%",
                  }}>
                  {submitting ? "Enregistrement..." : "Créer le rendez-vous"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
