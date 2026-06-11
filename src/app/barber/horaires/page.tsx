"use client";
import { useEffect, useState, useCallback } from "react";
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
function getBarberNameFromCookie(): string {
  if (typeof document === "undefined") return "melynda";
  const match = document.cookie.match(/(?:^|;\s*)barber_name=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "melynda";
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function manage(body: Record<string, unknown>) {
  const res = await fetch("/api/barber/manage", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: "Erreur réseau" }));
}

const card = { background: "#111", border: "1px solid #1A1A1A", borderRadius: "12px", padding: "28px" } as const;
const label = { color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" as const, marginBottom: "16px" };
const inputStyle = { background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#F0F0F0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark" as const };
const btnGold = { background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" };

export default function BarberHorairesPage() {
  const [schedule, setSchedule] = useState<Schedule>({});
  const [blocks, setBlocks] = useState<{ id: string; date: string; reason: string | null; start_time?: string | null; end_time?: string | null }[]>([]);
  const [overrides, setOverrides] = useState<{ id: string; date: string; open: string; close: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [barberName, setBarberName] = useState("melynda");
  const [savingSched, setSavingSched] = useState(false);
  const [schedMsg, setSchedMsg] = useState("");
  const [blockForm, setBlockForm] = useState({ date: "", reason: "", partial: false, start: "13:00", end: "15:00" });
  const [isMobile, setIsMobile] = useState(false);
  const [ovForm, setOvForm] = useState({ date: "", open: "09:00", close: "17:00" });

  const refresh = useCallback(() => {
    const name = getBarberNameFromCookie();
    setBarberName(name);
    Promise.all([
      fetch(`/api/barbers?_=${Date.now()}`, { cache: "no-store" }).then(r => r.json()),
      fetch(`/api/admin/blocks?barber=${name}&_=${Date.now()}`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
      fetch(`/api/admin/day-overrides?barber=${name}&_=${Date.now()}`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
    ]).then(([barbers, bl, ov]) => {
      const barber = Array.isArray(barbers) ? barbers.find((b: { name: string; schedule: Schedule }) => norm(b.name || "") === norm(name)) : null;
      setSchedule(barber?.schedule ?? {});
      setBlocks(Array.isArray(bl) ? bl.filter((b: { date: string }) => b.date >= todayStr()) : []);
      setOverrides(Array.isArray(ov) ? ov.filter((o: { date: string }) => o.date >= todayStr()) : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const displayName = barberName === "stephanie" ? "Stéphanie" : barberName === "melynda" ? "Melynda" : barberName;

  async function saveSchedule() {
    setSavingSched(true); setSchedMsg("");
    const data = await manage({ action: "schedule", schedule });
    setSavingSched(false);
    setSchedMsg(data.error ? `Erreur: ${data.error}` : "Horaire sauvegardé ✓");
    setTimeout(() => setSchedMsg(""), 3000);
  }
  async function addBlock() {
    if (!blockForm.date) return;
    const payload: Record<string, unknown> = { action: "addBlock", date: blockForm.date, reason: blockForm.reason };
    if (blockForm.partial) { payload.start_time = blockForm.start; payload.end_time = blockForm.end; }
    const data = await manage(payload);
    if (!data.error) { setBlockForm({ date: "", reason: "", partial: false, start: "13:00", end: "15:00" }); refresh(); }
  }
  async function removeBlock(id: string) {
    const data = await manage({ action: "removeBlock", id });
    if (!data.error) setBlocks(prev => prev.filter(b => b.id !== id));
  }
  async function addOverride() {
    if (!ovForm.date) return;
    const data = await manage({ action: "addOverride", date: ovForm.date, open: ovForm.open, close: ovForm.close });
    if (!data.error) { setOvForm({ date: "", open: "09:00", close: "17:00" }); refresh(); }
  }
  async function removeOverride(id: string) {
    const data = await manage({ action: "removeOverride", id });
    if (!data.error) setOverrides(prev => prev.filter(o => o.id !== id));
  }

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <BarberSidebar />
      <main style={{ marginLeft: isMobile ? 0 : "260px", flex: 1, padding: isMobile ? "28px 16px 100px" : "40px 48px", width: "100%" }}>
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "6px" }}>Mes Horaires</h1>
          <p style={{ color: "#555", fontSize: "13px" }}>Gère tes disponibilités — {displayName}</p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "620px" }}>

            {/* Horaires réguliers — éditables */}
            <div style={card}>
              <p style={label}>Mes horaires réguliers</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {DAYS.map(({ key, label: dlabel }) => {
                  const day = schedule?.[key];
                  const isOpen = !!day;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <button onClick={() => setSchedule(s => ({ ...s, [key]: isOpen ? null : { open: "09:00", close: "17:00" } }))}
                        style={{ width: "46px", fontSize: "11px", padding: "5px 0", borderRadius: "6px", cursor: "pointer", fontWeight: 600,
                          background: isOpen ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)",
                          border: isOpen ? "1px solid rgba(212,175,55,0.4)" : "1px solid #2A2A2A", color: isOpen ? "#D4AF37" : "#666" }}>
                        {isOpen ? "OUI" : "NON"}
                      </button>
                      <span style={{ color: isOpen ? "#AAA" : "#555", fontSize: "13px", width: "90px" }}>{dlabel}</span>
                      {isOpen && day ? (
                        <>
                          <input type="time" value={day.open} onChange={e => setSchedule(s => ({ ...s, [key]: { ...day, open: e.target.value } }))} style={inputStyle} />
                          <span style={{ color: "#666" }}>–</span>
                          <input type="time" value={day.close} onChange={e => setSchedule(s => ({ ...s, [key]: { ...day, close: e.target.value } }))} style={inputStyle} />
                        </>
                      ) : <span style={{ color: "#444", fontSize: "12px" }}>Fermé</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "20px" }}>
                <button onClick={saveSchedule} disabled={savingSched} style={btnGold}>{savingSched ? "..." : "Sauvegarder l'horaire"}</button>
                {schedMsg && <span style={{ color: schedMsg.startsWith("Erreur") ? "#e55" : "#7AC74F", fontSize: "12px" }}>{schedMsg}</span>}
              </div>
            </div>

            {/* Congés */}
            <div style={card}>
              <p style={label}>Mes congés à venir ({blocks.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <input type="date" min={todayStr()} value={blockForm.date} onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                  <input placeholder="Raison (optionnel)" value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: "120px" }} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#AAA", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={blockForm.partial} onChange={e => setBlockForm(f => ({ ...f, partial: e.target.checked }))} />
                  Bloquer juste une plage d&apos;heures (sinon journée complète)
                </label>
                {blockForm.partial && (
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input type="time" value={blockForm.start} onChange={e => setBlockForm(f => ({ ...f, start: e.target.value }))} style={inputStyle} />
                    <span style={{ color: "#666" }}>à</span>
                    <input type="time" value={blockForm.end} onChange={e => setBlockForm(f => ({ ...f, end: e.target.value }))} style={inputStyle} />
                  </div>
                )}
                <button onClick={addBlock} disabled={!blockForm.date} style={{ ...btnGold, opacity: blockForm.date ? 1 : 0.4, alignSelf: "flex-start" }}>+ Me bloquer</button>
              </div>
              {blocks.length === 0 ? (
                <p style={{ color: "#444", fontSize: "13px" }}>Aucun congé planifié</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {blocks.map(b => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(238,85,85,0.04)", border: "1px solid rgba(238,85,85,0.1)", borderRadius: "8px", padding: "10px 16px" }}>
                      <span style={{ color: "#AAA", fontSize: "13px", textTransform: "capitalize" }}>{formatDate(b.date)}{b.start_time && b.end_time ? ` · ${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}` : " · journée"}{b.reason ? ` · ${b.reason}` : ""}</span>
                      <button onClick={() => removeBlock(b.id)} style={{ background: "none", border: "none", color: "#e55", cursor: "pointer", fontSize: "16px" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Journées exceptionnelles */}
            <div style={card}>
              <p style={label}>Journées exceptionnelles ({overrides.length})</p>
              <p style={{ color: "#666", fontSize: "12px", marginTop: "-8px", marginBottom: "14px" }}>Travailler un jour normalement fermé.</p>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "16px" }}>
                <input type="date" min={todayStr()} value={ovForm.date} onChange={e => setOvForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
                <input type="time" value={ovForm.open} onChange={e => setOvForm(f => ({ ...f, open: e.target.value }))} style={inputStyle} />
                <span style={{ color: "#666", alignSelf: "center" }}>–</span>
                <input type="time" value={ovForm.close} onChange={e => setOvForm(f => ({ ...f, close: e.target.value }))} style={inputStyle} />
                <button onClick={addOverride} disabled={!ovForm.date} style={{ ...btnGold, opacity: ovForm.date ? 1 : 0.4 }}>+ Ajouter</button>
              </div>
              {overrides.length === 0 ? (
                <p style={{ color: "#444", fontSize: "13px" }}>Aucune disponibilité exceptionnelle</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {overrides.map(o => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: "8px", padding: "10px 16px" }}>
                      <span style={{ color: "#D4AF37", fontSize: "13px", textTransform: "capitalize" }}>{formatDate(o.date)} · {o.open.slice(0,5)} – {o.close.slice(0,5)}</span>
                      <button onClick={() => removeOverride(o.id)} style={{ background: "none", border: "none", color: "#e55", cursor: "pointer", fontSize: "16px" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
