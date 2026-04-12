"use client";
import { useEffect, useState, useCallback } from "react";
import AdminSidebar from "@/components/AdminSidebar";

type ServiceStatus = "ok" | "error" | "slow" | "degraded" | "loading";
type Check = { status: ServiceStatus; latency: number; message?: string };
type HealthData = {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks: { supabase: Check; resend: Check; twilio: Check; claude: Check };
};

const STATUS_CONFIG = {
  ok:       { color: "#5a5",    bg: "rgba(85,170,85,0.08)",    border: "rgba(85,170,85,0.2)",    icon: "●", label: "Opérationnel" },
  slow:     { color: "#C9A84C", bg: "rgba(201,168,76,0.08)",   border: "rgba(201,168,76,0.2)",   icon: "◐", label: "Lent" },
  degraded: { color: "#C9A84C", bg: "rgba(201,168,76,0.08)",   border: "rgba(201,168,76,0.2)",   icon: "◐", label: "Dégradé" },
  error:    { color: "#e55",    bg: "rgba(238,85,85,0.08)",    border: "rgba(238,85,85,0.2)",    icon: "●", label: "En panne" },
  loading:  { color: "#444",    bg: "rgba(68,68,68,0.08)",     border: "rgba(68,68,68,0.2)",     icon: "○", label: "Vérification..." },
};

const SERVICE_LABELS: Record<string, { name: string; desc: string; icon: string }> = {
  supabase: { name: "Base de données",  desc: "Supabase — réservations, clients, dépenses", icon: "🗄️" },
  resend:   { name: "Emails",           desc: "Resend — confirmations & campagnes email",    icon: "✉️" },
  twilio:   { name: "SMS",              desc: "Twilio — confirmations & campagnes SMS",      icon: "📱" },
  claude:   { name: "Intelligence IA",  desc: "Anthropic Claude — Figaro & analyses",       icon: "✂️" },
  security: { name: "Sécurité RLS",     desc: "Supabase — protection des tables (RLS)",     icon: "🔒" },
};

export default function SantePage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const check = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
      setLastRefresh(new Date());
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 60_000); // auto-refresh chaque minute
    return () => clearInterval(interval);
  }, [check]);

  const overall = health?.status ?? "loading";
  const overallCfg = STATUS_CONFIG[overall as ServiceStatus] ?? STATUS_CONFIG.loading;

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "6px" }}>Santé du Système</h1>
            <p style={{ color: "#555", fontSize: "13px" }}>
              {lastRefresh ? `Dernière vérification : ${lastRefresh.toLocaleTimeString("fr-CA")} — rafraîchit automatiquement chaque minute` : "Vérification en cours..."}
            </p>
          </div>
          <button onClick={check} disabled={refreshing}
            style={{ background: refreshing ? "#111" : "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#C9A84C", padding: "10px 20px", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", borderRadius: "8px", fontWeight: 600 }}>
            {refreshing ? "..." : "↺ Rafraîchir"}
          </button>
        </div>

        {/* Statut global */}
        <div style={{ background: overallCfg.bg, border: `1px solid ${overallCfg.border}`, borderRadius: "12px", padding: "28px 32px", marginBottom: "32px", display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: overallCfg.color }} />
            {overall === "ok" && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: overallCfg.color, animation: "ping 2s ease-in-out infinite", opacity: 0.3 }} />}
          </div>
          <div>
            <p style={{ color: overallCfg.color, fontSize: "18px", fontWeight: 500, letterSpacing: "1px" }}>
              {overall === "ok" ? "Tous les systèmes opérationnels" :
               overall === "degraded" ? "Performances dégradées" :
               overall === "error" ? "Panne détectée — alerte envoyée à Melynda" :
               "Vérification en cours..."}
            </p>
            {health?.timestamp && (
              <p style={{ color: "#555", fontSize: "12px", marginTop: "4px" }}>
                {new Date(health.timestamp).toLocaleString("fr-CA")}
              </p>
            )}
          </div>
        </div>

        {/* Services */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "40px" }}>
          {loading ? (
            ["supabase", "resend", "twilio", "claude"].map(k => (
              <div key={k} style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "10px", padding: "24px", display: "flex", gap: "16px", alignItems: "center" }}>
                <span style={{ fontSize: "28px" }}>{SERVICE_LABELS[k].icon}</span>
                <div>
                  <p style={{ color: "#F5F5F5", fontSize: "15px", marginBottom: "4px" }}>{SERVICE_LABELS[k].name}</p>
                  <p style={{ color: "#444", fontSize: "12px" }}>Vérification...</p>
                </div>
              </div>
            ))
          ) : (
            health && Object.entries(health.checks).map(([key, check]) => {
              const cfg = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.error;
              const svc = SERVICE_LABELS[key];
              return (
                <div key={key} style={{ background: "#111", border: `1px solid ${cfg.border}`, borderRadius: "10px", padding: "24px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "28px", flexShrink: 0 }}>{svc.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <p style={{ color: "#F5F5F5", fontSize: "15px" }}>{svc.name}</p>
                      <span style={{ color: cfg.color, fontSize: "10px", letterSpacing: "2px", background: cfg.bg, border: `1px solid ${cfg.border}`, padding: "3px 10px", borderRadius: "20px" }}>
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ color: "#555", fontSize: "12px", marginBottom: "8px" }}>{svc.desc}</p>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <span style={{ color: "#444", fontSize: "11px" }}>⚡ {check.latency}ms</span>
                      {check.message && <span style={{ color: check.status === "ok" ? "#5a5" : "#e55", fontSize: "11px" }}>{check.message}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Protections actives */}
        <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "10px", padding: "28px" }}>
          <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Protections Actives</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {[
              { icon: "🛡️", name: "Headers Sécurité", desc: "HSTS, CSP, X-Frame, XSS protection" },
              { icon: "🚦", name: "Rate Limiting", desc: "Max 60 req/min par IP, 10 sur routes sensibles" },
              { icon: "🤖", name: "Anti-Bots", desc: "Blocage sqlmap, nikto, nmap et scanners connus" },
              { icon: "💉", name: "Anti-Injection", desc: "Blocage SQL injection, XSS, path traversal" },
              { icon: "🔒", name: "Admin Protégé", desc: "Pages admin non-indexées par Google" },
              { icon: "🔔", name: "Alertes Auto", desc: "SMS à Melynda si panne détectée (cron horaire)" },
            ].map(p => (
              <div key={p.name} style={{ display: "flex", gap: "12px", padding: "14px", background: "rgba(85,170,85,0.04)", border: "1px solid rgba(85,170,85,0.1)", borderRadius: "8px" }}>
                <span style={{ fontSize: "20px", flexShrink: 0 }}>{p.icon}</span>
                <div>
                  <p style={{ color: "#5a5", fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>✓ {p.name}</p>
                  <p style={{ color: "#444", fontSize: "11px" }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes ping { 0%{transform:scale(1);opacity:0.3} 100%{transform:scale(2.5);opacity:0} }`}</style>
      </main>
    </div>
  );
}
