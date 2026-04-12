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
type Stats = {
  thisWeek: { bookings: number; revenue: number; bookingGrowth: number; revenueGrowth: number };
  month: { bookings: number; uniqueClients: number; returningClients: number; retentionRate: number; avgPerClient: number; sources: Record<string, number> };
  totals: { clients: number; waitlist: number };
  barberSplit: Record<string, number>;
  twilioBalance: { balance: string; currency: string } | null;
  recentCampaigns: { id: string; subject: string; sent_to_count: number; created_at: string }[];
};
type ReviewData = { rating: number; total: number } | null;

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

function StatCard({ label, value, sub, color, icon, index, badge }: {
  label: string; value: number; sub: string; color: string; icon: React.ReactNode; index: number; badge?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isNegative = color === "#e55";
  const suffix = label.includes("RDV") || label.includes("Clients") || label.includes("No-show") || label.includes("Réten") ? "" : "$";
  const prefix = isNegative ? "-" : "";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: "linear-gradient(135deg, #161B22, #1C2129)",
        border: "1px solid rgba(212,175,55,0.18)", borderRadius: "12px", padding: "24px",
        boxShadow: hovered ? "0 8px 40px rgba(212,175,55,0.15), inset 0 1px 0 rgba(212,175,55,0.1)" : "0 4px 24px rgba(0,0,0,0.3)",
        transition: "all 0.3s ease", cursor: "default", position: "relative", overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%",
        background: `radial-gradient(circle, ${color === "#e55" ? "rgba(238,85,85,0.06)" : color === "#5a5" ? "rgba(85,170,85,0.06)" : "rgba(212,175,55,0.06)"}, transparent)`,
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <p style={{ color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase" }}>{label}</p>
        <span style={{ color, opacity: 0.5 }}>{icon}</span>
      </div>
      <AnimatedNumber value={Math.abs(value)} prefix={prefix} suffix={suffix} color={color} />
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
        <p style={{ color: "#7D8590", fontSize: "12px" }}>{sub}</p>
        {badge && (
          <span style={{
            fontSize: "10px", padding: "2px 8px", borderRadius: "10px", fontWeight: 600,
            color: badge.startsWith("+") ? "#5a5" : badge.startsWith("-") ? "#e55" : "#888",
            background: badge.startsWith("+") ? "rgba(85,170,85,0.1)" : badge.startsWith("-") ? "rgba(238,85,85,0.1)" : "rgba(136,136,136,0.1)",
          }}>{badge}</span>
        )}
      </div>
    </motion.div>
  );
}

function PremiumCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: "linear-gradient(135deg, #161B22, #1C2129)",
        border: "1px solid rgba(212,175,55,0.18)", borderRadius: "12px", padding: "28px",
        boxShadow: hovered ? "0 8px 40px rgba(212,175,55,0.1), inset 0 1px 0 rgba(212,175,55,0.08)" : "0 4px 24px rgba(0,0,0,0.3)",
        transition: "all 0.3s ease",
      }}
    >{children}</motion.div>
  );
}

