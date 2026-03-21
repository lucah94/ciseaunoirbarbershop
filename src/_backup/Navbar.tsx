"use client";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #1A1A1A", padding: "0 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "72px"
      }}
    >
      <Link href="/" aria-label="Ciseau Noir — Accueil" style={{ textDecoration: "none" }}>
        <span style={{ fontSize: "20px", letterSpacing: "4px", color: "#F5F5F5", fontWeight: 300 }}>
          CISEAU <span style={{ color: "#C9A84C" }}>NOIR</span>
        </span>
      </Link>

      {/* Desktop */}
      <div style={{ display: "flex", gap: "40px", alignItems: "center" }} className="hidden-mobile">
        {[
          { label: "Accueil", href: "/" },
          { label: "Services", href: "/services" },
          { label: "Notre équipe", href: "/team" },
          { label: "Contact", href: "/contact" },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{
            color: "#999", textDecoration: "none", fontSize: "12px",
            letterSpacing: "2px", textTransform: "uppercase", transition: "color 0.3s"
          }}>
            {item.label}
          </Link>
        ))}
        <a href="tel:4186655703" style={{ color: "#666", fontSize: "12px", textDecoration: "none", letterSpacing: "1px" }}>
          (418) 665-5703
        </a>
        <Link href="/booking" className="btn-gold" style={{ padding: "10px 24px", fontSize: "11px" }}>
          Réserver
        </Link>
      </div>

      {/* Mobile burger */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#C9A84C", fontSize: "24px" }}
        className="show-mobile"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div
          id="mobile-menu"
          style={{
            position: "absolute", top: "72px", left: 0, right: 0,
            background: "#0A0A0A", borderBottom: "1px solid #1A1A1A",
            padding: "24px 40px", display: "flex", flexDirection: "column", gap: "24px"
          }}
        >
          {[
            { label: "Accueil", href: "/" },
            { label: "Services", href: "/services" },
            { label: "Notre équipe", href: "/team" },
            { label: "Contact", href: "/contact" },
          ].map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{
              color: "#999", textDecoration: "none", fontSize: "13px",
              letterSpacing: "2px", textTransform: "uppercase"
            }}>
              {item.label}
            </Link>
          ))}
          <Link href="/booking" className="btn-gold" onClick={() => setOpen(false)} style={{ textAlign: "center" }}>
            Réserver
          </Link>
        </div>
      )}
    </nav>
  );
}
