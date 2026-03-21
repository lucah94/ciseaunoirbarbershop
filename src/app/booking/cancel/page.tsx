"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function CancelContent() {
  const params = useSearchParams();
  const id = params.get("id");
  const [booking, setBooking] = useState<{ client_name: string; service: string; barber: string; date: string; time: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    fetch(`/api/bookings?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setBooking(data);
        else setError("Réservation introuvable.");
        setLoading(false);
      });
  }, [id]);

  async function handleCancel() {
    if (!id) return;
    const now = new Date();
    if (booking) {
      const rdv = new Date(`${booking.date}T${booking.time.padStart(5, "0")}:00`);
      const diffMs = rdv.getTime() - now.getTime();
      if (diffMs < 60 * 60 * 1000) {
        setError("Impossible d'annuler moins d'1 heure avant le rendez-vous. Appelez-nous au (418) 665-5703.");
        return;
      }
    }
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "cancelled" }),
    });
    if (res.ok) setCancelled(true);
    else setError("Erreur lors de l'annulation. Appelez-nous au (418) 665-5703.");
  }

  const dateFormatted = booking ? new Date(booking.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }) : "";

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", paddingTop: "120px", paddingBottom: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: "480px", width: "100%", padding: "0 20px", textAlign: "center" }}>
        <p style={{ color: "#C9A84C", letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Ciseau Noir</p>
        <h1 style={{ fontSize: "28px", fontWeight: 300, letterSpacing: "4px", color: "#F5F5F5", marginBottom: "32px" }}>Annulation</h1>

        {loading && <p style={{ color: "#444" }}>Chargement...</p>}

        {!loading && error && (
          <div style={{ background: "#111", border: "1px solid #3a1a1a", padding: "32px" }}>
            <p style={{ color: "#e55", fontSize: "15px", marginBottom: "16px" }}>{error}</p>
            <a href="/" style={{ color: "#C9A84C", fontSize: "13px" }}>Retour à l'accueil</a>
          </div>
        )}

        {!loading && cancelled && (
          <div style={{ background: "#111", border: "1px solid #C9A84C", padding: "40px" }}>
            <p style={{ color: "#C9A84C", fontSize: "40px", marginBottom: "16px" }}>✓</p>
            <p style={{ color: "#F5F5F5", fontSize: "16px", letterSpacing: "2px", marginBottom: "8px" }}>Rendez-vous annulé</p>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "24px" }}>Votre réservation a été annulée avec succès.</p>
            <a href="/booking" className="btn-gold" style={{ fontSize: "11px", padding: "12px 28px" }}>Réserver à nouveau</a>
          </div>
        )}

        {!loading && !error && !cancelled && booking && (
          <div>
            {booking.status === "cancelled" ? (
              <p style={{ color: "#666", fontSize: "15px" }}>Ce rendez-vous est déjà annulé.</p>
            ) : (
              <>
                <div style={{ background: "#111", border: "1px solid #222", padding: "28px", marginBottom: "24px", textAlign: "left" }}>
                  <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Votre rendez-vous</p>
                  <p style={{ color: "#F5F5F5", marginBottom: "8px" }}>{booking.client_name}</p>
                  <p style={{ color: "#999", fontSize: "14px", marginBottom: "4px" }}>{booking.service} avec {booking.barber}</p>
                  <p style={{ color: "#999", fontSize: "14px" }}>{dateFormatted} à {booking.time}</p>
                </div>
                <p style={{ color: "#666", fontSize: "13px", marginBottom: "24px" }}>Êtes-vous sûr de vouloir annuler ce rendez-vous ?</p>
                <button onClick={handleCancel} style={{ background: "#1a0a0a", border: "1px solid #e55", color: "#e55", padding: "14px 32px", cursor: "pointer", fontSize: "13px", letterSpacing: "1px", width: "100%" }}>
                  Confirmer l'annulation
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function CancelPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<main style={{ minHeight: "100vh", background: "#0A0A0A" }} />}>
        <CancelContent />
      </Suspense>
      <Footer />
    </>
  );
}
