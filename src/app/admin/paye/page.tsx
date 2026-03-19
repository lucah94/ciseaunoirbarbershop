"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Cut = {
  id: string; barber: string; service_name: string;
  price: number; tip: number; discount_percent: number; date: string;
};

const NAV = [
  { label: "Vue d'ensemble", href: "/admin" },
  { label: "Agenda", href: "/admin/agenda" },
  { label: "Paye", href: "/admin/paye" },
  { label: "Comptabilité", href: "/admin/comptabilite" },
];

const SERVICES = ["Coupe + Lavage", "Coupe + Rasage Lame", "Service Premium", "Rasage / Barbe", "Tarif Étudiant", "Autre"];
const BARBERS = ["Melynda", "Diodis"];

function getWeekDates(offset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
    label: `${monday.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}`,
  };
}

export default function PayePage() {
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ barber: "Melynda", service_name: "Coupe + Lavage", price: "", tip: "", discount_percent: "0", date: new Date().toISOString().split("T")[0] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const week = getWeekDates(weekOffset);

  useEffect(() => {
    fetch("/api/cuts")
      .then(r => r.json())
      .then(data => { setCuts(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const weekCuts = cuts.filter(c => c.date >= week.start && c.date <= week.end);

  function calcNet(c: Cut) {
    return c.price * (1 - c.discount_percent / 100) + c.tip;
  }

  const summary = BARBERS.map(name => {
    const bc = weekCuts.filter(c => c.barber === name);
    const totalCoupes = bc.reduce((s, c) => s + c.price * (1 - c.discount_percent / 100), 0);
    const totalTips = bc.reduce((s, c) => s + c.tip, 0);
    const totalNet = bc.reduce((s, c) => s + calcNet(c), 0);
    return { name, cuts: bc, totalCoupes, totalTips, totalNet };
  });

  async function addCut(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      barber: form.barber,
      service_name: form.service_name,
      price: parseFloat(form.price),
      tip: parseFloat(form.tip) || 0,
      discount_percent: parseFloat(form.discount_percent) || 0,
      date: form.date,
    };
    const res = await fetch("/api/cuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const newCut = await res.json();
    setCuts(prev => [newCut, ...prev]);
    setForm(f => ({ ...f, price: "", tip: "", discount_percent: "0" }));
    setSaving(false);
  }

  async function deleteCut(id: string) {
    await fetch(`/api/cuts?id=${id}`, { method: "DELETE" });
    setCuts(prev => prev.filter(c => c.id !== id));
  }

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
              display: "block", padding: "12px 24px", color: item.href === "/admin/paye" ? "#C9A84C" : "#666",
              textDecoration: "none", fontSize: "13px", letterSpacing: "1px",
              background: item.href === "/admin/paye" ? "#111" : "transparent",
              borderLeft: item.href === "/admin/paye" ? "2px solid #C9A84C" : "2px solid transparent",
            }}>{item.label}</Link>
          ))}
        </nav>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1A1A1A" }}>
          <Link href="/" style={{ color: "#444", fontSize: "12px", textDecoration: "none" }}>← Voir le site</Link>
        </div>
      </aside>

      <main style={{ marginLeft: "220px", flex: 1, padding: "40px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>Système de Paye</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "12px" }}>
            <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: "#111", border: "1px solid #222", color: "#666", padding: "6px 12px", cursor: "pointer" }}>←</button>
            <p style={{ color: "#C9A84C", fontSize: "13px", letterSpacing: "2px" }}>{week.label}</p>
            <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: "#111", border: "1px solid #222", color: "#666", padding: "6px 12px", cursor: "pointer" }}>→</button>
            {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ background: "none", border: "none", color: "#444", fontSize: "12px", cursor: "pointer" }}>Semaine courante</button>}
          </div>
        </div>

        {/* Résumé paye */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
          {summary.map(s => (
            <div key={s.name} style={{ background: "#111", border: "2px solid #C9A84C", padding: "28px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>{s.name}</p>
              <p style={{ fontSize: "36px", color: "#F5F5F5", fontWeight: 300, marginBottom: "16px" }}>{s.totalNet.toFixed(2)}$</p>
              <div style={{ display: "flex", gap: "24px" }}>
                <div><p style={{ color: "#555", fontSize: "11px" }}>Coupes</p><p style={{ color: "#888", fontSize: "15px" }}>{s.totalCoupes.toFixed(2)}$</p></div>
                <div><p style={{ color: "#555", fontSize: "11px" }}>Tips</p><p style={{ color: "#888", fontSize: "15px" }}>{s.totalTips.toFixed(2)}$</p></div>
                <div><p style={{ color: "#555", fontSize: "11px" }}># coupes</p><p style={{ color: "#888", fontSize: "15px" }}>{s.cuts.length}</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* Ajouter une coupe */}
        <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px", marginBottom: "32px" }}>
          <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Ajouter une coupe</p>
          <form onSubmit={addCut} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
            {[
              { label: "Barbière", key: "barber", type: "select", options: BARBERS },
              { label: "Service", key: "service_name", type: "select", options: SERVICES },
              { label: "Prix ($)", key: "price", type: "number", placeholder: "35" },
              { label: "Tip ($)", key: "tip", type: "number", placeholder: "0" },
              { label: "Rabais (%)", key: "discount_percent", type: "number", placeholder: "0" },
              { label: "Date", key: "date", type: "date" },
            ].map(({ label, key, type, options, placeholder }) => (
              <div key={key} style={{ flex: type === "select" ? "1 1 140px" : "1 1 100px" }}>
                <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{label}</label>
                {type === "select" ? (
                  <select value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "10px 12px", fontSize: "13px", width: "100%", outline: "none" }}>
                    {options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={type} placeholder={placeholder} value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={key === "price"}
                    style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "10px 12px", fontSize: "13px", width: "100%", outline: "none", colorScheme: "dark" }} />
                )}
              </div>
            ))}
            <button type="submit" disabled={saving || !form.price} className="btn-gold" style={{ padding: "10px 24px", fontSize: "11px", flexShrink: 0 }}>
              {saving ? "..." : "+ Ajouter"}
            </button>
          </form>
        </div>

        {/* Liste des coupes par barbière */}
        {summary.map(s => s.cuts.length > 0 && (
          <div key={s.name} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px", marginBottom: "16px" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>{s.name} — {s.cuts.length} coupe{s.cuts.length > 1 ? "s" : ""}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {s.cuts.map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                  <div>
                    <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{c.service_name}</p>
                    <p style={{ color: "#555", fontSize: "12px" }}>{c.date} {c.discount_percent > 0 && `· -${c.discount_percent}% rabais`}</p>
                  </div>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <span style={{ color: "#888", fontSize: "13px" }}>{c.price}$</span>
                    {c.tip > 0 && <span style={{ color: "#5a5", fontSize: "13px" }}>+{c.tip}$ tip</span>}
                    <span style={{ color: "#C9A84C", fontSize: "14px", minWidth: "60px", textAlign: "right" }}>{calcNet(c).toFixed(2)}$</span>
                    <button onClick={() => deleteCut(c.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "16px" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
