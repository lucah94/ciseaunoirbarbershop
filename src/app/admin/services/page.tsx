"use client";
import { useEffect, useState, useCallback } from "react";
import AdminSidebar from "@/components/AdminSidebar";

type Service = {
  id: string;
  name: string;
  price: number;
  duration_min: number;
  description: string | null;
  icon: string | null;
  active: boolean;
  sort_order: number | null;
  created_at?: string;
};

type Draft = {
  name: string;
  price: string;
  duration_min: string;
  description: string;
  icon: string;
  active: boolean;
};

const GOLD = "#C9A84C";

const inputStyle: React.CSSProperties = {
  background: "#0A0A0A",
  border: "1px solid #2A2A2A",
  color: "#F5F5F5",
  padding: "10px 12px",
  fontSize: "13px",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#555",
  fontSize: "11px",
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "8px",
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState<Draft>({
    name: "", price: "", duration_min: "", description: "", icon: "", active: true,
  });

  const toDraft = (s: Service): Draft => ({
    name: s.name ?? "",
    price: s.price?.toString() ?? "",
    duration_min: s.duration_min?.toString() ?? "",
    description: s.description ?? "",
    icon: s.icon ?? "",
    active: !!s.active,
  });

  const fetchServices = useCallback(() => {
    fetch(`/api/admin/services?_=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        const list: Service[] = Array.isArray(data) ? data : [];
        setServices(list);
        setDrafts(Object.fromEntries(list.map(s => [s.id, toDraft(s)])));
        setLoading(false);
      })
      .catch(() => { setMsg({ type: "err", text: "Erreur de chargement" }); setLoading(false); });
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  function flash(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  }

  function updateDraft(id: string, key: keyof Draft, value: string | boolean) {
    setDrafts(d => ({ ...d, [id]: { ...d[id], [key]: value } }));
  }

  async function saveService(id: string) {
    const d = drafts[id];
    if (!d) return;
    if (!d.name.trim()) { flash("err", "Le nom est requis"); return; }
    const price = parseFloat(d.price);
    if (isNaN(price) || price < 0) { flash("err", "Prix invalide"); return; }

    setSavingId(id);
    try {
      const res = await fetch("/api/admin/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: d.name.trim(),
          price,
          duration_min: parseInt(d.duration_min, 10) || 0,
          description: d.description,
          icon: d.icon,
          active: d.active,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      flash("ok", "Service enregistré");
      fetchServices();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteService(id: string, name: string) {
    if (!confirm(`Supprimer le service « ${name} » ?`)) return;
    try {
      const res = await fetch("/api/admin/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      flash("ok", "Service supprimé");
      fetchServices();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Erreur de suppression");
    }
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { flash("err", "Le nom est requis"); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { flash("err", "Prix invalide"); return; }

    setAdding(true);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          price,
          duration_min: parseInt(form.duration_min, 10) || 0,
          description: form.description,
          icon: form.icon,
          sort_order: services.length,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      flash("ok", "Service ajouté");
      setForm({ name: "", price: "", duration_min: "", description: "", icon: "", active: true });
      fetchServices();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Erreur d'ajout");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />

      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>
            Services / Prix
          </h1>
          <p style={{ color: "#666", fontSize: "13px", letterSpacing: "1px", marginTop: "8px" }}>
            Modifie les services, prix et durées affichés aux clients.
          </p>
        </div>

        {msg && (
          <div style={{
            marginBottom: "24px",
            padding: "12px 16px",
            fontSize: "13px",
            letterSpacing: "1px",
            background: msg.type === "ok" ? "rgba(90,170,90,0.1)" : "rgba(229,85,85,0.1)",
            border: `1px solid ${msg.type === "ok" ? "#3a6a3a" : "#6a3a3a"}`,
            color: msg.type === "ok" ? "#7ac77a" : "#e88",
          }}>
            {msg.text}
          </div>
        )}

        {/* Liste éditable */}
        {loading ? (
          <p style={{ color: "#555", fontSize: "13px" }}>Chargement…</p>
        ) : services.length === 0 ? (
          <p style={{ color: "#555", fontSize: "13px", marginBottom: "32px" }}>Aucun service.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "40px" }}>
            {services.map(s => {
              const d = drafts[s.id] ?? toDraft(s);
              return (
                <div key={s.id} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px" }}>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "2 1 220px" }}>
                      <label style={labelStyle}>Nom</label>
                      <input value={d.name} onChange={e => updateDraft(s.id, "name", e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ flex: "1 1 90px" }}>
                      <label style={labelStyle}>Prix ($)</label>
                      <input type="number" min="0" step="0.01" value={d.price}
                        onChange={e => updateDraft(s.id, "price", e.target.value)}
                        style={{ ...inputStyle, colorScheme: "dark" }} />
                    </div>
                    <div style={{ flex: "1 1 90px" }}>
                      <label style={labelStyle}>Durée (min)</label>
                      <input type="number" min="0" step="1" value={d.duration_min}
                        onChange={e => updateDraft(s.id, "duration_min", e.target.value)}
                        style={{ ...inputStyle, colorScheme: "dark" }} />
                    </div>
                    <div style={{ flex: "1 1 90px" }}>
                      <label style={labelStyle}>Icône</label>
                      <input value={d.icon} onChange={e => updateDraft(s.id, "icon", e.target.value)} style={inputStyle} />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#888", fontSize: "12px", paddingBottom: "10px", cursor: "pointer", flexShrink: 0 }}>
                      <input type="checkbox" checked={d.active}
                        onChange={e => updateDraft(s.id, "active", e.target.checked)}
                        style={{ accentColor: GOLD, width: "16px", height: "16px", cursor: "pointer" }} />
                      Actif
                    </label>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label style={labelStyle}>Description</label>
                    <textarea value={d.description} onChange={e => updateDraft(s.id, "description", e.target.value)}
                      rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                    <button onClick={() => saveService(s.id)} disabled={savingId === s.id}
                      className="btn-gold" style={{ padding: "9px 22px", fontSize: "11px" }}>
                      {savingId === s.id ? "…" : "Enregistrer"}
                    </button>
                    <button onClick={() => deleteService(s.id, s.name)}
                      style={{ background: "none", border: "1px solid #3a2222", color: "#a55", padding: "9px 22px", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer" }}>
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ajouter un service */}
        <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px" }}>
          <p style={{ color: GOLD, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>
            Ajouter un service
          </p>
          <form onSubmit={addService}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "2 1 220px" }}>
                <label style={labelStyle}>Nom</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required style={inputStyle} />
              </div>
              <div style={{ flex: "1 1 90px" }}>
                <label style={labelStyle}>Prix ($)</label>
                <input type="number" min="0" step="0.01" placeholder="35" value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required
                  style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
              <div style={{ flex: "1 1 90px" }}>
                <label style={labelStyle}>Durée (min)</label>
                <input type="number" min="0" step="1" placeholder="30" value={form.duration_min}
                  onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                  style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
              <div style={{ flex: "1 1 90px" }}>
                <label style={labelStyle}>Icône</label>
                <input placeholder="✂️" value={form.icon}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <button type="submit" disabled={adding || !form.name.trim() || !form.price}
              className="btn-gold" style={{ padding: "10px 24px", fontSize: "11px", marginTop: "16px" }}>
              {adding ? "…" : "+ Ajouter"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
