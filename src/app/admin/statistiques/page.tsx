"use client";
import { useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";

type MonthData = { month: string; bookings: number; revenue: number };

export default function StatistiquesPage() {
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [topClients, setTopClients] = useState<{ name: string; count: number; revenue: number }[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<{ service: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/bookings?start=2025-01-01").then(r => r.json()),
      fetch("/api/cuts").then(r => r.json()),
    ]).then(([bookings, cuts]) => {
      if (!Array.isArray(bookings)) bookings = [];
      if (!Array.isArray(cuts)) cuts = [];

      // Monthly data (last 6 months)
      const months: Record<string, { bookings: number; revenue: number }> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        months[key] = { bookings: 0, revenue: 0 };
      }
      for (const b of bookings) {
        if (b.status === "cancelled") continue;
        const m = b.date?.slice(0, 7);
        if (months[m]) months[m].bookings++;
      }
      for (const c of cuts) {
        const m = c.date?.slice(0, 7);
        if (months[m]) months[m].revenue += c.price * (1 - (c.discount_percent || 0) / 100) + (c.tip || 0);
      }
      setMonthlyData(Object.entries(months).map(([month, d]) => ({ month, ...d })));

      // Top clients
      const clientMap: Record<string, { count: number; revenue: number }> = {};
      for (const b of bookings) {
        if (b.status === "cancelled" || !b.client_name) continue;
        if (!clientMap[b.client_name]) clientMap[b.client_name] = { count: 0, revenue: 0 };
        clientMap[b.client_name].count++;
        clientMap[b.client_name].revenue += b.price || 0;
      }
      setTopClients(
        Object.entries(clientMap)
          .map(([name, d]) => ({ name, ...d }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );

      // Service breakdown
      const svcMap: Record<string, number> = {};
      for (const b of bookings) {
        if (b.status === "cancelled" || !b.service) continue;
        svcMap[b.service] = (svcMap[b.service] || 0) + 1;
      }
      setServiceBreakdown(
        Object.entries(svcMap)
          .map(([service, count]) => ({ service, count }))
          .sort((a, b) => b.count - a.count)
      );

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);
  const maxBookings = Math.max(...monthlyData.map(m => m.bookings), 1);
  const totalBookings = monthlyData.reduce((s, m) => s + m.bookings, 0);
  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);

  const cardStyle = {
    background: "linear-gradient(135deg, #161B22, #1C2129)",
    border: "1px solid rgba(212,175,55,0.18)",
    borderRadius: "12px",
    padding: "28px",
  };

  if (loading) return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#D4AF37", letterSpacing: "6px", fontSize: "14px" }}>CHARGEMENT</p>
    </div>
  );

  return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "8px" }}>Statistiques</h1>
        <p style={{ color: "#666", fontSize: "13px", marginBottom: "32px" }}>
          {totalBookings} RDV &middot; {totalRevenue.toFixed(0)}$ revenus &middot; 6 derniers mois
        </p>

        {/* Revenue Chart */}
        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "24px" }}>Revenus mensuels</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "200px" }}>
            {monthlyData.map(m => {
              const h = (m.revenue / maxRevenue) * 180;
              const monthLabel = new Date(m.month + "-15").toLocaleDateString("fr-CA", { month: "short" });
              return (
                <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#D4AF37", fontSize: "11px", fontWeight: 600 }}>{m.revenue > 0 ? `${m.revenue.toFixed(0)}$` : ""}</span>
                  <div style={{
                    width: "100%", maxWidth: "60px", height: `${Math.max(h, 4)}px`,
                    background: "linear-gradient(180deg, #D4AF37, #B8860B)", borderRadius: "4px 4px 0 0",
                    transition: "height 0.8s ease",
                  }} />
                  <span style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>{monthLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bookings Chart */}
        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "24px" }}>RDV par mois</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "160px" }}>
            {monthlyData.map(m => {
              const h = (m.bookings / maxBookings) * 140;
              const monthLabel = new Date(m.month + "-15").toLocaleDateString("fr-CA", { month: "short" });
              return (
                <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#5a5", fontSize: "12px", fontWeight: 600 }}>{m.bookings || ""}</span>
                  <div style={{
                    width: "100%", maxWidth: "60px", height: `${Math.max(h, 4)}px`,
                    background: "linear-gradient(180deg, #5a5, #3a7a3a)", borderRadius: "4px 4px 0 0",
                    transition: "height 0.8s ease",
                  }} />
                  <span style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>{monthLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Top Clients */}
          <div style={cardStyle}>
            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Top 10 clients</p>
            {topClients.length === 0 ? (
              <p style={{ color: "#555", textAlign: "center", padding: "20px 0" }}>Aucune donnée</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {topClients.map((c, i) => (
                  <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#0A0A0A", borderRadius: "6px", border: "1px solid rgba(212,175,55,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ color: "#D4AF37", fontSize: "14px", fontWeight: 600, width: "24px" }}>#{i + 1}</span>
                      <span style={{ color: "#F0F0F0", fontSize: "13px" }}>{c.name}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: "#D4AF37", fontSize: "13px", fontWeight: 600 }}>{c.count} RDV</span>
                      <span style={{ color: "#666", fontSize: "11px", marginLeft: "8px" }}>{c.revenue}$</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service Breakdown */}
          <div style={cardStyle}>
            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Services populaires</p>
            {serviceBreakdown.length === 0 ? (
              <p style={{ color: "#555", textAlign: "center", padding: "20px 0" }}>Aucune donnée</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {serviceBreakdown.map(s => {
                  const pct = totalBookings > 0 ? Math.round(s.count / totalBookings * 100) : 0;
                  return (
                    <div key={s.service}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ color: "#CCC", fontSize: "13px" }}>{s.service}</span>
                        <span style={{ color: "#D4AF37", fontSize: "13px" }}>{s.count} ({pct}%)</span>
                      </div>
                      <div style={{ height: "6px", background: "#1A1A1A", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #D4AF37, #B8860B)", borderRadius: "3px", transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
