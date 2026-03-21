"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";

type Booking = {
  id: string; client_name: string; barber: string; service: string;
  price: number; date: string; time: string; status: string;
};
type Cut = { id: string; barber: string; price: number; tip: number; discount_percent: number; date: string; };
type Expense = { id: string; description: string; amount: number; date: string; };


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
    }).catch(() => setLoading(false));
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
      <AdminSidebar />

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

        {/* Agents IA */}
        <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px", marginBottom: "24px" }}>
          <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Agents Automatiques</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
              <div>
                <p style={{ color: "#F5F5F5", fontSize: "14px", marginBottom: "4px" }}>Rappels 24h</p>
                <p style={{ color: "#555", fontSize: "12px" }}>Email automatique la veille de chaque rendez-vous — 10h00 chaque jour</p>
              </div>
              <span style={{ color: "#5a5", fontSize: "11px", letterSpacing: "2px", background: "#0a1a0a", border: "1px solid #2a3a2a", padding: "4px 10px" }}>ACTIF</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
              <div>
                <p style={{ color: "#F5F5F5", fontSize: "14px", marginBottom: "4px" }}>Demande d&apos;avis Google</p>
                <p style={{ color: "#555", fontSize: "12px" }}>Email automatique quand un RDV est marqué &quot;Complété&quot; dans l&apos;agenda</p>
              </div>
              <span style={{ color: "#5a5", fontSize: "11px", letterSpacing: "2px", background: "#0a1a0a", border: "1px solid #2a3a2a", padding: "4px 10px" }}>ACTIF</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
              <div>
                <p style={{ color: "#F5F5F5", fontSize: "14px", marginBottom: "4px" }}>Confirmation de réservation</p>
                <p style={{ color: "#555", fontSize: "12px" }}>Email automatique à chaque nouvelle réservation en ligne</p>
              </div>
              <span style={{ color: "#5a5", fontSize: "11px", letterSpacing: "2px", background: "#0a1a0a", border: "1px solid #2a3a2a", padding: "4px 10px" }}>ACTIF</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#0A0A0A", border: "1px solid #1A1A1A" }}>
              <div>
                <p style={{ color: "#F5F5F5", fontSize: "14px", marginBottom: "4px" }}>SMS — Confirmation & Rappels</p>
                <p style={{ color: "#555", fontSize: "12px" }}>Texto automatique à la réservation + rappel 24h (Twilio)</p>
              </div>
              <span style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "2px", background: "#1a1a0a", border: "1px solid #3a3a2a", padding: "4px 10px" }}>CONFIG. REQUISE</span>
            </div>
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
