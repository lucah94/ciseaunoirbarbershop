"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(d => setCount(Array.isArray(d) ? d.length : 0))
      .catch(() => setCount(-1));
  }, []);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", padding: "40px", color: "#F0F0F0" }}>
      <h1 style={{ color: "#D4AF37" }}>Admin Dashboard</h1>
      <p>{count === null ? "Chargement..." : count === -1 ? "Erreur DB" : `${count} reservations`}</p>
      <a href="/admin/agenda" style={{ color: "#D4AF37" }}>Agenda</a>
    </div>
  );
}