function SectionTitle({ icon, title, color = "#D4AF37" }: { icon?: React.ReactNode; title: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
      <div style={{ width: "3px", height: "16px", background: `linear-gradient(180deg, ${color}, ${color}88)`, borderRadius: "2px" }} />
      {icon}
      <p style={{ color, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>{title}</p>
    </div>
  );
}

const SOURCE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  direct: { label: "Direct / Site", color: "#D4AF37", icon: "🌐" },
  google: { label: "Google", color: "#4285F4", icon: "🔍" },
  facebook: { label: "Facebook", color: "#1877F2", icon: "📘" },
  instagram: { label: "Instagram", color: "#E1306C", icon: "📸" },
  referral: { label: "Parrainage", color: "#5a5", icon: "🤝" },
  messenger: { label: "Messenger", color: "#0084FF", icon: "💬" },
};

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reviews, setReviews] = useState<ReviewData>(null);
  const [loading, setLoading] = useState(true);
  const week = getWeekRange();
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  useEffect(() => {
    Promise.all([
      fetch("/api/bookings?start=2026-01-01").then(r => r.json()),
      fetch("/api/cuts").then(r => r.json()),
      fetch("/api/expenses").then(r => r.json()),
      fetch("/api/admin/stats").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/reviews").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([b, c, e, s, rev]) => {
      setBookings(Array.isArray(b) ? b : []);
      setCuts(Array.isArray(c) ? c : []);
      setExpenses(Array.isArray(e) ? e : []);
      setStats(s);
      setReviews(rev);
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
  const weekRevenue = weekCuts.reduce((sum, c) => sum + c.price * (1 - c.discount_percent / 100) + c.tip, 0);
  const weekExpenseTotal = weekExpenses.reduce((sum, e) => sum + e.amount, 0);

  const barbers = ["Melynda", "Diodis"];
  const payeSemaine = barbers.map(name => {
    const barberCuts = weekCuts.filter(c => c.barber === name);
    const total = barberCuts.reduce((sum, c) => sum + c.price * (1 - c.discount_percent / 100) + c.tip, 0);
    return { name, total, cuts: barberCuts.length };
  });

  if (loading) return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
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
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "2px", color: "#F0F0F0", marginBottom: "6px" }}>
            {greeting}, <span style={{ color: "#D4AF37" }}>Melynda</span>
          </h1>
          <p style={{ color: "#7D8590", fontSize: "13px", letterSpacing: "1px" }}>
            Semaine du {week.label} &middot; {now.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </motion.div>

        {/* Stats Grid — Row 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
          <StatCard index={0} label="Revenus semaine" value={weekRevenue}
            sub={`${weekCuts.length} coupe${weekCuts.length > 1 ? "s" : ""}`} color="#D4AF37"
            badge={stats ? `${stats.thisWeek.revenueGrowth >= 0 ? "+" : ""}${stats.thisWeek.revenueGrowth}%` : undefined}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
          <StatCard index={1} label="Dépenses semaine" value={weekExpenseTotal}
            sub={`${weekExpenses.length} entrée${weekExpenses.length > 1 ? "s" : ""}`} color="#e55"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
          <StatCard index={2} label="Net semaine" value={weekRevenue - weekExpenseTotal}
            sub="revenus - dépenses" color="#5a5"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} />
          <StatCard index={3} label="RDV aujourd'hui" value={todayBookings.length}
            sub="confirmés" color="#D4AF37"
            badge={stats ? `${stats.thisWeek.bookingGrowth >= 0 ? "+" : ""}${stats.thisWeek.bookingGrowth}% vs sem. passée` : undefined}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        </div>

        {/* Stats Grid — Row 2 (from API) */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "40px" }}>
            <StatCard index={4} label="Clients ce mois" value={stats.month.uniqueClients}
              sub={`${stats.month.returningClients} récurrent${stats.month.returningClients > 1 ? "s" : ""}`} color="#D4AF37"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} />
            <StatCard index={5} label="Rétention" value={stats.month.retentionRate}
              sub="clients qui reviennent" color={stats.month.retentionRate >= 30 ? "#5a5" : "#f90"}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
            <StatCard index={6} label="Revenu moy./client" value={stats.month.avgPerClient}
              sub="ce mois" color="#D4AF37"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5H10.5a2 2 0 0 0 0 4H13.5a2 2 0 0 1 0 4H9"/></svg>} />
            <StatCard index={7} label="No-shows" value={noShowCount}
              sub="total" color="#f90"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} />
          </div>
        )}

        {/* Row: Sources + Reviews + SMS Balance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "24px" }}>

          {/* Sources des clients */}
          <PremiumCard delay={0.3}>
            <SectionTitle title="Sources clients" />
            {stats?.month?.sources && Object.keys(stats.month.sources).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Object.entries(stats.month.sources)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => {
                    const info = SOURCE_LABELS[src] || { label: src, color: "#888", icon: "?" };
                    const pct = stats.month.bookings > 0 ? Math.round(count / stats.month.bookings * 100) : 0;
                    return (
                      <div key={src} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "18px", width: "28px", textAlign: "center" }}>{info.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ color: "#CCC", fontSize: "13px" }}>{info.label}</span>
                            <span style={{ color: info.color, fontSize: "13px", fontWeight: 600 }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ height: "4px", background: "#1A1A1A", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: info.color, borderRadius: "2px", transition: "width 1s ease" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p style={{ color: "#555", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                Les sources apparaitront quand des RDV seront pris via ?utm_source=google/facebook
              </p>
            )}
          </PremiumCard>

          {/* Google Reviews */}
          <PremiumCard delay={0.35}>
            <SectionTitle title="Google Reviews" />
            {reviews ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <p style={{ fontSize: "48px", fontWeight: 300, color: "#D4AF37", marginBottom: "4px" }}>
                  {typeof reviews.rating === "number" ? reviews.rating.toFixed(1) : "—"}
                </p>
                <div style={{ fontSize: "20px", marginBottom: "8px" }}>
                  {"★".repeat(Math.round(reviews.rating || 0))}{"☆".repeat(5 - Math.round(reviews.rating || 0))}
                </div>
                <p style={{ color: "#7D8590", fontSize: "12px" }}>{reviews.total || 0} avis Google</p>
              </div>
            ) : (
              <p style={{ color: "#555", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                Connecte Google Places pour voir tes avis
              </p>
            )}
          </PremiumCard>

          {/* SMS Balance + Campaigns */}
          <PremiumCard delay={0.4}>
            <SectionTitle title="SMS & Campagnes" />
            {stats?.twilioBalance && (
              <div style={{ background: "#0A0A0A", borderRadius: "8px", padding: "16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "#888", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px" }}>Solde Twilio</p>
                  <p style={{ color: Number(stats.twilioBalance.balance) < 5 ? "#e55" : "#5a5", fontSize: "24px", fontWeight: 300 }}>
                    ${stats.twilioBalance.balance}
                  </p>
                </div>
                <span style={{ fontSize: "28px" }}>📱</span>
              </div>
            )}
            {stats?.recentCampaigns && stats.recentCampaigns.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ color: "#666", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase" }}>Dernières campagnes</p>
                {stats.recentCampaigns.map(c => (
                  <div key={c.id} style={{ padding: "10px 12px", background: "#0A0A0A", borderRadius: "6px", border: "1px solid rgba(212,175,55,0.06)" }}>
                    <p style={{ color: "#CCC", fontSize: "12px", marginBottom: "2px" }}>{c.subject}</p>
                    <p style={{ color: "#666", fontSize: "11px" }}>
                      {c.sent_to_count} envoyés &middot; {new Date(c.created_at).toLocaleDateString("fr-CA")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#555", fontSize: "12px", textAlign: "center" }}>Aucune campagne récente</p>
            )}
          </PremiumCard>
        </div>

        {/* Row: RDV aujourd'hui + Paye */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          <PremiumCard delay={0.45}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <SectionTitle title="RDV Aujourd'hui" />
              <Link href="/admin/agenda" style={{ color: "#7D8590", fontSize: "12px", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#D4AF37"}
                onMouseLeave={e => e.currentTarget.style.color = "#7D8590"}>Voir tout &rarr;</Link>
            </div>
            {todayBookings.length === 0 ? (
              <p style={{ color: "#555", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>Aucun rendez-vous restant aujourd&apos;hui</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {todayBookings.slice(0, 6).map((b, i) => (
                  <motion.div key={b.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.08 }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0A0A0A", border: "1px solid rgba(212,175,55,0.06)", borderRadius: "8px" }}>
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

          <PremiumCard delay={0.5}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <SectionTitle title="Paye Cette Semaine" />
              <Link href="/admin/paye" style={{ color: "#7D8590", fontSize: "12px", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#D4AF37"}
                onMouseLeave={e => e.currentTarget.style.color = "#7D8590"}>Gérer &rarr;</Link>
            </div>
            {payeSemaine.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }}
                style={{ marginBottom: "12px", padding: "18px", background: "#0A0A0A", border: "1px solid rgba(212,175,55,0.06)", borderRadius: "8px" }}>
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
        <PremiumCard delay={0.55}>
          <SectionTitle title="Agents Automatiques" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { title: "Rappels 24h", desc: "SMS + email la veille — cron 10h00 chaque jour", active: true },
              { title: "Confirmation réservation", desc: "Email + SMS instantané à chaque réservation en ligne", active: true },
              { title: "Avis Google auto", desc: "Email demande d'avis quand un RDV est complété — cron 22h00", active: true },
              { title: "Re-booking 3 sem.", desc: "SMS 3/6/9 semaines après dernière visite — cron 10h00", active: true },
              { title: "Réponse emails auto", desc: "Figaro lit Gmail et répond — cron 10h00 chaque jour", active: true },
              { title: "Posts sociaux auto", desc: "Facebook + Google My Business — cron 11h00 mar. au sam.", active: true },
              { title: "Rapport hebdo", desc: "Email récap revenus/RDV — cron 20h00 chaque dimanche", active: true },
              { title: "Health check + restart", desc: "Vérifie Supabase/Twilio — cron 5h00, SMS si panne", active: true },
            ].map((agent, i) => (
              <motion.div key={agent.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.05 }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#0A0A0A", border: "1px solid rgba(85,170,85,0.08)", borderRadius: "8px" }}>
                <div>
                  <p style={{ color: "#F0F0F0", fontSize: "13px", marginBottom: "2px" }}>{agent.title}</p>
                  <p style={{ color: "#7D8590", fontSize: "11px" }}>{agent.desc}</p>
                </div>
                <span style={{ color: "#5a5", fontSize: "9px", letterSpacing: "2px", background: "rgba(85,170,85,0.08)", border: "1px solid rgba(85,170,85,0.2)", padding: "4px 10px", borderRadius: "20px", whiteSpace: "nowrap" }}>ACTIF</span>
              </motion.div>
            ))}
          </div>
        </PremiumCard>

        {/* Dépenses récentes */}
        <div style={{ marginTop: "24px" }}>
          <PremiumCard delay={0.6}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <SectionTitle title="Dépenses Récentes" color="#e55" />
              <Link href="/admin/comptabilite" style={{ color: "#7D8590", fontSize: "12px", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#D4AF37"}
                onMouseLeave={e => e.currentTarget.style.color = "#7D8590"}>Voir tout &rarr;</Link>
            </div>
            {expenses.length === 0 ? (
              <p style={{ color: "#555", fontSize: "14px", padding: "20px 0", textAlign: "center" }}>Aucune dépense enregistrée</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {expenses.slice(0, 5).map((e, i) => (
                  <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.06 }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: "1px solid rgba(212,175,55,0.05)" }}>
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
