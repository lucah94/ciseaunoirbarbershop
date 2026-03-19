"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string; client_name: string; client_phone: string; client_email: string;
  barber: string; service: string; price: number; date: string; time: string;
  status: string; note: string;
};

const NAV = [
  { label: "Vue d'ensemble", href: "/admin" },
  { label: "Agenda", href: "/admin/agenda" },
  { label: "Paye", href: "/admin/paye" },
  { label: "Comptabilité", href: "/admin/comptabilite" },
];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#C9A84C",
  completed: "#5a5",
  cancelled: "#e55",
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmé",
  completed: "Complété",
  cancelled: "Annulé",
};

export default function AgendaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [filter, setFilter] = useState<"all" | "confirmed" | "completed" | "cancelled">("all");

  useEffect(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(data => { setBookings(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  // Group by date
  const dates = [...new Set(bookings.map(b => b.date))].sort();
  const filtered = bookings.filter(b => {
    if (filter !== "all" && b.status !== filter) return false;
    return true;
  });
  const byDate = dates.map(date => ({
    date,
    bookings: filtered.filter(b => b.date === date).sort((a, b) => a.time.localeCompare(b.time)),
  })).filter(d => d.bookings.length > 0);

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <aside style={{ width: "220px", background: "#080808", borderRight: "1px solid #1A1A1A", padding: "32px 0", position: "fixed", top: 0, bottom: 0, left: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 24px 32px", borderBottom: "1px solid #1A1A1A" }}>
          <p style={{ fontSize: "16px", letterSpacing: "4px", color: "#F5F5F5", fontWeight: 300 }}>CISEAU <span style={{ color: "#C9A84C" }}>NOIR</span></p>
          <p style={{ color: "#444", fontSize: "11px", marginTop: "4px" }}>Admin</p>
        </div>
        <nav style={{ padding: "24px 0", flex: 1 }}>
          {NAV.map(item => (
            <Link key={item.href} href={item.href} style={{
              display: "block", padding: "12px 24px", color: item.href === "/admin/agenda" ? "#C9A84C" : "#666",
              textDecoration: "none", fontSize: "13px", letterSpacing: "1px",
              background: item.href === "/admin/agenda" ? "#111" : "transparent",
              borderLeft: item.href === "/admin/agenda" ? "2px solid #C9A84C" : "2px solid transparent",
            }}>{item.label}</Link>
          ))}
        </nav>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1A1A1A" }}>
          <Link href="/" style={{ color: "#444", fontSize: "12px", textDecoration: "none" }}>← Voir le site</Link>
        </div>
      </aside>

      <main style={{ marginLeft: "220px", flex: 1, padding: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>Agenda</h1>
            <p style={{ color: "#444", fontSize: "13px" }}>{bookings.length} réservation{bookings.length > 1 ? "s" : ""} au total</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["all", "confirmed", "completed", "cancelled"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? "#C9A84C" : "#111",
                border: "1px solid #222", color: filter === f ? "#0A0A0A" : "#666",
                padding: "8px 16px", fontSize: "11px", letterSpacing: "1px",
                textTransform: "uppercase", cursor: "pointer"
              }}>
                {f === "all" ? "Tous" : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#444" }}>Chargement...</p>
        ) : byDate.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <p style={{ color: "#333", fontSize: "16px" }}>Aucune réservation</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            {byDate.map(({ date, bookings: dayBookings }) => (
              <div key={date}>
                <p style={{ color: "#C9A84C", fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>
                  {new Date(date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {dayBookings.map(b => (
                    <div key={b.id} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: "#888", fontSize: "15px", fontWeight: 300, minWidth: "50px" }}>{b.time}</span>
                        <div>
                          <p style={{ color: "#F5F5F5", fontSize: "15px" }}>{b.client_name}</p>
                          <p style={{ color: "#555", fontSize: "12px" }}>{b.service} · {b.barber} · {b.client_phone}</p>
                          {b.note && <p style={{ color: "#444", fontSize: "12px", marginTop: "2px" }}>Note : {b.note}</p>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <span style={{ color: "#C9A84C", fontSize: "16px" }}>{b.price}$</span>
                        <span style={{ color: STATUS_COLORS[b.status], fontSize: "11px", letterSpacing: "1px", border: `1px solid ${STATUS_COLORS[b.status]}`, padding: "4px 10px" }}>
                          {STATUS_LABELS[b.status]}
                        </span>
                        {b.status === "confirmed" && (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => updateStatus(b.id, "completed")} style={{ background: "#0a1a0a", border: "1px solid #2a3a2a", color: "#5a5", padding: "4px 10px", fontSize: "11px", cursor: "pointer" }}>✓ Complété</button>
                            <button onClick={() => updateStatus(b.id, "cancelled")} style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", color: "#e55", padding: "4px 10px", fontSize: "11px", cursor: "pointer" }}>✕ Annuler</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
