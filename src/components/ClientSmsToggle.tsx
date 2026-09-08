"use client";
import { useState } from "react";

/**
 * Badge + bouton pour retirer / réinscrire un client de la liste SMS,
 * utilisé dans le tableau de /admin/clients.
 *
 * Bloquer  → POST   /api/admin/sms-optout  (ajoute à sms_blacklist, source 'admin')
 * Réactiver → DELETE /api/admin/sms-optout  (retire la ligne — le client reste en base)
 */
export default function ClientSmsToggle({
  phone,
  blocked,
  onChange,
}: {
  phone: string;
  blocked: boolean;
  onChange: (phone: string, blocked: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!phone) return <span style={{ color: "#444", fontSize: "12px" }}>—</span>;

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sms-optout", {
        method: blocked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) onChange(phone, !blocked);
      else alert("Action impossible — réessaie.");
    } catch {
      alert("Erreur réseau — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", whiteSpace: "nowrap" }}>
      <span
        style={{
          fontSize: "11px",
          letterSpacing: "1px",
          color: blocked ? "#E56A6A" : "#4Fae82",
        }}
      >
        {blocked ? "● Bloqué" : "● Reçoit"}
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        style={{
          background: "transparent",
          border: `1px solid ${blocked ? "rgba(79,174,130,0.4)" : "rgba(229,106,106,0.4)"}`,
          color: blocked ? "#4Fae82" : "#E56A6A",
          padding: "5px 12px",
          fontSize: "10px",
          letterSpacing: "1px",
          textTransform: "uppercase",
          cursor: busy ? "default" : "pointer",
          borderRadius: "3px",
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? "…" : blocked ? "Réactiver" : "Bloquer"}
      </button>
    </div>
  );
}
