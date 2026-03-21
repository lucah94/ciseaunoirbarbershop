"use client";
import { useEffect, useState, useRef } from "react";
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

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#D4AF37",
  completed: "#5a5",
  cancelled: "#e55",
  no_show: "#f90",
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmé",
  completed: "Complété",
  cancelled: "Annulé",
  no_show: "No-show",
};

const BARBER_COLORS: Record<string, string> = {
  Melynda: "#D4AF37",
  Diodis: "#7B68EE",
};

export default function AgendaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<"all" | "Melynda" | "Diodis">("all");
  const calendarRef = useRef<FullCalendar>(null);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/bookings")
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

  async function updateStatus(id: string, status: string) {
    if (status === "cancelled" && !confirm("Êtes-vous sûr de vouloir annuler ce rendez-vous ?")) return;
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
    if (!confirm("Marquer ce rendez-vous comme no-show ? Un SMS sera envoyé au client.")) return;
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
    const [h, m] = b.time.split(":").map(Number);
    const start = new Date(`${b.date}T${b.time}:00`);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 45);

    return {
      id: b.id,
      title: `${b.client_name}${visitCounts[b.client_email] ? ` (${visitCounts[b.client_email]}e)` : ""} — ${b.service}`,
      start: start.toISOString(),
      end: end.toISOString(),
      backgroundColor: b.status === "cancelled" ? "#333" : (BARBER_COLORS[b.barber] || "#D4AF37"),
      borderColor: b.status === "cancelled" ? "#555" : (BARBER_COLORS[b.barber] || "#D4AF37"),
      textColor: b.status === "cancelled" ? "#888" : "#080808",
      extendedProps: { booking: b },
      classNames: b.status === "cancelled" ? ["event-cancelled"] : b.status === "no_show" ? ["event-noshow"] : [],
    };
  });

  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />

      <main style={{ marginLeft: "260px", flex: 1, padding: "32px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "2px", color: "#F0F0F0", marginBottom: "6px" }}>
              Agenda
            </h1>
            <p style={{ color: "#555", fontSize: "13px", letterSpacing: "1px" }}>
              {bookings.filter(b => b.status !== "cancelled").length} réservation{bookings.filter(b => b.status !== "cancelled").length > 1 ? "s" : ""} actives
            </p>
          </div>

          {/* Barber filter */}
          <div style={{ display: "flex", gap: "8px" }}>
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
                  padding: "8px 20px",
                  fontSize: "11px",
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
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "24px" }}>
            {/* Calendar */}
            <div style={{ flex: 1 }}>
              <style>{`
                .fc {
                  --fc-border-color: rgba(255,255,255,0.06);
                  --fc-today-bg-color: rgba(212,175,55,0.04);
                  --fc-page-bg-color: #080808;
                  --fc-neutral-bg-color: #0D0D0D;
                  --fc-list-event-hover-bg-color: rgba(212,175,55,0.08);
                  font-family: inherit;
                }
                .fc .fc-toolbar-title {
                  font-size: 18px !important;
                  font-weight: 300 !important;
                  letter-spacing: 2px !important;
                  color: #F0F0F0 !important;
                  text-transform: uppercase !important;
                }
                .fc .fc-button {
                  background: #0D0D0D !important;
                  border: 1px solid rgba(212,175,55,0.15) !important;
                  color: #999 !important;
                  font-size: 11px !important;
                  letter-spacing: 1px !important;
                  text-transform: uppercase !important;
                  padding: 6px 14px !important;
                  border-radius: 6px !important;
                  transition: all 0.2s ease !important;
                }
                .fc .fc-button:hover {
                  background: rgba(212,175,55,0.08) !important;
                  color: #D4AF37 !important;
                  border-color: rgba(212,175,55,0.3) !important;
                }
                .fc .fc-button-active {
                  background: linear-gradient(135deg, #D4AF37, #B8860B) !important;
                  color: #080808 !important;
                  border-color: #D4AF37 !important;
                  font-weight: 600 !important;
                }
                .fc .fc-col-header-cell {
                  background: #0A0A0A !important;
                  padding: 10px 0 !important;
                }
                .fc .fc-col-header-cell-cushion {
                  color: #D4AF37 !important;
                  font-size: 11px !important;
                  letter-spacing: 2px !important;
                  text-transform: uppercase !important;
                  text-decoration: none !important;
                  font-weight: 400 !important;
                }
                .fc .fc-timegrid-slot {
                  height: 48px !important;
                  border-color: rgba(255,255,255,0.03) !important;
                }
                .fc .fc-timegrid-slot-label-cushion {
                  color: #444 !important;
                  font-size: 11px !important;
                  font-variant-numeric: tabular-nums !important;
                }
                .fc .fc-timegrid-event {
                  border-radius: 6px !important;
                  border-width: 0 0 0 3px !important;
                  padding: 4px 8px !important;
                  font-size: 12px !important;
                  cursor: pointer !important;
                }
                .fc .fc-timegrid-event .fc-event-title {
                  font-weight: 500 !important;
                }
                .fc .fc-timegrid-event .fc-event-time {
                  font-size: 10px !important;
                  opacity: 0.8 !important;
                }
                .fc .fc-daygrid-event {
                  border-radius: 4px !important;
                  padding: 2px 6px !important;
                  font-size: 11px !important;
                  cursor: pointer !important;
                }
                .fc .fc-scrollgrid {
                  border-color: rgba(255,255,255,0.06) !important;
                }
                .fc td, .fc th {
                  border-color: rgba(255,255,255,0.04) !important;
                }
                .fc .fc-timegrid-now-indicator-line {
                  border-color: #D4AF37 !important;
                  border-width: 2px !important;
                }
                .fc .fc-timegrid-now-indicator-arrow {
                  border-color: #D4AF37 !important;
                  border-top-color: transparent !important;
                  border-bottom-color: transparent !important;
                }
                .event-cancelled .fc-event-title { text-decoration: line-through !important; }
                .event-noshow { opacity: 0.6 !important; border-left-color: #f90 !important; }
                .fc .fc-day-today .fc-col-header-cell-cushion { color: #F0F0F0 !important; font-weight: 600 !important; }
              `}</style>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
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

            {/* Detail panel */}
            {selected && (
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 style={{ color: "#F0F0F0", fontSize: "16px", fontWeight: 400, letterSpacing: "1px" }}>
                    Détails du RDV
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
                    <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Téléphone</p>
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
                      <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Barbière</p>
                      <p style={{ color: BARBER_COLORS[selected.barber] || "#F0F0F0", fontSize: "15px" }}>{selected.barber}</p>
                    </div>
                    <div>
                      <p style={{ color: "#555", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Date & heure</p>
                      <p style={{ color: "#F0F0F0", fontSize: "15px" }}>
                        {new Date(selected.date + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} à {selected.time}
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
                        &#10003; Marquer complété
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
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
