"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type Booking = {
  id: string; client_name: string; client_phone: string; client_email: string;
  barber: string; service: string; price: number; date: string; time: string;
  status: string; note: string;
};

type ClientResult = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#D4AF37",
  completed: "#5a5",
  cancelled: "#e55",
  no_show: "#f90",
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirme",
  completed: "Complete",
  cancelled: "Annule",
  no_show: "No-show",
};

const BARBER_COLORS: Record<string, string> = {
  Melynda: "#D4AF37",
  Diodis: "#7B68EE",
};

const SERVICES = [
  { label: "Coupe + Lavage", price: 35 },
  { label: "Coupe + Rasage Lame & Serviette Chaude", price: 50 },
  { label: "Service Premium", price: 75 },
  { label: "Rasage / Barbe", price: 25 },
  { label: "Tarif Etudiant", price: 30 },
];

const TIME_SLOTS: string[] = [];
for (let h = 8; h < 20; h++) {
  for (const m of [0, 30]) {
    if (h === 8 && m === 0) continue; // start at 08:30
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export default function AgendaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<"all" | "Melynda" | "Diodis">("all");
  const calendarRef = useRef<FullCalendar>(null);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
  const [isMobile, setIsMobile] = useState(false);

  // New RDV modal state
  const [showNewRDV, setShowNewRDV] = useState(false);
  const [newRDV, setNewRDV] = useState({
    client_name: "", client_phone: "", client_email: "",
    barber: "Melynda", service: "Coupe + Lavage", price: 35,
    date: new Date().toISOString().split("T")[0], time: "09:00", note: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Close client dropdown on outside click or Escape
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchBookings = useCallback(() => {
    setLoading(true);
    fetch("/api/bookings?start=2026-01-01")
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setBookings(list);
        setLoading(false);

        // Fetch loyalty visit counts for unique client emails
        const emails = [...new Set(list.map((b: Booking) => b.client_email).filter(Boolean))] as string[];
        emails.forEach(email => {
          fetch(`/api/loyalty?email=${encodeURIComponent(email)}`)
            .then(r => r.json())
            .then(d => {
              if (d && typeof d.visits === "number") {
                setVisitCounts(prev => ({ ...prev, [email]: d.visits }));
              }
            })
            .catch(() => {});
        });
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // Client search with debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (clientSearch.trim().length < 2) {
      setClientResults([]);
      setShowClientDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/clients?q=${encodeURIComponent(clientSearch.trim())}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setClientResults(data);
            setShowClientDropdown(data.length > 0);
          }
        })
        .catch(() => {});
    }, 300);
  }, [clientSearch]);

  function selectClient(c: ClientResult) {
    setNewRDV(prev => ({
      ...prev,
      client_name: c.name || "",
      client_phone: c.phone || "",
      client_email: c.email || "",
    }));
    setClientSearch(c.name || "");
    setShowClientDropdown(false);
    setClientResults([]);
  }

  async function submitNewRDV() {
    if (!newRDV.client_name.trim() || !newRDV.date || !newRDV.time) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: newRDV.client_name.trim(),
          client_phone: newRDV.client_phone.trim(),
          client_email: newRDV.client_email.trim(),
          barber: newRDV.barber,
          service: newRDV.service,
          price: newRDV.price,
          date: newRDV.date,
          time: newRDV.time,
          note: newRDV.note.trim(),
          status: "confirmed",
        }),
      });
      if (res.ok) {
        setShowNewRDV(false);
        resetNewRDVForm();
        fetchBookings();
      }
    } catch (e) {
      console.error("New RDV error:", e);
    } finally {
      setSubmitting(false);
    }
  }

  function resetNewRDVForm() {
    setNewRDV({
      client_name: "", client_phone: "", client_email: "",
      barber: "Melynda", service: "Coupe + Lavage", price: 35,
      date: new Date().toISOString().split("T")[0], time: "09:00", note: "",
    });
    setClientSearch("");
    setClientResults([]);
    setShowClientDropdown(false);
  }

  async function updateStatus(id: string, status: string) {
    if (status === "cancelled" && !confirm("Etes-vous sur de vouloir annuler ce rendez-vous ?")) return;
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);

    if (status === "completed") {
      const booking = bookings.find(b => b.id === id);
      if (booking?.client_email) {
        await fetch("/api/review-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: booking.client_name,
            client_email: booking.client_email,
            barber: booking.barber,
            service: booking.service,
          }),
        });
      }
    }
  }

  async function markNoShow(id: string) {
    if (!confirm("Marquer ce rendez-vous comme no-show ? Un SMS sera envoye au client.")) return;
    const res = await fetch("/api/bookings/no-show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "no_show" } : b));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: "no_show" } : null);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  function isPastBooking(b: Booking): boolean {
    return b.date < today || (b.date === today && b.time < new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", hour12: false }));
  }

  const filtered = bookings.filter(b => {
    if (filter !== "all" && b.barber !== filter) return false;
    return true;
  });

  const events = filtered.map(b => {
    const [h, m] = (b.time || "0:0").split(":").map(Number);
    const padded = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const start = new Date(`${b.date}T${padded}:00`);
    const end = new Date(start.getTime());
    end.setMinutes(end.getMinutes() + 45);

    const startStr = isNaN(start.getTime()) ? b.date : start.toISOString();
    const endStr = isNaN(end.getTime()) ? b.date : end.toISOString();

    return {
      id: b.id,
      title: `${b.client_name}${visitCounts[b.client_email] ? ` (${visitCounts[b.client_email]}e)` : ""} — ${b.service}`,
      start: startStr,
      end: endStr,
      backgroundColor: b.status === "cancelled" ? "#333" : (BARBER_COLORS[b.barber] || "#D4AF37"),
      borderColor: b.status === "cancelled" ? "#555" : (BARBER_COLORS[b.barber] || "#D4AF37"),
      textColor: b.status === "cancelled" ? "#888" : "#080808",
      extendedProps: { booking: b },
      classNames: b.status === "cancelled" ? ["event-cancelled"] : b.status === "no_show" ? ["event-noshow"] : [],
    };
  });

  // Conflict detection for new RDV form
  const occupiedSlots = useMemo(() => {
    if (!newRDV.barber || !newRDV.date) return new Set<string>();
    const barberBookings = bookings.filter(
      b => b.barber === newRDV.barber && b.date === newRDV.date && b.status !== "cancelled"
    );
    const occupied = new Set<string>();
    for (const slot of TIME_SLOTS) {
      const [sh, sm] = slot.split(":").map(Number);
      const slotMin = sh * 60 + sm;
      for (const b of barberBookings) {
        const [bh, bm] = (b.time || "0:0").split(":").map(Number);
        const bookingMin = bh * 60 + bm;
        if (Math.abs(slotMin - bookingMin) < 45) {
          occupied.add(slot);
          break;
        }
      }
    }
    return occupied;
  }, [bookings, newRDV.barber, newRDV.date]);

  const currentSlotConflict = useMemo(() => {
    if (!newRDV.barber || !newRDV.date || !newRDV.time) return null;
    const [sh, sm] = newRDV.time.split(":").map(Number);
    const slotMin = sh * 60 + sm;
    const barberBookings = bookings.filter(
      b => b.barber === newRDV.barber && b.date === newRDV.date && b.status !== "cancelled"
    );
    for (const b of barberBookings) {
      const [bh, bm] = (b.time || "0:0").split(":").map(Number);
      const bookingMin = bh * 60 + bm;
      if (Math.abs(slotMin - bookingMin) < 45) {
        return `${newRDV.barber} est deja reservee a cet horaire`;
      }
    }
    return null;
  }, [bookings, newRDV.barber, newRDV.date, newRDV.time]);

  // Shared input style
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#111",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#F0F0F0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    color: "#888",
    fontSize: "11px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />

      <main style={{ marginLeft: isMobile ? 0 : "260px", flex: 1, padding: isMobile ? "16px 16px 88px" : "32px 40px" }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "24px",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "16px" : "0",
        }}>
          <div>
            <h1 style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 300, letterSpacing: "2px", color: "#F0F0F0", marginBottom: "6px" }}>
              Agenda
            </h1>
            <p style={{ color: "#555", fontSize: "13px", letterSpacing: "1px" }}>
              {bookings.filter(b => b.status !== "cancelled").length} reservation{bookings.filter(b => b.status !== "cancelled").length > 1 ? "s" : ""} actives
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Barber filters */}
            {[
              { key: "all" as const, label: "Toutes", color: "#D4AF37" },
              { key: "Melynda" as const, label: "Melynda", color: "#D4AF37" },
              { key: "Diodis" as const, label: "Diodis", color: "#7B68EE" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  background: filter === f.key ? f.color : "#0D0D0D",
                  border: `1px solid ${filter === f.key ? f.color : "rgba(255,255,255,0.08)"}`,
                  color: filter === f.key ? "#080808" : "#666",
                  padding: isMobile ? "6px 14px" : "8px 20px",
                  fontSize: isMobile ? "10px" : "11px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  borderRadius: "20px",
                  transition: "all 0.2s ease",
                  fontWeight: filter === f.key ? 600 : 400,
                }}
              >
                {f.label}
              </button>
            ))}

            {/* New RDV button */}
            <button
              onClick={() => { resetNewRDVForm(); setShowNewRDV(true); }}
              style={{
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                border: "none",
                color: "#080808",
                padding: isMobile ? "6px 14px" : "8px 20px",
                fontSize: isMobile ? "10px" : "11px",
                letterSpacing: "1px",
                textTransform: "uppercase",
                cursor: "pointer",
                borderRadius: "20px",
                fontWeight: 700,
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              + Nouveau RDV
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "24px", flexDirection: isMobile ? "column" : "row" }}>
            {/* Calendar */}
            <div style={{
              flex: 1,
              background: "linear-gradient(135deg, #0D0D0D, #0A0A0A)",
              border: "1px solid rgba(212,175,55,0.12)",
              borderRadius: "16px",
              padding: isMobile ? "12px" : "24px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 0 60px rgba(212,175,55,0.04), inset 0 1px 0 rgba(212,175,55,0.08)",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* Gold glow corners */}
              <div style={{ position: "absolute", top: 0, left: 0, width: "100px", height: "100px", background: "radial-gradient(circle at top left, rgba(212,175,55,0.08), transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: 0, right: 0, width: "100px", height: "100px", background: "radial-gradient(circle at top right, rgba(212,175,55,0.08), transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "100px", height: "100px", background: "radial-gradient(circle at bottom left, rgba(212,175,55,0.05), transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 0, right: 0, width: "100px", height: "100px", background: "radial-gradient(circle at bottom right, rgba(212,175,55,0.05), transparent 70%)", pointerEvents: "none" }} />
              <style>{`
                @keyframes goldPulse {
                  0%, 100% { box-shadow: 0 0 8px rgba(212,175,55,0.1); }
                  50% { box-shadow: 0 0 20px rgba(212,175,55,0.25), 0 0 40px rgba(212,175,55,0.08); }
                }
                @keyframes goldGlow {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 0.7; }
                }
                .fc {
                  --fc-border-color: rgba(212,175,55,0.08);
                  --fc-today-bg-color: rgba(212,175,55,0.06);
                  --fc-page-bg-color: #080808;
                  --fc-neutral-bg-color: #0D0D0D;
                  --fc-list-event-hover-bg-color: rgba(212,175,55,0.12);
                  font-family: inherit;
                }
                .fc .fc-toolbar-title {
                  font-size: ${isMobile ? "14px" : "22px"} !important;
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
                  background: #0D0D0D !important;
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
                  background: linear-gradient(180deg, #0D0D0D, #0A0A0A) !important;
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
                  border-color: rgba(212,175,55,0.04) !important;
                  transition: background 0.2s ease !important;
                }
                .fc .fc-timegrid-slot:hover {
                  background: rgba(212,175,55,0.03) !important;
                }
                .fc .fc-timegrid-slot-label-cushion {
                  color: #555 !important;
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
                  border-color: rgba(212,175,55,0.08) !important;
                  border-radius: 12px !important;
                  overflow: hidden !important;
                }
                .fc td, .fc th {
                  border-color: rgba(212,175,55,0.05) !important;
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
                  background: rgba(212,175,55,0.04) !important;
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
                  color: #888 !important;
                  transition: all 0.2s ease !important;
                }
                .fc .fc-daygrid-day:hover .fc-daygrid-day-number {
                  color: #D4AF37 !important;
                  text-shadow: 0 0 8px rgba(212,175,55,0.4) !important;
                }
                .event-cancelled .fc-event-title { text-decoration: line-through !important; opacity: 0.5 !important; }
                .event-noshow { opacity: 0.5 !important; border-left-color: #f90 !important; }
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
                slotMaxTime="20:00:00"
                slotDuration="00:30:00"
                allDaySlot={false}
                nowIndicator={true}
                height="auto"
                expandRows={true}
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

            {/* Detail panel - desktop: sidebar, mobile: bottom sheet */}
            {selected && !isMobile && (
              <div style={{
                width: "320px",
                flexShrink: 0,
                background: "#0D0D0D",
                border: "1px solid rgba(212,175,55,0.1)",
                borderRadius: "12px",
                padding: "28px 24px",
                alignSelf: "flex-start",
                position: "sticky",
                top: "32px",
              }}>
                {renderDetailContent()}
              </div>
            )}
          </div>
        )}

        {/* Mobile bottom sheet for detail */}
        {selected && isMobile && (
          <>
            <div
              onClick={() => setSelected(null)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 140,
              }}
            />
            <div style={{
              position: "fixed",
              bottom: "72px",
              left: 0,
              right: 0,
              height: "auto",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "#0D0D0D",
              borderTop: "2px solid #D4AF37",
              zIndex: 150,
              padding: "24px",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
            }}>
              {renderDetailContent()}
            </div>
          </>
        )}

        {/* New RDV Modal / Bottom Sheet */}
        {showNewRDV && (
          <>
            <div
              onClick={() => setShowNewRDV(false)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200,
              }}
            />
            <div style={{
              position: "fixed",
              ...(isMobile
                ? { bottom: "72px", left: 0, right: 0, maxHeight: "85vh", borderRadius: "16px 16px 0 0", borderTop: "2px solid #D4AF37" }
                : { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "480px", maxHeight: "90vh", borderRadius: "16px", border: "1px solid rgba(212,175,55,0.2)" }
              ),
              overflowY: "auto",
              background: "#0D0D0D",
              zIndex: 210,
              padding: isMobile ? "24px 20px 32px" : "32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 80px rgba(212,175,55,0.06)",
            }}>
              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ color: "#F0F0F0", fontSize: "18px", fontWeight: 300, letterSpacing: "2px" }}>
                  Nouveau RDV
                </h2>
                <button
                  onClick={() => setShowNewRDV(false)}
                  style={{ background: "none", border: "none", color: "#555", fontSize: "22px", cursor: "pointer", padding: "4px 8px" }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Client search */}
                <div ref={clientDropdownRef} style={{ position: "relative" }}>
                  <label style={labelStyle}>Recherche client</label>
                  <input
                    type="text"
                    placeholder="Nom ou telephone..."
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); }}
                    style={inputStyle}
                  />
                  {showClientDropdown && clientResults.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 220,
                      background: "#111", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px",
                      maxHeight: "200px", overflowY: "auto", marginTop: "4px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                    }}>
                      {clientResults.map(c => (
                        <div
                          key={c.id}
                          onClick={() => selectClient(c)}
                          style={{
                            padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,175,55,0.1)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ color: "#F0F0F0", fontSize: "14px" }}>{c.name}</div>
                          <div style={{ color: "#666", fontSize: "12px" }}>{c.phone}{c.email ? ` - ${c.email}` : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label style={labelStyle}>Nom *</label>
                  <input
                    type="text"
                    value={newRDV.client_name}
                    onChange={e => setNewRDV(p => ({ ...p, client_name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                {/* Phone + Email row */}
                <div style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Telephone</label>
                    <input
                      type="tel"
                      value={newRDV.client_phone}
                      onChange={e => setNewRDV(p => ({ ...p, client_phone: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Email (optionnel)</label>
                    <input
                      type="email"
                      value={newRDV.client_email}
                      onChange={e => setNewRDV(p => ({ ...p, client_email: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Barber + Service row */}
                <div style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Barbiere *</label>
                    <select
                      value={newRDV.barber}
                      onChange={e => setNewRDV(p => ({ ...p, barber: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
                    >
                      <option value="Melynda">Melynda</option>
                      <option value="Diodis">Diodis</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Service *</label>
                    <select
                      value={newRDV.service}
                      onChange={e => {
                        const svc = SERVICES.find(s => s.label === e.target.value);
                        setNewRDV(p => ({ ...p, service: e.target.value, price: svc?.price || 0 }));
                      }}
                      style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
                    >
                      {SERVICES.map(s => (
                        <option key={s.label} value={s.label}>{s.label} ({s.price}$)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date + Time row */}
                <div style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Date *</label>
                    <input
                      type="date"
                      value={newRDV.date}
                      onChange={e => setNewRDV(p => ({ ...p, date: e.target.value }))}
                      style={{ ...inputStyle, colorScheme: "dark" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Heure *</label>
                    <select
                      value={newRDV.time}
                      onChange={e => setNewRDV(p => ({ ...p, time: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
                    >
                      {TIME_SLOTS.map(t => {
                        const isOccupied = occupiedSlots.has(t);
                        return (
                          <option key={t} value={t} disabled={isOccupied} style={isOccupied ? { color: "#666" } : undefined}>
                            {t}{isOccupied ? " (occupe)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Conflict warning */}
                {currentSlotConflict && (
                  <div style={{
                    background: "rgba(200,50,50,0.1)",
                    border: "1px solid #e55",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#e55",
                    fontSize: "13px",
                  }}>
                    {currentSlotConflict}
                  </div>
                )}

                {/* Note */}
                <div>
                  <label style={labelStyle}>Note (optionnel)</label>
                  <textarea
                    value={newRDV.note}
                    onChange={e => setNewRDV(p => ({ ...p, note: e.target.value }))}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                {/* Price display */}
                <div style={{
                  background: "rgba(212,175,55,0.06)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{ color: "#888", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>Prix</span>
                  <span style={{ color: "#D4AF37", fontSize: "18px", fontWeight: 600 }}>{newRDV.price}$</span>
                </div>

                {/* Submit */}
                <button
                  onClick={submitNewRDV}
                  disabled={submitting || !newRDV.client_name.trim()}
                  style={{
                    background: submitting || !newRDV.client_name.trim()
                      ? "#333"
                      : "linear-gradient(135deg, #D4AF37, #B8860B)",
                    border: "none",
                    color: submitting || !newRDV.client_name.trim() ? "#666" : "#080808",
                    padding: "14px 24px",
                    fontSize: "13px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    cursor: submitting || !newRDV.client_name.trim() ? "not-allowed" : "pointer",
                    borderRadius: "8px",
                    fontWeight: 700,
                    transition: "all 0.2s ease",
                    width: "100%",
                    marginTop: "8px",
                  }}
                >
                  {submitting ? "Enregistrement..." : "Creer le rendez-vous"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );

  // Extracted detail panel content (used in both desktop sidebar and mobile bottom sheet)
  function renderDetailContent() {
    if (!selected) return null;
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ color: "#F0F0F0", fontSize: "16px", fontWeight: 400, letterSpacing: "1px" }}>
            Details du RDV
          </h3>
          <button
            onClick={() => setSelected(null)}
            style={{
              background: "none", border: "none", color: "#555", fontSize: "18px",
              cursor: "pointer", padding: "4px 8px",
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Client</p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <p style={{ color: "#F0F0F0", fontSize: "15px" }}>{selected.client_name}</p>
              {selected.client_email && visitCounts[selected.client_email] ? (
                <span style={{
                  background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                  color: "#080808",
                  fontSize: "10px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "10px",
                  letterSpacing: "0.5px",
                  whiteSpace: "nowrap",
                }}>
                  {visitCounts[selected.client_email]}e visite
                </span>
              ) : null}
            </div>
          </div>
          <div>
            <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Telephone</p>
            <p style={{ color: "#F0F0F0", fontSize: "15px" }}>{selected.client_phone}</p>
          </div>
          {selected.client_email && (
            <div>
              <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Email</p>
              <p style={{ color: "#F0F0F0", fontSize: "14px" }}>{selected.client_email}</p>
            </div>
          )}
          <div style={{ display: "flex", gap: "20px" }}>
            <div>
              <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Service</p>
              <p style={{ color: "#F0F0F0", fontSize: "15px" }}>{selected.service}</p>
            </div>
            <div>
              <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Prix</p>
              <p style={{ color: "#D4AF37", fontSize: "15px", fontWeight: 500 }}>{selected.price}$</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            <div>
              <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Barbiere</p>
              <p style={{ color: BARBER_COLORS[selected.barber] || "#F0F0F0", fontSize: "15px" }}>{selected.barber}</p>
            </div>
            <div>
              <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Date & heure</p>
              <p style={{ color: "#F0F0F0", fontSize: "15px" }}>
                {new Date(selected.date + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} a {selected.time}
              </p>
            </div>
          </div>
          {selected.note && (
            <div>
              <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Note</p>
              <p style={{ color: "#999", fontSize: "13px", fontStyle: "italic" }}>{selected.note}</p>
            </div>
          )}

          {/* Status */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            borderRadius: "8px",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ color: "#555", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>Statut</span>
            <span style={{
              color: STATUS_COLORS[selected.status] || "#999",
              fontSize: "11px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontWeight: 500,
            }}>
              {STATUS_LABELS[selected.status] || selected.status}
            </span>
          </div>

          {/* Actions */}
          {selected.status === "confirmed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
              <button
                onClick={async () => {
                  await fetch("/api/bookings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: selected.id, status: "completed", loyalty_counted: true }),
                  });
                  setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, status: "completed" } : b));
                  setSelected(prev => prev ? { ...prev, status: "completed" } : null);
                  const booking = bookings.find(b => b.id === selected.id);
                  if (booking?.client_email) {
                    fetch("/api/review-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: booking.client_name, client_email: booking.client_email, barber: booking.barber, service: booking.service }) });
                  }
                }}
                style={{
                  background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,134,11,0.1))",
                  border: "1px solid rgba(212,175,55,0.4)",
                  color: "#D4AF37",
                  padding: "10px 16px",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.5px",
                  fontWeight: 600,
                }}
              >
                Client satisfait (+1 fidelite)
              </button>
              <button
                onClick={() => updateStatus(selected.id, "completed")}
                style={{
                  background: "rgba(85,170,85,0.08)",
                  border: "1px solid rgba(85,170,85,0.2)",
                  color: "#5a5",
                  padding: "10px 16px",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.5px",
                }}
              >
                &#10003; Complete (sans fidelite)
              </button>
              <button
                onClick={() => updateStatus(selected.id, "cancelled")}
                style={{
                  background: "rgba(238,85,85,0.08)",
                  border: "1px solid rgba(238,85,85,0.2)",
                  color: "#e55",
                  padding: "10px 16px",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.5px",
                }}
              >
                &#10005; Annuler
              </button>
              {isPastBooking(selected) && (
                <button
                  onClick={() => markNoShow(selected.id)}
                  style={{
                    background: "rgba(255,153,0,0.08)",
                    border: "1px solid rgba(255,153,0,0.2)",
                    color: "#f90",
                    padding: "10px 16px",
                    fontSize: "12px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                    letterSpacing: "0.5px",
                  }}
                >
                  &#8709; No-show
                </button>
              )}
            </div>
          )}
        </div>
      </>
    );
  }
}
