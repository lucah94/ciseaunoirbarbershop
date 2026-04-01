"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar from "@/components/AdminSidebar";

const DAYS = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

type Schedule = Record<string, { open: string; close: string } | null>;

type Barber = {
  id: string;
  name: string;
  role: string;
  schedule: Schedule;
  color: string;
  active: boolean;
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function ScheduleEditor({ schedule, onChange }: { schedule: Schedule; onChange: (s: Schedule) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {DAYS.map(({ key, label }) => {
        const day = schedule[key];
        const isOpen = !!day;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => {
                const next = { ...schedule };
                if (isOpen) { next[key] = null; } else { next[key] = { open: "09:00", close: "17:00" }; }
                onChange(next);
              }}
              style={{
                width: "44px", fontSize: "11px", padding: "4px 0", borderRadius: "6px", cursor: "pointer",
                background: isOpen ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)",
                border: isOpen ? "1px solid rgba(212,175,55,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: isOpen ? "#D4AF37" : "#666",
                fontWeight: 600, letterSpacing: "0.5px",
              }}
            >{isOpen ? "OUI" : "NON"}</button>
            <span style={{ color: isOpen ? "#AAA" : "#666", fontSize: "13px", width: "80px" }}>{label}</span>
            {isOpen && day ? (
              <>
                <input type="time" value={day.open}
                  onChange={e => onChange({ ...schedule, [key]: { ...day, open: e.target.value } })}
                  style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "6px 10px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark" }}
                />
                <span style={{ color: "#7D8590", fontSize: "12px" }}>–</span>
                <input type="time" value={day.close}
                  onChange={e => onChange({ ...schedule, [key]: { ...day, close: e.target.value } })}
                  style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "6px 10px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark" }}
                />
              </>
            ) : (
              <span style={{ color: "#555", fontSize: "12px" }}>Fermé</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function HorairesPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Barber>>({});
  const [saving, setSaving] = useState(false);
  const [addingBarber, setAddingBarber] = useState(false);
  const [newBarber, setNewBarber] = useState({ name: "", role: "", color: "#D4AF37" });

  // Dates bloquées
  const [blocks, setBlocks] = useState<{ id: string; barber: string; date: string; reason: string | null }[]>([]);
  const [addingBlock, setAddingBlock] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState({ date: "", reason: "" });

  // Disponibilités exceptionnelles
  const [overrides, setOverrides] = useState<{ id: string; barber: string; date: string; open: string; close: string }[]>([]);
  const [addingOverride, setAddingOverride] = useState<string | null>(null);
  const [overrideForm, setOverrideForm] = useState({ date: "", open: "09:00", close: "17:00" });

  useEffect(() => {
    Promise.all([
      fetch("/api/barbers").then(r => r.json()),
      fetch("/api/admin/blocks").then(r => r.json()).catch(() => []),
      fetch("/api/admin/day-overrides").then(r => r.json()).catch(() => []),
    ]).then(([b, bl, ov]) => {
      setBarbers(Array.isArray(b) ? b : []);
      setBlocks(Array.isArray(bl) ? bl : []);
      setOverrides(Array.isArray(ov) ? ov : []);
      setLoading(false);
    });
  }, []);

  async function saveBarber() {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch("/api/barbers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editForm }),
    });
    const data = await res.json();
    if (!data.error) {
      setBarbers(prev => prev.map(b => b.id === editingId ? data : b));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function deleteBarber(id: string, name: string) {
    if (!confirm(`Supprimer ${name} ? Ses réservations existantes ne seront pas affectées.`)) return;
    await fetch("/api/barbers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBarbers(prev => prev.filter(b => b.id !== id));
  }

  async function addBarber() {
    if (!newBarber.name) return;
    setSaving(true);
    const res = await fetch("/api/barbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newBarber, schedule: {} }),
    });
    const data = await res.json();
    if (!data.error) {
      setBarbers(prev => [...prev, data]);
      setNewBarber({ name: "", role: "", color: "#D4AF37" });
      setAddingBarber(false);
    }
    setSaving(false);
  }

  async function addBlock(barberName: string) {
    if (!blockForm.date) return;
    const res = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barber: barberName.toLowerCase(), date: blockForm.date, reason: blockForm.reason || null }),
    });
    const data = await res.json();
    if (!data.error) {
      setBlocks(prev => [...prev, data]);
      setBlockForm({ date: "", reason: "" });
      setAddingBlock(null);
    }
  }

  async function removeBlock(id: string) {
    await fetch("/api/admin/blocks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  async function addOverride(barberName: string) {
    if (!overrideForm.date) return;
    const res = await fetch("/api/admin/day-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barber: barberName.toLowerCase(), date: overrideForm.date, open: overrideForm.open, close: overrideForm.close }),
    });
    const data = await res.json();
    if (!data.error) {
      setOverrides(prev => [...prev.filter(o => !(o.barber === barberName.toLowerCase() && o.date === overrideForm.date)), data]);
      setOverrideForm({ date: "", open: "09:00", close: "17:00" });
      setAddingOverride(null);
    }
  }

  async function removeOverride(id: string) {
    await fetch("/api/admin/day-overrides", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setOverrides(prev => prev.filter(o => o.id !== id));
  }

  return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "2px", color: "#F0F0F0", marginBottom: "6px" }}>Horaires</h1>
              <p style={{ color: "#7D8590", fontSize: "13px" }}>Gérez les barbiers et leurs disponibilités</p>
            </div>
            <button onClick={() => setAddingBarber(true)} style={{
              background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", border: "none",
              padding: "10px 22px", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase",
              fontWeight: 700, cursor: "pointer", borderRadius: "8px",
            }}>+ Ajouter barbier</button>
          </div>
        </motion.div>

        {/* Formulaire ajout barbier */}
        <AnimatePresence>
          {addingBarber && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden", marginBottom: "24px" }}>
              <div style={{ background: "#161B22", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "14px", padding: "28px" }}>
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Nouveau barbier</p>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Nom</label>
                    <input value={newBarber.name} onChange={e => setNewBarber(f => ({ ...f, name: e.target.value }))}
                      placeholder="Prénom" style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "160px" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Rôle</label>
                    <input value={newBarber.role} onChange={e => setNewBarber(f => ({ ...f, role: e.target.value }))}
                      placeholder="ex: Barbier" style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "160px" }} />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setAddingBarber(false); setNewBarber({ name: "", role: "", color: "#D4AF37" }); }}
                      style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#8B949E", padding: "10px 18px", cursor: "pointer", borderRadius: "8px", fontSize: "13px" }}>Annuler</button>
                    <button onClick={addBarber} disabled={!newBarber.name || saving}
                      style={{ background: newBarber.name ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#1A1A1A", color: newBarber.name ? "#080808" : "#444", border: "none", padding: "10px 22px", cursor: "pointer", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}>
                      {saving ? "..." : "Créer"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px", color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {barbers.map((barber) => {
              const isEditing = editingId === barber.id;
              const barberBlocks = blocks.filter(b => b.barber.toLowerCase() === barber.name.toLowerCase() && b.date >= todayStr());
              const barberOverrides = overrides.filter(o => o.barber.toLowerCase() === barber.name.toLowerCase() && o.date >= todayStr());

              return (
                <motion.div key={barber.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: "#161B22", border: `1px solid rgba(212,175,55,${isEditing ? "0.4" : "0.18"})`, borderRadius: "16px", padding: "28px", boxShadow: isEditing ? "0 0 30px rgba(212,175,55,0.08)" : "none" }}>

                  {/* Header barbier */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `linear-gradient(135deg, ${barber.color}33, ${barber.color}11)`, border: `1px solid ${barber.color}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>✂️</div>
                      <div>
                        <p style={{ color: "#F0F0F0", fontSize: "16px", letterSpacing: "1px" }}>{barber.name}</p>
                        <p style={{ color: "#7D8590", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>{barber.role || "Barbier"}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => setEditingId(null)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#8B949E", padding: "8px 16px", cursor: "pointer", borderRadius: "8px", fontSize: "12px" }}>Annuler</button>
                          <button onClick={saveBarber} disabled={saving} style={{ background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", border: "none", padding: "8px 20px", cursor: "pointer", borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}>{saving ? "..." : "Sauvegarder"}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(barber.id); setEditForm({ name: barber.name, role: barber.role, schedule: { ...barber.schedule }, color: barber.color }); }}
                            style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", color: "#D4AF37", padding: "8px 16px", cursor: "pointer", borderRadius: "8px", fontSize: "12px" }}>
                            ✏️ Modifier
                          </button>
                          <button onClick={() => deleteBarber(barber.id, barber.name)}
                            style={{ background: "rgba(238,85,85,0.06)", border: "1px solid rgba(238,85,85,0.15)", color: "#e55", padding: "8px 16px", cursor: "pointer", borderRadius: "8px", fontSize: "12px" }}>
                            🗑 Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Horaires */}
                  {isEditing ? (
                    <div style={{ marginBottom: "20px" }}>
                      <p style={{ color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>Modifier les horaires</p>
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Rôle</label>
                        <input value={editForm.role || ""} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                          style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", width: "200px" }} />
                      </div>
                      <ScheduleEditor schedule={editForm.schedule || {}} onChange={s => setEditForm(f => ({ ...f, schedule: s }))} />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                      {DAYS.map(({ key, label }) => {
                        const day = barber.schedule[key];
                        if (!day) return (
                          <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#555", fontSize: "12px" }}>{label}</span>
                            <span style={{ color: "#555", fontSize: "12px" }}>Fermé</span>
                          </div>
                        );
                        return (
                          <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "#777", fontSize: "12px" }}>{label}</span>
                            <span style={{ color: "#D4AF37", fontSize: "12px", fontWeight: 500 }}>{day.open} – {day.close}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Dates bloquées */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <p style={{ color: "#7D8590", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase" }}>
                        Dates bloquées ({barberBlocks.length})
                      </p>
                      <button onClick={() => { setAddingBlock(barber.id); setBlockForm({ date: "", reason: "" }); }}
                        style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#8B949E", padding: "5px 12px", cursor: "pointer", borderRadius: "6px", fontSize: "11px" }}>
                        + Bloquer une date
                      </button>
                    </div>

                    <AnimatePresence>
                      {addingBlock === barber.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: "hidden", marginBottom: "12px" }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                            <input type="date" min={todayStr()} value={blockForm.date} onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                              style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark" }} />
                            <input placeholder="Raison (optionnel)" value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                              style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", width: "200px" }} />
                            <button onClick={() => addBlock(barber.name)} disabled={!blockForm.date}
                              style={{ background: blockForm.date ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#1A1A1A", color: blockForm.date ? "#080808" : "#444", border: "none", padding: "8px 16px", cursor: "pointer", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>Bloquer</button>
                            <button onClick={() => setAddingBlock(null)}
                              style={{ background: "none", border: "1px solid rgba(255,255,255,0.06)", color: "#7D8590", padding: "8px 12px", cursor: "pointer", borderRadius: "6px", fontSize: "12px" }}>✕</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {barberBlocks.length === 0 ? (
                      <p style={{ color: "#555", fontSize: "12px" }}>Aucune date bloquée à venir</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {barberBlocks.map(block => (
                          <div key={block.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0A0A0A", border: "1px solid rgba(238,85,85,0.12)", borderRadius: "8px", padding: "10px 16px" }}>
                            <span style={{ color: "#AAA", fontSize: "13px", textTransform: "capitalize" }}>
                              {formatDate(block.date)}{block.reason ? ` · ${block.reason}` : ""}
                            </span>
                            <button onClick={() => removeBlock(block.id)}
                              style={{ background: "none", border: "none", color: "#e55", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Disponibilités exceptionnelles */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "20px", marginTop: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <p style={{ color: "#7D8590", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase" }}>
                        Dispo exceptionnelle ({barberOverrides.length})
                      </p>
                      <button onClick={() => { setAddingOverride(barber.id); setOverrideForm({ date: "", open: "09:00", close: "17:00" }); }}
                        style={{ background: "none", border: "1px solid rgba(212,175,55,0.2)", color: "#D4AF37", padding: "5px 12px", cursor: "pointer", borderRadius: "6px", fontSize: "11px" }}>
                        + Débloquer une journée
                      </button>
                    </div>

                    <AnimatePresence>
                      {addingOverride === barber.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: "hidden", marginBottom: "12px" }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                            <input type="date" min={todayStr()} value={overrideForm.date} onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))}
                              style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark" }} />
                            <input type="time" value={overrideForm.open} onChange={e => setOverrideForm(f => ({ ...f, open: e.target.value }))}
                              style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark" }} />
                            <span style={{ color: "#7D8590", fontSize: "12px", alignSelf: "center" }}>–</span>
                            <input type="time" value={overrideForm.close} onChange={e => setOverrideForm(f => ({ ...f, close: e.target.value }))}
                              style={{ background: "#1C2129", border: "1px solid rgba(212,175,55,0.2)", color: "#F0F0F0", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark" }} />
                            <button onClick={() => addOverride(barber.name)} disabled={!overrideForm.date}
                              style={{ background: overrideForm.date ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#1A1A1A", color: overrideForm.date ? "#080808" : "#444", border: "none", padding: "8px 16px", cursor: "pointer", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>Débloquer</button>
                            <button onClick={() => setAddingOverride(null)}
                              style={{ background: "none", border: "1px solid rgba(255,255,255,0.06)", color: "#7D8590", padding: "8px 12px", cursor: "pointer", borderRadius: "6px", fontSize: "12px" }}>✕</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {barberOverrides.length === 0 ? (
                      <p style={{ color: "#555", fontSize: "12px" }}>Aucune disponibilité exceptionnelle à venir</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {barberOverrides.map(ov => (
                          <div key={ov.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0A0A0A", border: "1px solid rgba(212,175,55,0.15)", borderRadius: "8px", padding: "10px 16px" }}>
                            <span style={{ color: "#D4AF37", fontSize: "13px", textTransform: "capitalize" }}>
                              {formatDate(ov.date)} · {ov.open.slice(0,5)}–{ov.close.slice(0,5)}
                            </span>
                            <button onClick={() => removeOverride(ov.id)}
                              style={{ background: "none", border: "none", color: "#e55", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
