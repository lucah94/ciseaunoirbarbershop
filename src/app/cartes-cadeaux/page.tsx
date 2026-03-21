"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const AMOUNTS = [30, 50, 75, 100];

export default function CartesCadeauxPage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [form, setForm] = useState({
    buyer_name: "",
    buyer_email: "",
    recipient_name: "",
    recipient_email: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const finalAmount = isCustom ? parseInt(customAmount) || 0 : selectedAmount || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalAmount || finalAmount < 10) {
      setError("Veuillez choisir un montant (minimum 10$).");
      return;
    }
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalAmount,
          ...form,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <>
        <style>{`
          @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        `}</style>
        <Navbar />
        <main style={{ minHeight: "100vh", background: "#080808", paddingTop: "120px", paddingBottom: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ textAlign: "center", padding: "0 20px", maxWidth: "520px" }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 28px",
                fontSize: "36px",
                color: "#080808",
                boxShadow: "0 0 40px rgba(212,175,55,0.4)",
              }}
            >
              &#127873;
            </motion.div>
            <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Demande enregistrée</p>
            <h1 style={{
              fontSize: "32px",
              fontWeight: 300,
              letterSpacing: "4px",
              marginBottom: "24px",
              background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s linear infinite",
            }}>Merci !</h1>
            <div style={{
              background: "#0D0D0D",
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: "16px",
              padding: "36px",
              margin: "0 auto 32px",
              textAlign: "center",
            }}>
              <p style={{ color: "#F0F0F0", fontSize: "16px", marginBottom: "16px", lineHeight: 1.7 }}>
                Votre demande de carte cadeau de <span style={{ color: "#D4AF37", fontWeight: 500 }}>{finalAmount}$</span> a bien été enregistrée.
              </p>
              <div style={{ height: "1px", background: "rgba(212,175,55,0.15)", margin: "20px 0" }} />
              <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Pour compléter l'achat</p>
              <p style={{ color: "#999", fontSize: "15px", lineHeight: 1.7 }}>
                Contactez-nous au<br />
                <a href="tel:4186655703" style={{ color: "#D4AF37", textDecoration: "none", fontSize: "18px", letterSpacing: "1px", fontWeight: 500 }}>(418) 665-5703</a>
              </p>
            </div>
            <a href="/" style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #D4AF37, #B8860B)",
              color: "#080808",
              fontSize: "12px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "14px 36px",
              borderRadius: "4px",
              textDecoration: "none",
              transition: "all 0.4s",
            }}>Retour à l'accueil</a>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(212,175,55,0.1); }
          50% { box-shadow: 0 0 40px rgba(212,175,55,0.25); }
        }
        .gc-amount-card {
          background: #0D0D0D;
          border: 2px solid rgba(212,175,55,0.12);
          border-radius: 16px;
          padding: 32px 24px;
          cursor: pointer;
          text-align: center;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          position: relative;
          overflow: hidden;
        }
        .gc-amount-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(212,175,55,0.06), transparent 70%);
          opacity: 0;
          transition: opacity 0.4s;
        }
        .gc-amount-card:hover {
          border-color: rgba(212,175,55,0.5);
          transform: translateY(-6px);
          box-shadow: 0 20px 60px rgba(212,175,55,0.15);
        }
        .gc-amount-card:hover::before {
          opacity: 1;
        }
        .gc-amount-card.selected {
          border-color: #D4AF37;
          animation: cardGlow 2s ease-in-out infinite;
        }
        .gc-input {
          background: #0D0D0D;
          border: 1px solid rgba(255,255,255,0.1);
          color: #F0F0F0;
          padding: 16px 18px;
          font-size: 15px;
          width: 100%;
          outline: none;
          border-radius: 10px;
          transition: all 0.3s;
          box-sizing: border-box;
        }
        .gc-input:focus {
          border-color: rgba(212,175,55,0.6);
          box-shadow: 0 0 20px rgba(212,175,55,0.15), 0 0 0 1px rgba(212,175,55,0.2);
        }
        .gc-input::placeholder {
          color: #444;
        }
      `}</style>
      <Navbar />
      <main style={{ minHeight: "100vh", background: "#080808", paddingTop: "120px", paddingBottom: "80px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 20px" }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: "center", marginBottom: "56px" }}
          >
            <p style={{ color: "#D4AF37", letterSpacing: "6px", fontSize: "11px", textTransform: "uppercase", marginBottom: "16px" }}>L'art du cadeau</p>
            <h1 style={{
              fontSize: "40px",
              fontWeight: 300,
              letterSpacing: "5px",
              marginBottom: "16px",
              background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s linear infinite",
            }}>CARTES CADEAUX</h1>
            <p style={{ color: "#666", fontSize: "15px", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7 }}>
              Offrez une expérience barbier d'exception à vos proches. Chaque carte est personnalisée avec soin.
            </p>
          </motion.div>

          {/* Amount selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p style={{ color: "#D4AF37", letterSpacing: "3px", fontSize: "11px", textTransform: "uppercase", marginBottom: "20px" }}>Choisissez un montant</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              {AMOUNTS.map((amount) => (
                <div
                  key={amount}
                  className={`gc-amount-card ${!isCustom && selectedAmount === amount ? "selected" : ""}`}
                  onClick={() => { setSelectedAmount(amount); setIsCustom(false); }}
                >
                  <p style={{ color: !isCustom && selectedAmount === amount ? "#D4AF37" : "#F0F0F0", fontSize: "28px", fontWeight: 300, letterSpacing: "2px", marginBottom: "4px", position: "relative" }}>
                    {amount}$
                  </p>
                  <p style={{ color: "#555", fontSize: "11px", letterSpacing: "1px", position: "relative" }}>Carte cadeau</p>
                </div>
              ))}
            </div>

            {/* Custom amount */}
            <div
              className={`gc-amount-card ${isCustom ? "selected" : ""}`}
              onClick={() => setIsCustom(true)}
              style={{ marginBottom: "40px" }}
            >
              <p style={{ color: isCustom ? "#D4AF37" : "#999", fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px", position: "relative" }}>Montant personnalisé</p>
              {isCustom && (
                <input
                  type="number"
                  min="10"
                  max="500"
                  placeholder="Ex: 60"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="gc-input"
                  style={{ maxWidth: "200px", textAlign: "center", fontSize: "20px", margin: "0 auto" }}
                />
              )}
            </div>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Buyer info */}
            <p style={{ color: "#D4AF37", letterSpacing: "3px", fontSize: "11px", textTransform: "uppercase", marginBottom: "20px" }}>Vos informations</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
              <input
                className="gc-input"
                placeholder="Votre nom"
                required
                value={form.buyer_name}
                onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
              />
              <input
                className="gc-input"
                type="email"
                placeholder="Votre courriel"
                required
                value={form.buyer_email}
                onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
              />
            </div>

            {/* Recipient info */}
            <p style={{ color: "#D4AF37", letterSpacing: "3px", fontSize: "11px", textTransform: "uppercase", marginBottom: "20px" }}>Destinataire</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <input
                className="gc-input"
                placeholder="Nom du destinataire"
                required
                value={form.recipient_name}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
              />
              <input
                className="gc-input"
                type="email"
                placeholder="Courriel du destinataire"
                required
                value={form.recipient_email}
                onChange={(e) => setForm({ ...form, recipient_email: e.target.value })}
              />
            </div>
            <textarea
              className="gc-input"
              placeholder="Message personnel (optionnel)"
              rows={3}
              style={{ resize: "vertical", fontFamily: "inherit", marginBottom: "32px" }}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />

            {/* Error */}
            {error && (
              <p style={{ color: "#e55", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>{error}</p>
            )}

            {/* Submit */}
            <div style={{ textAlign: "center" }}>
              <button
                type="submit"
                disabled={sending || !finalAmount}
                style={{
                  background: finalAmount ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#222",
                  color: finalAmount ? "#080808" : "#555",
                  border: "none",
                  padding: "16px 48px",
                  fontSize: "13px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  cursor: finalAmount ? "pointer" : "not-allowed",
                  borderRadius: "4px",
                  transition: "all 0.4s",
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? "Envoi en cours..." : `Offrir une carte de ${finalAmount || "..."}$`}
              </button>
              <p style={{ color: "#555", fontSize: "12px", marginTop: "16px", lineHeight: 1.6 }}>
                Le paiement se fait par téléphone au (418) 665-5703
              </p>
            </div>
          </motion.form>
        </div>
      </main>
      <Footer />
    </>
  );
}
