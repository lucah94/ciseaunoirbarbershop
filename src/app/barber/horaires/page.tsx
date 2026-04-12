"use client";
import { useEffect, useState } from "react";
import BarberSidebar from "@/components/BarberSidebar";

const DAYS = [
  { key: "mon", label: "Lundi" }, { key: "tue", label: "Mardi" }, { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" }, { key: "fri", label: "Vendredi" }, { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

type Schedule = Record<string, { open: string; close: string } | null>;

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

export default function BarberHorairesPage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [blocks, setBlocks] = useState<{ id: string; date: string; reason: string | null }[]>([]);
  const [overrides, setOverrides] = useState<{ id: string; date: string; open: string; close: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/barbers").then(r => r.json()),
      fetch("/api/admin/blocks?barber=diodis").then(r => r.json()).catch(() => []),
      fetch("/api/admin/day-overrides?barber=diodis").then(r => r.json()).catch(() => []),
    ]).then(([barbers, bl, ov]) => {
      const diodis = Array.isArray(barbers) ? barbers.find((b: { name: string; schedule: Schedule }) => b.name?.toLowerCase() === "diodis") : null;
      setSchedule(diodis?.schedule ?? {});
      setBlocks(Array.isArray(bl) ? bl.filter((b: { date: string }) => b.date >= todayStr()) : []);
      setOverrides(Array.isArray(ov) ? ov.filter((o: { date: string }) => o.date >= todayStr()) : []);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <BarberSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>

        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "6px" }}>Mes Horaires</h1>
          <p style={{ color: "#555", fontSize: "13px" }}>Tes disponibilités — Diodis</p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "600px" }}>

            {/* Horaires réguliers */}
            <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", padding: "28px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Horaires réguliers</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {DAYS.map(({ key, label }) => {
                  const day = schedule?.[key];
                  return (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1A1A1A" }}>
                      <span style={{ color: day ? "#AAA" : "#444", fontSize: "13px" }}>{label}</span>
                      {day
                        ? <span style={{ color: "#D4AF37", fontSize: "13px", fontWeight: 500 }}>{day.open} – {day.close}</span>
                        : <span style={{ color: "#333", fontSize: "12px" }}>Fermé</span>
                      }
                    </div>
                  );
                })}
              </div>
              <p style={{ color: "#444", fontSize: "11px", marginTop: "16px" }}>Pour modifier tes horaires permanents, contacte Melynda.</p>
            </div>

            {/* Dates bloquées */}
            <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", padding: "28px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>
                Congés à venir ({blocks.length})
              </p>
              {blocks.length === 0 ? (
                <p style={{ color: "#444", fontSize: "13px" }}>Aucun congé planifié</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {blocks.map(b => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(238,85,85,0.04)", border: "1px solid rgba(238,85,85,0.1)", borderRadius: "8px", padding: "10px 16px" }}>
                      <span style={{ color: "#AAA", fontSize: "13px", textTransform: "capitalize" }}>
                        {formatDate(b.date)}{b.reason ? ` · ${b.reason}` : ""}
                      </span>
                      <span style={{ color: "#e55", fontSize: "11px" }}>Fermé</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disponibilités exceptionnelles */}
            <div style={{ background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", padding: "28px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>
                Journées exceptionnelles ({overrides.length})
              </p>
              {overrides.length === 0 ? (
                <p style={{ color: "#444", fontSize: "13px" }}>Aucune disponibilité exceptionnelle</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {overrides.map(o => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: "8px", padding: "10px 16px" }}>
                      <span style={{ color: "#D4AF37", fontSize: "13px", textTransform: "capitalize" }}>
                        {formatDate(o.date)}
                      </span>
                      <span style={{ color: "#777", fontSize: "12px" }}>{o.open.slice(0,5)} – {o.close.slice(0,5)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ color: "#444", fontSize: "11px", marginTop: "16px" }}>Les disponibilités exceptionnelles sont ajoutées par Melynda.</p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
