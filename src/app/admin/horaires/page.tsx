"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar from "@/components/AdminSidebar";

type Block = {
  id: string;
  barber: string;
  date: string;
  reason: string | null;
  created_at: string;
};

const MONTHS_FR = ["jan","fév","mars","avr","mai","juin","juil","août","sep","oct","nov","déc"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function HorairesPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/blocks?barber=diodis")
      .then(r => r.json())
      .then(data => { setBlocks(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!form.date) return;
    setSaving(true);
    const res = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barber: "diodis", date: form.date, reason: form.reason || null }),
    });
    const data = await res.json();
    if (!data.error) {
      setBlocks(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setForm({ date: "", reason: "" });
      setAdding(false);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Retirer ce blocage ?")) return;
    await fetch("/api/admin/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBlocks(prev => prev.filter(b => b.id !== id));
  }

  const upcoming = blocks.filter(b => b.date >= todayStr());
  const past = blocks.filter(b => b.date < todayStr());

  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />

      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: "36px" }}
        >
          <h1 style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "2px", color: "#F0F0F0", marginBottom: "6px" }}>
            Horaires
          </h1>
          <p style={{ color: "#555", fontSize: "13px", letterSpacing: "1px" }}>
            Gérez la disponibilité de Diodis
          </p>
        </motion.div>

        {/* Schedule info cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "36px" }}
        >
          {/* Horaire normal Melynda */}
          <div style={{
            background: "#0D0D0D",
            border: "1px solid rgba(212,175,55,0.12)",
            borderRadius: "14px",
            padding: "24px 28px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(184,134,11,0.1))",
                border: "1px solid rgba(212,175,55,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <p style={{ color: "#F0F0F0", fontSize: "14px", letterSpacing: "1px" }}>Melynda</p>
                <p style={{ color: "#555", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>Co-fondatrice</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { day: "Mar · Mer · Sam", hours: "8h30 – 16h30" },
                { day: "Jeu · Ven", hours: "8h30 – 20h30" },
              ].map(({ day, hours }) => (
                <div key={day} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#777", fontSize: "12px" }}>{day}</span>
                  <span style={{ color: "#D4AF37", fontSize: "12px", fontWeight: 500 }}>{hours}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#444", fontSize: "12px" }}>Dim · Lun</span>
                <span style={{ color: "#444", fontSize: "12px" }}>Fermé</span>
              </div>
            </div>
          </div>

          {/* Horaire Diodis */}
          <div style={{
            background: "#0D0D0D",
            border: "1px solid rgba(212,175,55,0.25)",
            borderRadius: "14px",
            padding: "24px 28px",
            boxShadow: "0 0 30px rgba(212,175,55,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(212,175,55,0.3), rgba(184,134,11,0.2))",
                border: "1px solid rgba(212,175,55,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <p style={{ color: "#F0F0F0", fontSize: "14px", letterSpacing: "1px" }}>Diodis</p>
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>Horaire modifiable</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#777", fontSize: "12px" }}>Vendredi</span>
                <span style={{ color: "#D4AF37", fontSize: "12px", fontWeight: 500 }}>15h00 – 20h30</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#777", fontSize: "12px" }}>Samedi</span>
                <span style={{ color: "#D4AF37", fontSize: "12px", fontWeight: 500 }}>9h00 – 16h30</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#444", fontSize: "12px" }}>Autres jours</span>
                <span style={{ color: "#444", fontSize: "12px" }}>Non disponible</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dates bloquées */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Header + Add button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 400, color: "#F0F0F0", letterSpacing: "2px", marginBottom: "4px" }}>
                Dates bloquées — Diodis
              </h2>
              <p style={{ color: "#555", fontSize: "12px" }}>
                {upcoming.length} date{upcoming.length !== 1 ? "s" : ""} à venir bloquée{upcoming.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => setAdding(true)}
              style={{
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                color: "#080808",
                border: "none",
                padding: "10px 22px",
                fontSize: "11px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: "8px",
                transition: "all 0.3s",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(212,175,55,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
            >
              + Bloquer une date
            </button>
          </div>

          {/* Add form */}
          <AnimatePresence>
            {adding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                style={{ overflow: "hidden", marginBottom: "20px" }}
              >
                <div style={{
                  background: "#0D0D0D",
                  border: "1px solid rgba(212,175,55,0.3)",
                  borderRadius: "14px",
                  padding: "28px",
                  boxShadow: "0 0 30px rgba(212,175,55,0.08)",
                }}>
                  <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px", fontWeight: 500 }}>
                    Bloquer une journée pour Diodis
                  </p>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "1", minWidth: "160px" }}>
                      <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
                        Date
                      </label>
                      <input
                        type="date"
                        value={form.date}
                        min={todayStr()}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        style={{
                          background: "#111",
                          border: "1px solid rgba(212,175,55,0.2)",
                          color: "#F0F0F0",
                          padding: "12px 16px",
                          fontSize: "14px",
                          borderRadius: "8px",
                          outline: "none",
                          width: "100%",
                          colorScheme: "dark",
                        }}
                      />
                    </div>
                    <div style={{ flex: "2", minWidth: "200px" }}>
                      <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
                        Raison (optionnel)
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Congé, Maladie, Formation..."
                        value={form.reason}
                        onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                        style={{
                          background: "#111",
                          border: "1px solid rgba(212,175,55,0.2)",
                          color: "#F0F0F0",
                          padding: "12px 16px",
                          fontSize: "14px",
                          borderRadius: "8px",
                          outline: "none",
                          width: "100%",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => { setAdding(false); setForm({ date: "", reason: "" }); }}
                        style={{
                          background: "none",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#666",
                          padding: "12px 20px",
                          cursor: "pointer",
                          fontSize: "13px",
                          borderRadius: "8px",
                          transition: "all 0.2s",
                        }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleAdd}
                        disabled={!form.date || saving}
                        style={{
                          background: form.date ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#1A1A1A",
                          color: form.date ? "#080808" : "#444",
                          border: "none",
                          padding: "12px 24px",
                          cursor: form.date ? "pointer" : "default",
                          fontSize: "13px",
                          fontWeight: 600,
                          borderRadius: "8px",
                          transition: "all 0.2s",
                        }}
                      >
                        {saving ? "..." : "Bloquer"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Blocks list */}
          {loading ? (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ textAlign: "center", padding: "60px 20px" }}
            >
              <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</p>
            </motion.div>
          ) : upcoming.length === 0 && !adding ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "#0D0D0D",
                border: "1px solid rgba(212,175,55,0.06)",
                borderRadius: "14px",
              }}
            >
              <p style={{ color: "#444", fontSize: "14px", marginBottom: "8px" }}>Aucune date bloquée</p>
              <p style={{ color: "#333", fontSize: "12px" }}>Diodis est disponible tous ses vendredis et samedis habituels.</p>
            </motion.div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <AnimatePresence>
                {upcoming.map((block, i) => (
                  <motion.div
                    key={block.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onMouseEnter={() => setHoveredId(block.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      background: hoveredId === block.id ? "#0F0F0F" : "#0D0D0D",
                      border: "1px solid rgba(238,85,85,0.15)",
                      borderRadius: "10px",
                      padding: "18px 24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      transition: "all 0.2s ease",
                      boxShadow: hoveredId === block.id ? "0 4px 20px rgba(0,0,0,0.3)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{
                        background: "rgba(238,85,85,0.08)",
                        border: "1px solid rgba(238,85,85,0.2)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        minWidth: "44px",
                        textAlign: "center",
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <line x1="10" y1="15" x2="14" y2="19" />
                          <line x1="14" y1="15" x2="10" y2="19" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ color: "#F0F0F0", fontSize: "14px", marginBottom: "3px", textTransform: "capitalize" }}>
                          {formatDate(block.date)}
                        </p>
                        <p style={{ color: "#555", fontSize: "12px" }}>
                          Diodis{block.reason ? ` · ${block.reason}` : " · Non disponible"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(block.id)}
                      style={{
                        background: "rgba(238,85,85,0.06)",
                        border: "1px solid rgba(238,85,85,0.15)",
                        color: "#e55",
                        padding: "6px 14px",
                        fontSize: "11px",
                        cursor: "pointer",
                        borderRadius: "6px",
                        transition: "all 0.2s ease",
                        letterSpacing: "0.5px",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(238,85,85,0.15)";
                        e.currentTarget.style.borderColor = "rgba(238,85,85,0.4)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(238,85,85,0.06)";
                        e.currentTarget.style.borderColor = "rgba(238,85,85,0.15)";
                      }}
                    >
                      ✕ Retirer
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Past blocks */}
          {past.length > 0 && (
            <div style={{ marginTop: "36px" }}>
              <p style={{ color: "#444", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>
                Historique
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {past.slice(-5).reverse().map(block => (
                  <div
                    key={block.id}
                    style={{
                      background: "#0A0A0A",
                      border: "1px solid rgba(255,255,255,0.04)",
                      borderRadius: "8px",
                      padding: "14px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p style={{ color: "#444", fontSize: "13px", textTransform: "capitalize" }}>
                      {formatDate(block.date)}{block.reason ? ` · ${block.reason}` : ""}
                    </p>
                    <span style={{ color: "#333", fontSize: "11px", letterSpacing: "1px" }}>Passé</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
