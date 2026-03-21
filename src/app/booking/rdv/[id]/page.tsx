"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

type Booking = {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  barber: string;
  service: string;
  price: number;
  date: string;
  time: string;
  status: string;
  note: string;
};

const BARBER_ID: Record<string, string> = {
  melynda: "melynda",
  diodis: "diodis",
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function isPast(dateStr: string, timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const dt = new Date(dateStr + "T12:00:00");
  dt.setHours(h, m, 0, 0);
  return dt < new Date();
}

export default function MonRdvPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.id) setBooking(data);
        else setNotFound(true);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  async function handleCancel() {
    setCancelling(true);
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "cancelled" }),
    });
    setCancelled(true);
    setCancelling(false);
    setConfirmCancel(false);
    if (booking) setBooking({ ...booking, status: "cancelled" });
  }

  const barberKey = booking ? BARBER_ID[booking.barber.toLowerCase()] || "melynda" : "melynda";
  const past = booking ? isPast(booking.date, booking.time) : false;

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
      `}</style>
      <Navbar />
      <main style={{ minHeight: "100vh", background: "#080808", paddingTop: "100px", paddingBottom: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "520px", padding: "0 20px" }}>

          {loading && (
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</p>
            </motion.div>
          )}

          {notFound && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center" }}>
              <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "11px", textTransform: "uppercase", marginBottom: "16px" }}>Ciseau Noir</p>
              <h1 style={{ color: "#F0F0F0", fontSize: "28px", fontWeight: 300, letterSpacing: "3px", marginBottom: "16px" }}>Rendez-vous introuvable</h1>
              <p style={{ color: "#555", fontSize: "14px", marginBottom: "40px" }}>Ce lien est invalide ou le rendez-vous n'existe plus.</p>
              <Link href="/booking" style={{ display: "inline-block", background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, padding: "14px 36px", borderRadius: "4px", textDecoration: "none" }}>
                Nouvelle réservation
              </Link>
            </motion.div>
          )}

          {booking && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: "36px" }}>
                <p style={{ color: "#D4AF37", letterSpacing: "6px", fontSize: "11px", textTransform: "uppercase", marginBottom: "12px", fontWeight: 500 }}>Ciseau Noir</p>
                <h1 style={{
                  fontSize: "clamp(28px, 5vw, 40px)",
                  fontWeight: 300,
                  letterSpacing: "6px",
                  textTransform: "uppercase",
                  background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: "shimmer 3s linear infinite",
                  marginBottom: "12px",
                }}>Mon Rendez-vous</h1>
                <div style={{ width: "60px", height: "2px", background: "linear-gradient(90deg, transparent, #D4AF37, transparent)", margin: "0 auto" }} />
              </div>

              {/* Status badge */}
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                {booking.status === "confirmed" && !past && (
                  <span style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "6px 20px", borderRadius: "20px" }}>
                    Confirmé
                  </span>
                )}
                {booking.status === "confirmed" && past && (
                  <span style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "6px 20px", borderRadius: "20px" }}>
                    Passé
                  </span>
                )}
                {booking.status === "completed" && (
                  <span style={{ background: "rgba(85,170,85,0.08)", border: "1px solid rgba(85,170,85,0.25)", color: "#5a5", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "6px 20px", borderRadius: "20px" }}>
                    Complété
                  </span>
                )}
                {(booking.status === "cancelled" || cancelled) && (
                  <span style={{ background: "rgba(238,85,85,0.08)", border: "1px solid rgba(238,85,85,0.25)", color: "#e55", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", padding: "6px 20px", borderRadius: "20px" }}>
                    Annulé
                  </span>
                )}
              </div>

              {/* Booking card */}
              <div style={{
                background: "#0D0D0D",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: "20px",
                padding: "36px",
                marginBottom: "28px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    { label: "Client", value: booking.client_name },
                    { label: "Service", value: `${booking.service} — ${booking.price}$` },
                    { label: "Barbière", value: booking.barber },
                    { label: "Date", value: formatDate(booking.date), capitalize: true },
                    { label: "Heure", value: booking.time },
                  ].map(({ label, value, capitalize }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                      <span style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", flexShrink: 0, paddingTop: "2px" }}>{label}</span>
                      <span style={{ color: "#F0F0F0", fontSize: "14px", textAlign: "right", textTransform: capitalize ? "capitalize" : "none" }}>{value}</span>
                    </div>
                  ))}
                  {booking.note && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                      <span style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", flexShrink: 0, paddingTop: "2px" }}>Note</span>
                      <span style={{ color: "#888", fontSize: "13px", textAlign: "right", fontStyle: "italic" }}>{booking.note}</span>
                    </div>
                  )}
                </div>

                <div style={{ height: "1px", background: "rgba(212,175,55,0.1)", margin: "24px 0" }} />
                <p style={{ color: "#555", fontSize: "12px", textAlign: "center" }}>
                  📍 375 Boul. des Chutes, Québec · (418) 665-5703
                </p>
              </div>

              {/* Actions */}
              {booking.status === "confirmed" && !past && !cancelled && (
                <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
                  {/* Reschedule */}
                  <Link
                    href={`/booking?barber=${barberKey}`}
                    style={{
                      display: "block",
                      background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                      color: "#080808",
                      fontSize: "12px",
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      padding: "16px",
                      borderRadius: "8px",
                      textDecoration: "none",
                      textAlign: "center",
                      transition: "all 0.3s",
                    }}
                  >
                    Modifier / Reprendre un RDV
                  </Link>

                  {/* Cancel */}
                  {!confirmCancel ? (
                    <button
                      onClick={() => setConfirmCancel(true)}
                      style={{
                        background: "none",
                        border: "1px solid rgba(238,85,85,0.2)",
                        color: "#e55",
                        fontSize: "12px",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        padding: "14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.3s",
                        width: "100%",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(238,85,85,0.06)"; e.currentTarget.style.borderColor = "rgba(238,85,85,0.4)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "rgba(238,85,85,0.2)"; }}
                    >
                      Annuler mon rendez-vous
                    </button>
                  ) : (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          background: "rgba(238,85,85,0.06)",
                          border: "1px solid rgba(238,85,85,0.2)",
                          borderRadius: "10px",
                          padding: "20px",
                          textAlign: "center",
                        }}
                      >
                        <p style={{ color: "#F0F0F0", fontSize: "14px", marginBottom: "6px", fontWeight: 400 }}>Confirmer l'annulation ?</p>
                        <p style={{ color: "#555", fontSize: "12px", marginBottom: "20px" }}>Cette action est irréversible.</p>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            onClick={() => setConfirmCancel(false)}
                            style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#666", padding: "12px", cursor: "pointer", fontSize: "13px", borderRadius: "6px", transition: "all 0.2s" }}
                          >
                            Retour
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={cancelling}
                            style={{ flex: 2, background: "rgba(238,85,85,0.15)", border: "1px solid rgba(238,85,85,0.4)", color: "#e55", padding: "12px", cursor: "pointer", fontSize: "12px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", borderRadius: "6px", transition: "all 0.2s" }}
                          >
                            {cancelling ? "..." : "Oui, annuler"}
                          </button>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              )}

              {/* Cancelled confirmation */}
              {cancelled && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", padding: "20px 0" }}>
                  <p style={{ color: "#555", fontSize: "14px", marginBottom: "28px" }}>Votre rendez-vous a été annulé. Vous recevrez une confirmation par courriel.</p>
                  <Link href="/booking" style={{ display: "inline-block", background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, padding: "14px 36px", borderRadius: "4px", textDecoration: "none" }}>
                    Reprendre un RDV
                  </Link>
                </motion.div>
              )}

              {/* Past / completed — rebook CTA */}
              {(past || booking.status === "completed") && booking.status !== "cancelled" && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#555", fontSize: "13px", marginBottom: "24px" }}>Prêt pour la prochaine coupe ?</p>
                  <Link href={`/booking?barber=${barberKey}`} style={{ display: "inline-block", background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 700, padding: "14px 36px", borderRadius: "4px", textDecoration: "none" }}>
                    Reprendre un RDV avec {booking.barber}
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
