"use client";
import { useEffect, useState, useRef } from "react";
import AdminSidebar from "@/components/AdminSidebar";

type Expense = { id: string; description: string; amount: number; category: string; date: string; receipt_url?: string };
type PendingExpense = { description: string; amount: string; category: string; date: string; receipt_url: string; preview: string; analyzing: boolean };

const CATEGORIES = ["Loyer", "Produits", "Équipement", "Marketing", "Téléphone", "Assurances", "Salaires", "Employés", "Autre"];

function getMonthRange(offset = 0) {
  const now = new Date();
  now.setMonth(now.getMonth() + offset);
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const label = now.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return { start, end, label };
}

function exportCSV(expenses: Expense[], label: string) {
  const header = "Date,Description,Catégorie,Montant ($),Reçu\n";
  const rows = expenses.sort((a, b) => a.date.localeCompare(b.date))
    .map(e => `${e.date},"${e.description}",${e.category},${Number(e.amount).toFixed(2)},${e.receipt_url || ""}`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `depenses-${label.replace(/\s/g, "-")}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function ComptabilitePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [pending, setPending] = useState<PendingExpense[]>([]);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [cuts, setCuts] = useState<{ price: number; tip: number; discount_percent: number; date: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const manualPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const month = getMonthRange(monthOffset);

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses").then(r => r.json()),
      fetch("/api/cuts").then(r => r.json()),
    ]).then(([e, c]) => {
      setExpenses(Array.isArray(e) ? e : []);
      setCuts(Array.isArray(c) ? c : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const monthExpenses = expenses.filter(e => e.date >= month.start && e.date <= month.end);
  const monthCuts = cuts.filter(c => c.date >= month.start && c.date <= month.end);
  const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = monthCuts.reduce((s, c) => s + c.price * (1 - c.discount_percent / 100) + c.tip, 0);
  const net = totalRevenue - totalExpenses;
  const byCategory = CATEGORIES.map(cat => ({
    cat,
    total: monthExpenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
    count: monthExpenses.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Ajouter en attente avec preview
    const newPending: PendingExpense[] = files.map(f => ({
      description: "", amount: "", category: "Autre",
      date: new Date().toISOString().split("T")[0],
      receipt_url: "", preview: URL.createObjectURL(f), analyzing: true,
    }));
    setPending(prev => [...prev, ...newPending]);

    // Envoyer à l'API d'analyse (par batch de 5)
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    const res = await fetch("/api/expenses/analyze", { method: "POST", body: fd });
    const results = await res.json();

    setPending(prev => {
      const updated = [...prev];
      const startIdx = updated.length - newPending.length;
      results.forEach((r: Partial<PendingExpense>, i: number) => {
        updated[startIdx + i] = {
          ...updated[startIdx + i],
          description: r.description || "",
          amount: r.amount ? String(r.amount) : "",
          category: r.category || "Autre",
          date: r.date || new Date().toISOString().split("T")[0],
          receipt_url: r.receipt_url || "",
          analyzing: false,
        };
      });
      return updated;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function attachPhotoToManual(file: File, idx: number) {
    const preview = URL.createObjectURL(file);
    setPending(prev => prev.map((x, j) => j === idx ? { ...x, preview, analyzing: true } : x));
    const fd = new FormData();
    fd.append("files", file);
    const res = await fetch("/api/expenses/analyze", { method: "POST", body: fd });
    const results = await res.json();
    const r = results[0] || {};
    setPending(prev => prev.map((x, j) => j === idx ? {
      ...x,
      analyzing: false,
      description: x.description || r.description || "",
      amount: x.amount || (r.amount ? String(r.amount) : ""),
      category: r.category || x.category,
      date: x.date || r.date || new Date().toISOString().split("T")[0],
      receipt_url: r.receipt_url || "",
    } : x));
  }

  async function saveAll() {
    const ready = pending.filter(p => !p.analyzing && p.description && p.amount);
    if (!ready.length) return;
    setSaving(true);
    const saved = await Promise.all(ready.map(p =>
      fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: p.description, amount: parseFloat(p.amount), category: p.category, date: p.date, receipt_url: p.receipt_url || null }),
      }).then(r => r.json())
    ));
    setExpenses(prev => [...saved.filter(s => !s.error), ...prev]);
    setPending([]);
    setSaving(false);
  }

  const inputStyle = { background: "#0A0A0A", border: "1px solid #2A2A2A", color: "#F5F5F5", padding: "8px 10px", fontSize: "13px", outline: "none", borderRadius: "6px", width: "100%" };

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={lightbox} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "8px", objectFit: "contain" }} />
        </div>
      )}

      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "12px" }}>Comptabilité</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button onClick={() => setMonthOffset(o => o - 1)} style={{ background: "#111", border: "1px solid #222", color: "#666", padding: "6px 12px", cursor: "pointer", borderRadius: "4px" }}>←</button>
              <p style={{ color: "#C9A84C", fontSize: "13px", letterSpacing: "2px", textTransform: "capitalize", minWidth: "120px", textAlign: "center" }}>{month.label}</p>
              <button onClick={() => setMonthOffset(o => o + 1)} style={{ background: "#111", border: "1px solid #222", color: "#666", padding: "6px 12px", cursor: "pointer", borderRadius: "4px" }}>→</button>
              {monthOffset !== 0 && <button onClick={() => setMonthOffset(0)} style={{ background: "none", border: "none", color: "#444", fontSize: "12px", cursor: "pointer" }}>Mois courant</button>}
            </div>
          </div>
          {monthExpenses.length > 0 && (
            <button onClick={() => exportCSV(monthExpenses, month.label)}
              style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#C9A84C", padding: "10px 20px", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", borderRadius: "8px", fontWeight: 600 }}>
              ↓ Exporter CSV
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
          {[{ label: "Revenus", value: `${totalRevenue.toFixed(2)}$`, color: "#C9A84C" },
            { label: "Dépenses", value: `-${totalExpenses.toFixed(2)}$`, color: "#e55" },
            { label: "Net", value: `${net >= 0 ? "+" : ""}${net.toFixed(2)}$`, color: net >= 0 ? "#5a5" : "#e55" }
          ].map(s => (
            <div key={s.label} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", borderRadius: "8px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{s.label}</p>
              <p style={{ fontSize: "28px", color: s.color, fontWeight: 300 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Zone upload photos */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <div style={{ flex: 1, background: "#111", border: "2px dashed #2A2A2A", borderRadius: "12px", padding: "28px", textAlign: "center" }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple onChange={handleFiles} style={{ display: "none" }} id="receipts-input" />
            <label htmlFor="receipts-input" style={{ cursor: "pointer", display: "block" }}>
              <p style={{ fontSize: "28px", marginBottom: "6px" }}>📷</p>
              <p style={{ color: "#C9A84C", fontSize: "13px", letterSpacing: "1px", marginBottom: "4px" }}>Prendre en photo ou sélectionner vos reçus</p>
              <p style={{ color: "#444", fontSize: "12px" }}>Jusqu&apos;à 15 photos — l&apos;IA remplit tout automatiquement</p>
            </label>
          </div>
          <button onClick={() => setPending(prev => [...prev, { description: "", amount: "", category: "Employés", date: new Date().toISOString().split("T")[0], receipt_url: "", preview: "", analyzing: false }])}
            style={{ background: "#111", border: "2px dashed #2A2A2A", borderRadius: "12px", padding: "28px 32px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "160px" }}>
            <span style={{ fontSize: "28px" }}>✏️</span>
            <span style={{ color: "#C9A84C", fontSize: "13px", letterSpacing: "1px" }}>Saisie manuelle</span>
            <span style={{ color: "#444", fontSize: "12px" }}>Facture employé,</span>
            <span style={{ color: "#444", fontSize: "12px" }}>sans photo</span>
          </button>
        </div>

        {/* Reçus en attente de confirmation */}
        {pending.length > 0 && (
          <div style={{ background: "#0D0D0D", border: "1px solid rgba(212,175,55,0.2)", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>
                {pending.filter(p => p.analyzing).length > 0 ? `⏳ Analyse en cours... (${pending.filter(p => p.analyzing).length} restant)` : `✓ ${pending.length} reçu${pending.length > 1 ? "s" : ""} analysé${pending.length > 1 ? "s" : ""} — Vérifier et confirmer`}
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setPending([])} style={{ background: "none", border: "1px solid #2A2A2A", color: "#555", padding: "8px 16px", cursor: "pointer", borderRadius: "6px", fontSize: "12px" }}>Tout effacer</button>
                <button onClick={saveAll} disabled={saving || pending.some(p => p.analyzing)}
                  style={{ background: pending.some(p => p.analyzing) ? "#1A1A1A" : "linear-gradient(135deg, #D4AF37, #B8860B)", color: pending.some(p => p.analyzing) ? "#444" : "#080808", border: "none", padding: "8px 20px", cursor: "pointer", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                  {saving ? "Sauvegarde..." : `✓ Tout sauvegarder (${pending.filter(p => !p.analyzing).length})`}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {pending.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start", background: "#111", borderRadius: "10px", padding: "16px" }}>
                  {p.preview ? (
                    <img src={p.preview} onClick={() => setLightbox(p.preview)}
                      style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "8px", cursor: "zoom-in", flexShrink: 0, border: "1px solid #2A2A2A", opacity: p.analyzing ? 0.5 : 1 }} />
                  ) : (
                    <>
                      <input ref={el => { manualPhotoRefs.current[i] = el; }} type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) attachPhotoToManual(f, i); }} />
                      <div onClick={() => manualPhotoRefs.current[i]?.click()}
                        title="Cliquer pour ajouter une photo"
                        style={{ width: "64px", height: "64px", borderRadius: "8px", border: "1px dashed #444", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "20px", cursor: "pointer", gap: "2px" }}>
                        <span>📎</span>
                        <span style={{ color: "#444", fontSize: "9px" }}>photo</span>
                      </div>
                    </>
                  )}
                  {p.analyzing ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "20px", height: "20px", border: "2px solid #1A1A1A", borderTopColor: "#C9A84C", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <p style={{ color: "#555", fontSize: "13px" }}>L&apos;IA analyse le reçu...</p>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "8px", alignItems: "center" }}>
                      <input value={p.description} onChange={e => setPending(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                        placeholder="Description" style={inputStyle} />
                      <input type="number" value={p.amount} onChange={e => setPending(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                        placeholder="Montant" style={inputStyle} />
                      <select value={p.category} onChange={e => setPending(prev => prev.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                        style={{ ...inputStyle, cursor: "pointer" }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="date" value={p.date} onChange={e => setPending(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        style={{ ...inputStyle, colorScheme: "dark" }} />
                      <button onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "18px", padding: "0 4px" }}>✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
          {/* Liste dépenses */}
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", borderRadius: "8px" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>
              Dépenses — {monthExpenses.length} entrée{monthExpenses.length !== 1 ? "s" : ""}
            </p>
            {loading ? <p style={{ color: "#444" }}>Chargement...</p> :
              monthExpenses.length === 0 ? <p style={{ color: "#333", fontSize: "14px" }}>Aucune dépense ce mois</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {monthExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {e.receipt_url ? (
                          <img src={e.receipt_url} onClick={() => setLightbox(e.receipt_url!)}
                            style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", cursor: "zoom-in", border: "1px solid #2A2A2A", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: "40px", height: "40px", borderRadius: "6px", background: "#0D0D0D", border: "1px dashed #222", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ color: "#333", fontSize: "16px" }}>📄</span>
                          </div>
                        )}
                        <div>
                          <p style={{ color: "#F5F5F5", fontSize: "14px" }}>{e.description}</p>
                          <p style={{ color: "#555", fontSize: "12px" }}>{e.category} · {e.date}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <span style={{ color: "#e55", fontSize: "15px", fontWeight: 500 }}>-{Number(e.amount).toFixed(2)}$</span>
                        <button onClick={() => { if (confirm("Supprimer cette dépense?")) fetch(`/api/expenses?id=${e.id}`, { method: "DELETE" }).then(() => setExpenses(prev => prev.filter(x => x.id !== e.id))); }}
                          style={{ background: "none", border: "1px solid #3A1A1A", color: "#e55", cursor: "pointer", fontSize: "13px", padding: "4px 8px", borderRadius: "4px", opacity: 0.7 }}
                          onMouseEnter={e2 => (e2.currentTarget.style.opacity = "1")}
                          onMouseLeave={e2 => (e2.currentTarget.style.opacity = "0.7")}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Par catégorie */}
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", alignSelf: "start", borderRadius: "8px" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Par catégorie</p>
            {byCategory.length === 0 ? <p style={{ color: "#333", fontSize: "13px" }}>Aucune dépense</p> :
              byCategory.sort((a, b) => b.total - a.total).map(c => (
                <div key={c.cat} style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{ color: "#888", fontSize: "13px" }}>{c.cat} <span style={{ color: "#444", fontSize: "11px" }}>({c.count})</span></span>
                    <span style={{ color: "#e55", fontSize: "13px" }}>{c.total.toFixed(2)}$</span>
                  </div>
                  <div style={{ height: "4px", background: "#1A1A1A", borderRadius: "2px" }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg, #e55, #c33)", width: `${Math.min(100, (c.total / totalExpenses) * 100)}%`, borderRadius: "2px" }} />
                  </div>
                </div>
              ))}
            {byCategory.length > 0 && (
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #1A1A1A" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#555", fontSize: "12px" }}>Total</span>
                  <span style={{ color: "#e55", fontSize: "14px", fontWeight: 500 }}>{totalExpenses.toFixed(2)}$</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    </div>
  );
}
