"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={{ background: "#080808", minHeight: "100vh" }}>
      <section style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
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

        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          border: "2px solid rgba(212,175,55,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
        }}>
          <span style={{ fontSize: "28px", color: "#D4AF37" }}>!</span>
        </div>

        <h1 style={{
          fontSize: "32px",
          fontWeight: 300,
          letterSpacing: "6px",
          textTransform: "uppercase",
          color: "#F0F0F0",
          marginBottom: "16px",
        }}>Une erreur est survenue</h1>

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
          marginBottom: "24px",
          letterSpacing: "0.5px",
        }}>
          Quelque chose s&apos;est mal passé. Veuillez réessayer ou revenir à la page d&apos;accueil.
        </p>
        <pre style={{
          color: "#e55",
          fontSize: "12px",
          maxWidth: "600px",
          background: "#111",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "48px",
          overflow: "auto",
          textAlign: "left",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}>
          {error.message}
          {error.digest ? `\nDigest: ${error.digest}` : ""}
        </pre>

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => unstable_retry()}
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #D4AF37, #B8860B)",
              color: "#080808",
              fontSize: "12px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "16px 40px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>

          <Link
            href="/"
            style={{
              display: "inline-block",
              fontSize: "12px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "16px 40px",
              border: "1px solid rgba(212,175,55,0.4)",
              borderRadius: "4px",
              color: "#D4AF37",
              textDecoration: "none",
              background: "transparent",
            }}
          >
            Accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
