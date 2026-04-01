"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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

function AnimatedNumber({ value, prefix = "", suffix = "", color = "#D4AF37" }: { value: number; prefix?: string; suffix?: string; color?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const duration = 1200;
    const start = ref.current;
    const diff = value - start;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  const isDecimal = suffix === "$";
  return (
    <span style={{ color, fontSize: "32px", fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
      {prefix}{isDecimal ? display.toFixed(2) : Math.round(display)}{suffix}
    </span>
  );
}

function StatCard({ label, value, sub, color, icon, index }: { label: string; value: number; sub: string; color: string; icon: React.ReactNode; index: number; }) {
  const [hovered, setHovered] = useState(false);
  const isNegative = color === "#e55";
  const suffix = label.includes("RDV") ? "" : "$";
  const prefix = isNegative ? "-" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "linear-gradient(135deg, #161B22, #1C2129)",
        border: "1px solid rgba(212,175,55,0.18)",
        borderRadius: "12px",
        padding: "28px",
        boxShadow: hovered
          ? "0 8px 40px rgba(212,175,55,0.15), inset 0 1px 0 rgba(212,175,55,0.1)"
          : "0 4px 24px rgba(0,0,0,0.3)",
        transition: "all 0.3s ease",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle glow circle in background */}
      <div
        style={{
          position: "absolute",
          top: "-20px",
          right: "-20px",
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color === "#e55" ? "rgba(238,85,85,0.06)" : color === "#5a5" ? "rgba(85,170,85,0.06)" : "rgba(212,175,55,0.06)"}, transparent)`,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <p style={{ color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase" }}>
          {label}
        </p>
        <span style={{ color: color, opacity: 0.5 }}>{icon}</span>
      </div>
      <AnimatedNumber value={Math.abs(value)} prefix={prefix} suffix={suffix} color={color} />
      <p style={{ color: "#7D8590", fontSize: "12px", marginTop: "8px" }}>{sub}</p>
    </motion.div>
  );
}

function PremiumCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "linear-gradient(135deg, #161B22, #1C2129)",
        border: "1px solid rgba(212,175,55,0.18)",
        borderRadius: "12px",
        padding: "28px",
        boxShadow: hovered
          ? "0 8px 40px rgba(212,175,55,0.1), inset 0 1px 0 rgba(212,175,55,0.08)"
          : "0 4px 24px rgba(0,0,0,0.3)",
        transition: "all 0.3s ease",
      }}
    >
      {children}
    </motion.div>
  );
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const week = getWeekRange();
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  useEffect(() => {
    Promise.all([
      fetch("/api/bookings?start=2026-01-01").then(r => r.json()),
      fetch("/api/cuts").then(r => r.json()),
      fetch("/api/expenses").then(r => r.json()),
    ]).then(([b, c, e]) => {
      setBookings(Array.isArray(b) ? b : []);
      setCuts(Array.isArray(c) ? c : []);
      setExpenses(Array.isArray(e) ? e : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayBookings = bookings.filter(b => {
    if (b.date !== today || b.status === "cancelled" || b.status === "no_show") return false;
    const [h, m] = b.time.split(":").map(Number);
    return h * 60 + m >= nowMinutes;
  });
  const noShowCount = bookings.filter(b => b.status === "no_show").length;
  const weekCuts = cuts.filter(c => c.date >= week.start && c.date <= week.end);
  const weekExpenses = expenses.filter(e => e.date >= week.start && e.date <= week.end);

  const weekRevenue = weekCuts.reduce((sum, c) => {
    const net = c.price * (1 - c.discount_percent / 100) + c.tip;
    return sum + net;
  }, 0);
  const weekExpenseTotal = weekExpenses.reduce((sum, e) => sum + e.amount, 0);

  const barbers = ["Melynda", "Diodis"];
  const payeSemaine = barbers.map(name => {
    const barberCuts = weekCuts.filter(c => c.barber === name);
    const total = barberCuts.reduce((sum, c) => {
      return sum + c.price * (1 - c.discount_percent / 100) + c.tip;
    }, 0);
    return { name, total, cuts: barberCuts.length };
  });

  if (loading) return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <p style={{ color: "#D4AF37", letterSpacing: "6px", fontSize: "14px" }}>CHARGEMENT</p>
      </motion.div>
    </div>
  );

  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />

      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: "40px" }}
        >
          <h1 style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "2px", color: "#F0F0F0", marginBottom: "6px" }}>
            {greeting}, <span style={{ color: "#D4AF37" }}>Melynda</span>
          </h1>
          <p style={{ color: "#7D8590", fontSize: "13px", letterSpacing: "1px" }}>
            Semaine du {week.label} &middot; {now.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "40px" }}>
          <StatCard
            index={0}
            label="Revenus semaine"
            value={weekRevenue}
            sub={`${weekCuts.length} coupe${weekCuts.length > 1 ? "s" : ""}`}
            color="#D4AF37"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            }
          />
          <StatCard
            index={1}
            label="Dépenses semaine"
            value={weekExpenseTotal}
            sub={`${weekExpenses.length} entrée${weekExpenses.length > 1 ? "s" : ""}`}
            color="#e55"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            }
          />
          <StatCard
            index={2}
            label="Net semaine"
            value={weekRevenue - weekExpenseTotal}
            sub="revenus - dépenses"
            color="#5a5"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            }
          />
          <StatCard
            index={3}
            label="RDV aujourd'hui"
            value={todayBookings.length}
            sub="confirmés"
            color="#D4AF37"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            }
          />
          <StatCard
            index={4}
            label="No-shows"
            value={noShowCount}
            sub="total"
            color="#f90"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            }
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          {/* RDV aujourd'hui */}
          <PremiumCard delay={0.4}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "3px", height: "16px", background: "linear-gradient(180deg, #D4AF37, #B8860B)", borderRadius: "2px" }} />
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>RDV Aujourd&apos;hui</p>
              </div>
              <Link href="/admin/agenda" style={{ color: "#7D8590", fontSize: "12px", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#D4AF37"}
                onMouseLeave={e => e.currentTarget.style.color = "#7D8590"}
              >Voir tout &rarr;</Link>
            </div>
            {todayBookings.length === 0 ? (
              <p style={{ color: "#555", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>Aucun rendez-vous aujourd&apos;hui</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {todayBookings.slice(0, 5).map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 16px",
                      background: "#0A0A0A",
                      border: "1px solid rgba(212,175,55,0.06)",
                      borderRadius: "8px",
                    }}
                  >
                    <div>
                      <p style={{ color: "#F0F0F0", fontSize: "14px", marginBottom: "3px" }}>{b.client_name}</p>
                      <p style={{ color: "#7D8590", fontSize: "12px" }}>{b.time} &middot; {b.service} &middot; {b.barber}</p>
                    </div>
                    <span style={{ color: "#D4AF37", fontSize: "15px", fontWeight: 500 }}>{b.price}$</span>
                  </motion.div>
                ))}
              </div>
            )}
          </PremiumCard>

          {/* Paye semaine */}
          <PremiumCard delay={0.5}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "3px", height: "16px", background: "linear-gradient(180deg, #D4AF37, #B8860B)", borderRadius: "2px" }} />
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Paye Cette Semaine</p>
              </div>
              <Link href="/admin/paye" style={{ color: "#7D8590", fontSize: "12px", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#D4AF37"}
                onMouseLeave={e => e.currentTarget.style.color = "#7D8590"}
              >Gérer &rarr;</Link>
            </div>
            {payeSemaine.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                style={{
                  marginBottom: "12px",
                  padding: "18px",
                  background: "#0A0A0A",
                  border: "1px solid rgba(212,175,55,0.06)",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <p style={{ color: "#F0F0F0", fontSize: "15px" }}>{p.name}</p>
                  <p style={{ color: "#D4AF37", fontSize: "22px", fontWeight: 300 }}>{p.total.toFixed(2)}$</p>
                </div>
                <p style={{ color: "#7D8590", fontSize: "12px" }}>{p.cuts} coupe{p.cuts > 1 ? "s" : ""} cette semaine</p>
              </motion.div>
            ))}
          </PremiumCard>
        </div>

        {/* Agents IA */}
        <PremiumCard delay={0.6}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ width: "3px", height: "16px", background: "linear-gradient(180deg, #D4AF37, #B8860B)", borderRadius: "2px" }} />
            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Agents Automatiques</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { title: "Rappels 24h", desc: "Email automatique la veille de chaque rendez-vous — 10h00 chaque jour", active: true },
              { title: "Demande d'avis Google", desc: "Email automatique quand un RDV est marqué \"Complété\" dans l'agenda", active: true },
              { title: "Confirmation de réservation", desc: "Email automatique à chaque nouvelle réservation en ligne", active: true },
              { title: "SMS — Confirmation & Rappels", desc: "Texto automatique à la réservation + rappel 24h (Twilio)", active: true },
            ].map((agent, i) => (
              <motion.div
                key={agent.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 18px",
                  background: "#161B22",
                  border: `1px solid ${agent.active ? "rgba(85,170,85,0.1)" : "rgba(212,175,55,0.1)"}`,
                  borderRadius: "8px",
                }}
              >
                <div>
                  <p style={{ color: "#F0F0F0", fontSize: "14px", marginBottom: "4px" }}>{agent.title}</p>
                  <p style={{ color: "#7D8590", fontSize: "12px" }}>{agent.desc}</p>
                </div>
                {agent.active ? (
                  <span style={{
                    color: "#5a5",
                    fontSize: "10px",
                    letterSpacing: "2px",
                    background: "rgba(85,170,85,0.08)",
                    border: "1px solid rgba(85,170,85,0.2)",
                    padding: "5px 12px",
                    borderRadius: "20px",
                  }}>ACTIF</span>
                ) : (
                  <span style={{
                    color: "#D4AF37",
                    fontSize: "10px",
                    letterSpacing: "2px",
                    background: "rgba(212,175,55,0.08)",
                    border: "1px solid rgba(212,175,55,0.2)",
                    padding: "5px 12px",
                    borderRadius: "20px",
                  }}>CONFIG. REQUISE</span>
                )}
              </motion.div>
            ))}
          </div>
        </PremiumCard>

        {/* Dépenses récentes */}
        <div style={{ marginTop: "24px" }}>
          <PremiumCard delay={0.7}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "3px", height: "16px", background: "linear-gradient(180deg, #e55, #c33)", borderRadius: "2px" }} />
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Dépenses Récentes</p>
              </div>
              <Link href="/admin/comptabilite" style={{ color: "#7D8590", fontSize: "12px", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#D4AF37"}
                onMouseLeave={e => e.currentTarget.style.color = "#7D8590"}
              >Voir tout &rarr;</Link>
            </div>
            {expenses.length === 0 ? (
              <p style={{ color: "#555", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>Aucune dépense enregistrée</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {expenses.slice(0, 5).map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 + i * 0.06 }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 4px",
                      borderBottom: "1px solid rgba(212,175,55,0.05)",
                    }}
                  >
                    <p style={{ color: "#888", fontSize: "14px" }}>{e.description}</p>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: "#e55", fontSize: "14px", fontWeight: 500 }}>-{e.amount.toFixed(2)}$</p>
                      <p style={{ color: "#8B949E", fontSize: "11px" }}>{e.date}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </PremiumCard>
        </div>
      </main>
    </div>
  );
}
