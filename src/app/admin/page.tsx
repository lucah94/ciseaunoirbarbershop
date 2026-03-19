"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string; client_name: string; barber: string; service: string;
  price: number; date: string; time: string; status: string;
};
type Cut = { id: string; barber: string; price: number; tip: number; discount_percent: number; date: string; };
type Expense = { id: string; description: string; amount: number; date: string; };

const NAV = [
  { label: "Vue d'ensemble", href: "/admin" },
  { label: "Agenda", href: "/admin/agenda" },
  { label: "Paye", href: "/admin/paye" },
  { label: "Comptabilité", href: "/admin/comptabilite" },
];

function getWeekRange() {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
    label: `${monday.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}`,
  };
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const week = getWeekRange();
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    Promise.all([
      fetch("/api/bookings").then(r => r.json()),
      fetch("/api/cuts").then(r => r.json()),
      fetch("/api/expenses").then(r => r.json()),
    ]).then(([b, c, e]) => {
      setBookings(Array.isArray(b) ? b : []);
      setCuts(Array.isArray(c) ? c : []);
      setExpenses(Array.isArray(e) ? e : []);
      setLoading(false);
    });
  }, []);

  const todayBookings = bookings.filter(b => b.date === today && b.status !== "cancelled");
  const weekCuts = cuts.filter(c => c.date >= week.start && c.date <= week.end);
  const weekExpenses = expenses.filter(e => e.date >= week.start && e.date <= week.end);

  const weekRevenue = weekCuts.reduce((sum, c) => {
    const net = c.price * (1 - c.discount_percent / 100) + c.tip;
    return sum + net;
  }, 0);
  const weekExpenseTotal = weekExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Paye par barbière cette semaine
  const barbers = ["Melynda", "Diodis"];
  const payeSemaine = barbers.map(name => {
    const barberCuts = weekCuts.filter(c => c.barber === name);
    const total = barberCuts.reduce((sum, c) => {
      return sum + c.price * (1 - c.discount_percent / 100) + c.tip;
    }, 0);
    return { name, total, cuts: barberCuts.length };
  });

  if (loading) return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#C9A84C", letterSpacing: "4px" }}>Chargement...</p>
    </div>
  );

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      {/* Sidebar */}
      <aside style={{ width: "220px", background: "#080808", borderRight: "1px solid #1A1A1A", padding: "32px 0", position: "fixed", top: 0, bottom: 0, left: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 24px 32px", borderBottom: "1px solid #1A1A1A" }}>
          <p style={{ fontSize: "16px", letterSpacing: "4px", color: "#F5F5F5", fontWeight: 300 }}>
            CISEAU <span style={{ color: "#C9A84C" }}>NOIR</span>
          </p>
          <p style={{ color: "#444", fontSize: "11px", marginTop: "4px" }}>Admin</p>
        </div>
        <nav style={{ padding: "24px 0", flex: 1 }}>
          {NAV.map(item => (
            <Link key={item.href} href={item.href} style={{
              display: "block", padding: "12px 24px",
              color: item.href === "/admin" ? "#C9A84C" : "#666",
              textDecoration: "none", fontSize: "13px", letterSpacing: "1px",
              background: item.href === "/admin" ? "#111" : "transparent",
              borderLeft: item.href === "/admin" ? "2px solid #C9A84C" : "2px solid transparent",
            }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1A1A1A" }}>
          <Link href="/" style={{ color: "#444", fontSize: "12px", textDecoration: "none" }}>← Voir le site</Link>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: "220px", flex: 1, padding: "40px" }}>
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>Vue d'ensemble</h1>
          <p style={{ color: "#444", fontSize: "13px" }}>Semaine du {week.label}</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "40px" }}>
          {[
            { label: "Revenus semaine", value: `${weekRevenue.toFixed(2)}$`, sub: `${weekCuts.length} coupes`, color: "#C9A84C" },
            { label: "Dépenses semaine", value: `${weekExpenseTotal.toFixed(2)}$`, sub: `${weekExpenses.length} entrées`, color: "#e55" },
            { label: "Net semaine", value: `${(weekRevenue - weekExpenseTotal).toFixed(2)}$`, sub: "revenus - dépenses", color: "#5a5" },
            { label: "RDV aujourd'hui", value: String(todayBookings.length), sub: "confirmés", color: "#C9A84C" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{stat.label}</p>
              <p style={{ fontSize: "28px", color: stat.color, fontWeight: 300 }}>{stat.value}</p>
              <p style={{ color: "#444", fontSize: "12px", marginTop: "4px" }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          {/* RDV aujourd'hui */}
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>RDV Aujourd'hui</p>
              <Link href="/admin/agenda" style={{ color: "#444", fontSize: "12px", textDecoration: "none" }}>Voir tout →</Link>
            </div>
            {todayBookings.length === 0 ? (
              <p style={{ color: "#333", fontSize: "14px" }}>Aucun rendez-vous aujourd'hui</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {todayBookings.slice(0, 5).map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#0F0F0F", border: "1px solid #1A1A1A" }}>
                    <div>
                      <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{b.client_name}</p>
                      <p style={{ color: "#555", fontSize: "12px" }}>{b.time} · {b.service} · {b.barber}</p>
                    </div>
                    <span style={{ color: "#C9A84C", fontSize: "14px" }}>{b.price}$</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Paye semaine */}
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Paye Cette Semaine</p>
              <Link href="/admin/paye" style={{ color: "#444", fontSize: "12px", textDecoration: "none" }}>Gérer →</Link>
            </div>
            {payeSemaine.map(p => (
              <div key={p.name} style={{ marginBottom: "16px", padding: "16px", background: "#0F0F0F", border: "1px solid #1A1A1A" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <p style={{ color: "#F5F5F5", fontSize: "15px" }}>{p.name}</p>
                  <p style={{ color: "#C9A84C", fontSize: "18px", fontWeight: 300 }}>{p.total.toFixed(2)}$</p>
                </div>
                <p style={{ color: "#555", fontSize: "12px" }}>{p.cuts} coupe{p.cuts > 1 ? "s" : ""} cette semaine</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dépenses récentes */}
        <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Dépenses Récentes</p>
            <Link href="/admin/comptabilite" style={{ color: "#444", fontSize: "12px", textDecoration: "none" }}>Voir tout →</Link>
          </div>
          {expenses.length === 0 ? (
            <p style={{ color: "#333", fontSize: "14px" }}>Aucune dépense enregistrée</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {expenses.slice(0, 5).map(e => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                  <p style={{ color: "#888", fontSize: "14px" }}>{e.description}</p>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#e55", fontSize: "14px" }}>-{e.amount.toFixed(2)}$</p>
                    <p style={{ color: "#444", fontSize: "11px" }}>{e.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
