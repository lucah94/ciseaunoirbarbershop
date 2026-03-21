import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "La page que vous recherchez n'existe pas ou a été déplacée.",
};

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main style={{ background: "#080808", minHeight: "100vh" }}>
        <section style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          textAlign: "center",
          padding: "40px 20px",
          background: "radial-gradient(ellipse at top, rgba(212,175,55,0.06) 0%, #080808 70%)",
        }}>
          <p style={{
            color: "#D4AF37",
            letterSpacing: "8px",
            fontSize: "11px",
            textTransform: "uppercase",
            marginBottom: "20px",
            fontWeight: 500,
          }}>Ciseau Noir</p>

          <h1 style={{
            fontSize: "clamp(80px, 15vw, 160px)",
            fontWeight: 200,
            letterSpacing: "10px",
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1,
            marginBottom: "20px",
          }}>404</h1>

          <h2 style={{
            fontSize: "28px",
            fontWeight: 300,
            letterSpacing: "6px",
            textTransform: "uppercase",
            color: "#F0F0F0",
            marginBottom: "16px",
          }}>Page introuvable</h2>

          <div style={{
            width: "80px",
            height: "2px",
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "0 auto 28px",
          }} />

          <p style={{
            color: "#888",
            fontSize: "16px",
            maxWidth: "460px",
            lineHeight: 1.8,
            marginBottom: "48px",
            letterSpacing: "0.5px",
          }}>
            La page que vous recherchez n&apos;existe pas ou a été déplacée.
          </p>

          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #D4AF37, #B8860B)",
              color: "#080808",
              fontSize: "12px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "16px 40px",
              borderRadius: "4px",
              textDecoration: "none",
            }}
          >
            Retour à l&apos;accueil
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
