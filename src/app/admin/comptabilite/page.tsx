"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Expense = { id: string; description: string; amount: number; category: string; date: string; };

const NAV = [
  { label: "Vue d'ensemble", href: "/admin" },
  { label: "Agenda", href: "/admin/agenda" },
  { label: "Paye", href: "/admin/paye" },
  { label: "Comptabilité", href: "/admin/comptabilite" },
];

const CATEGORIES = ["Loyer", "Produits", "Équipement", "Marketing", "Téléphone", "Assurances", "Salaires", "Autre"];

function getMonthRange(offset = 0) {
  const now = new Date();
  now.setMonth(now.getMonth() + offset);
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const label = now.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return { start, end, label };
}

export default function ComptabilitePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [form, setForm] = useState({ description: "", amount: "", category: "Loyer", date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);
  const [cuts, setCuts] = useState<{ price: number; tip: number; discount_percent: number; date: string }[]>([]);
  const month = getMonthRange(monthOffset);

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then(r => r.json()),
      fetch("/api/cuts").then(r => r.json()),
    ]).then(([e, c]) => {
      setExpenses(Array.isArray(e) ? e : []);
      setCuts(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, []);

  const monthExpenses = expenses.filter(e => e.date >= month.start && e.date <= month.end);
  const monthCuts = cuts.filter(c => c.date >= month.start && c.date <= month.end);

  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalRevenue = monthCuts.reduce((s, c) => s + c.price * (1 - c.discount_percent / 100) + c.tip, 0);
  const net = totalRevenue - totalExpenses;

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    total: monthExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
    count: monthExpenses.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = { description: form.description, amount: parseFloat(form.amount), category: form.category, date: form.date };
    const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const newExp = await res.json();
    setExpenses(prev => [newExp, ...prev]);
    setForm(f => ({ ...f, description: "", amount: "" }));
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    setExpenses(prev => prev.filter(e => e.id !== id));
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
              display: "block", padding: "12px 24px", color: item.href === "/admin/comptabilite" ? "#C9A84C" : "#666",
              textDecoration: "none", fontSize: "13px", letterSpacing: "1px",
              background: item.href === "/admin/comptabilite" ? "#111" : "transparent",
              borderLeft: item.href === "/admin/comptabilite" ? "2px solid #C9A84C" : "2px solid transparent",
            }}>{item.label}</Link>
          ))}
        </nav>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1A1A1A" }}>
          <Link href="/" style={{ color: "#444", fontSize: "12px", textDecoration: "none" }}>← Voir le site</Link>
        </div>
      </aside>

      <main style={{ marginLeft: "220px", flex: 1, padding: "40px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>Comptabilité</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "12px" }}>
            <button onClick={() => setMonthOffset(o => o - 1)} style={{ background: "#111", border: "1px solid #222", color: "#666", padding: "6px 12px", cursor: "pointer" }}>←</button>
            <p style={{ color: "#C9A84C", fontSize: "13px", letterSpacing: "2px", textTransform: "capitalize" }}>{month.label}</p>
            <button onClick={() => setMonthOffset(o => o + 1)} style={{ background: "#111", border: "1px solid #222", color: "#666", padding: "6px 12px", cursor: "pointer" }}>→</button>
            {monthOffset !== 0 && <button onClick={() => setMonthOffset(0)} style={{ background: "none", border: "none", color: "#444", fontSize: "12px", cursor: "pointer" }}>Mois courant</button>}
          </div>
        </div>

        {/* Stats du mois */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px" }}>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Revenus</p>
            <p style={{ fontSize: "28px", color: "#C9A84C", fontWeight: 300 }}>{totalRevenue.toFixed(2)}$</p>
          </div>
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px" }}>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Dépenses</p>
            <p style={{ fontSize: "28px", color: "#e55", fontWeight: 300 }}>-{totalExpenses.toFixed(2)}$</p>
          </div>
          <div style={{ background: "#111", border: `1px solid ${net >= 0 ? "#2a3a2a" : "#3a1a1a"}`, padding: "24px" }}>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Net</p>
            <p style={{ fontSize: "28px", color: net >= 0 ? "#5a5" : "#e55", fontWeight: 300 }}>{net >= 0 ? "+" : ""}{net.toFixed(2)}$</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
          {/* Dépenses */}
          <div>
            {/* Ajouter dépense */}
            <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", marginBottom: "20px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Ajouter une dépense</p>
              <form onSubmit={addExpense} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "2 1 200px" }}>
                  <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Description</label>
                  <input type="text" placeholder="Loyer mars..." required value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "10px 12px", fontSize: "13px", width: "100%", outline: "none" }} />
                </div>
                <div style={{ flex: "1 1 100px" }}>
                  <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Montant ($)</label>
                  <input type="number" placeholder="0.00" required step="0.01" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "10px 12px", fontSize: "13px", width: "100%", outline: "none" }} />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Catégorie</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "10px 12px", fontSize: "13px", width: "100%", outline: "none" }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <label style={{ display: "block", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "10px 12px", fontSize: "13px", width: "100%", outline: "none", colorScheme: "dark" }} />
                </div>
                <button type="submit" disabled={saving} className="btn-gold" style={{ padding: "10px 20px", fontSize: "11px", flexShrink: 0 }}>
                  {saving ? "..." : "+ Ajouter"}
                </button>
              </form>
            </div>

            {/* Liste dépenses */}
            <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>
                Dépenses — {monthExpenses.length} entrée{monthExpenses.length > 1 ? "s" : ""}
              </p>
              {loading ? (
                <p style={{ color: "#444" }}>Chargement...</p>
              ) : monthExpenses.length === 0 ? (
                <p style={{ color: "#333", fontSize: "14px" }}>Aucune dépense ce mois</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {monthExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                      <div>
                        <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{e.description}</p>
                        <p style={{ color: "#555", fontSize: "12px" }}>{e.category} · {e.date}</p>
                      </div>
                      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                        <span style={{ color: "#e55", fontSize: "15px" }}>-{e.amount.toFixed(2)}$</span>
                        <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "16px" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Par catégorie */}
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", alignSelf: "start" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Par catégorie</p>
            {byCategory.length === 0 ? (
              <p style={{ color: "#333", fontSize: "13px" }}>Aucune dépense</p>
            ) : byCategory.sort((a, b) => b.total - a.total).map(c => (
              <div key={c.cat} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#888", fontSize: "13px" }}>{c.cat}</span>
                  <span style={{ color: "#e55", fontSize: "13px" }}>{c.total.toFixed(2)}$</span>
                </div>
                <div style={{ height: "3px", background: "#1A1A1A", borderRadius: "2px" }}>
                  <div style={{ height: "100%", background: "#e55", width: `${Math.min(100, (c.total / totalExpenses) * 100)}%`, borderRadius: "2px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
