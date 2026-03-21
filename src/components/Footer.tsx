"use client";
import Link from "next/link";
import { useState } from "react";

function FooterLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const props = external ? { target: "_blank" as const, rel: "noopener noreferrer" } : {};
  const Component = external ? "a" : Link;

  return (
    <div style={{ marginBottom: "10px" }}>
      <Component
        href={href}
        {...props}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          color: hovered ? "#D4AF37" : "#777",
          textDecoration: "none",
          fontSize: "13px",
          transition: "color 0.3s ease, padding-left 0.3s ease",
          paddingLeft: hovered ? "6px" : "0",
          display: "inline-block",
        }}
      >
        {children}
      </Component>
    </div>
  );
}

function SocialIcon({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "44px",
        height: "44px",
        border: `1px solid ${hovered ? "#D4AF37" : "#333"}`,
        color: hovered ? "#D4AF37" : "#777",
        textDecoration: "none",
        fontSize: "18px",
        transition: "all 0.3s ease",
        boxShadow: hovered ? "0 0 20px rgba(212,175,55,0.25), 0 0 40px rgba(212,175,55,0.1)" : "none",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      f
    </a>
  );
}

export default function Footer() {
  const [bookHovered, setBookHovered] = useState(false);

  return (
    <>
      <style>{`
        @keyframes footerLinePulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
      <footer aria-label="Pied de page" style={{ background: "#050505", position: "relative" }}>
        {/* Top gold line */}
        <div style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
          animation: "footerLinePulse 2s ease-in-out infinite",
        }} />

        <div style={{ padding: "70px 40px 40px" }}>
          <div style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "48px",
          }}>
            {/* Brand */}
            <div>
              <p style={{
                fontSize: "22px",
                letterSpacing: "4px",
                fontWeight: 300,
                marginBottom: "14px",
                background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                CISEAU NOIR
              </p>
              <p style={{ color: "#555", fontSize: "13px", lineHeight: 1.8, marginBottom: "20px" }}>
                Barbershop — Québec City
              </p>
              <SocialIcon href="https://www.facebook.com/profile.php?id=61575695811602" label="Facebook" />
            </div>

            {/* Navigation */}
            <div>
              <p style={{
                color: "#D4AF37",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "20px",
                fontWeight: 600,
              }}>Navigation</p>
              <FooterLink href="/">Accueil</FooterLink>
              <FooterLink href="/services">Services</FooterLink>
              <FooterLink href="/team">Notre équipe</FooterLink>
              <FooterLink href="/booking">Réservation</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </div>

            {/* Adresse & Contact */}
            <div>
              <p style={{
                color: "#D4AF37",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "20px",
                fontWeight: 600,
              }}>Adresse & Contact</p>
              <p style={{ color: "#777", fontSize: "13px", lineHeight: 1.9 }}>
                375 Bd des Chutes<br />
                Québec, QC G1E 3G1
              </p>
              <a href="tel:4186655703" style={{
                color: "#D4AF37",
                textDecoration: "none",
                fontSize: "14px",
                display: "inline-block",
                marginTop: "12px",
                letterSpacing: "1px",
              }}>
                (418) 665-5703
              </a>
            </div>

            {/* Horaires */}
            <div>
              <p style={{
                color: "#D4AF37",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "20px",
                fontWeight: 600,
              }}>Horaires</p>
              <p style={{ color: "#777", fontSize: "12px", lineHeight: 2.2 }}>
                Mar–Mer : 8h30–16h30<br />
                Jeu–Ven : 8h30–20h30<br />
                Sam : 9h00–16h30<br />
                <span style={{ color: "#444" }}>Dim–Lun : Fermé</span>
              </p>
            </div>

            {/* Légal */}
            <div>
              <p style={{
                color: "#D4AF37",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "20px",
                fontWeight: 600,
              }}>Légal</p>
              <FooterLink href="/politique-de-confidentialite">Politique de confidentialité</FooterLink>
              <FooterLink href="/conditions-utilisation">Conditions d&apos;utilisation</FooterLink>
            </div>

            {/* Réservations */}
            <div>
              <p style={{
                color: "#D4AF37",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "20px",
                fontWeight: 600,
              }}>Réservations</p>
              <Link
                href="/booking"
                onMouseEnter={() => setBookHovered(true)}
                onMouseLeave={() => setBookHovered(false)}
                style={{
                  fontSize: "11px",
                  padding: "12px 24px",
                  display: "inline-block",
                  marginBottom: "16px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  border: `1px solid ${bookHovered ? "#D4AF37" : "#333"}`,
                  color: bookHovered ? "#D4AF37" : "#888",
                  transition: "all 0.3s ease",
                  boxShadow: bookHovered ? "0 0 15px rgba(212,175,55,0.15)" : "none",
                }}
              >
                Réserver en ligne
              </Link>
            </div>
          </div>

          {/* Bottom */}
          <div style={{
            maxWidth: "1100px",
            margin: "50px auto 0",
            borderTop: "1px solid #1A1A1A",
            paddingTop: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}>
            <p style={{ color: "#333", fontSize: "12px" }}>
              © 2026 Ciseau Noir Barbershop. Tous droits réservés.
            </p>
            <p style={{ color: "#333", fontSize: "11px", letterSpacing: "1px" }}>
              Québec, Canada
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
