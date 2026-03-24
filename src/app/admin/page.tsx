"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminPage() {
  const [data, setData] = useState<string>("Chargement...");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(d => setData(`${Array.isArray(d) ? d.length : 0} réservations trouvées`))
      .catch(e => setError(e.message));
  }, []);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        <h1 style={{ color: "#D4AF37", fontSize: "28px", marginBottom: "20px" }}>Dashboard Admin</h1>
        {error ? (
          <p style={{ color: "#e55" }}>Erreur: {error}</p>
        ) : (
          <p style={{ color: "#F0F0F0" }}>{data}</p>
        )}
        <div style={{ marginTop: "20px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link href="/admin/agenda" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Agenda</Link>
          <Link href="/admin/horaires" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Horaires</Link>
          <Link href="/admin/paye" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Paye</Link>
          <Link href="/admin/comptabilite" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Comptabilité</Link>
          <Link href="/admin/social" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Réseaux Sociaux</Link>
          <Link href="/admin/portfolio" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Portfolio</Link>
          <Link href="/admin/bot" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Bot IA</Link>
          <Link href="/admin/clients" style={{ color: "#D4AF37", textDecoration: "none", padding: "12px 20px", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px" }}>Clients</Link>
        </div>
      </main>
    </div>
  );
}
