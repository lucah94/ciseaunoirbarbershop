"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: t("nav.home"), href: "/" },
    { label: t("nav.services"), href: "/services" },
    { label: t("nav.team"), href: "/team" },
    { label: t("nav.gallery"), href: "/galerie" },
    { label: t("nav.contact"), href: "/contact" },
  ];

  return (
    <>
      <style>{`
        @keyframes navShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes borderGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .nav-link-gold {
          color: #999 !important;
          text-decoration: none !important;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          transition: color 0.3s ease;
          position: relative;
          padding-bottom: 4px;
        }
        .nav-link-gold::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 0;
          height: 1px;
          background: linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A);
          transition: width 0.3s ease, left 0.3s ease;
        }
        .nav-link-gold:hover {
          color: #D4AF37 !important;
        }
        .nav-link-gold:hover::after {
          width: 100%;
          left: 0;
        }
        .nav-btn-gold {
          padding: 10px 24px;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #B8860B, #D4AF37);
          color: #080808;
          text-decoration: none;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-block;
        }
        .nav-btn-gold:hover {
          background: linear-gradient(135deg, #D4AF37, #E8C84A);
          box-shadow: 0 0 20px rgba(212,175,55,0.3);
          transform: translateY(-1px);
        }
        .nav-burger {
          background: none;
          border: none;
          cursor: pointer;
          color: #D4AF37;
          font-size: 26px;
          transition: transform 0.3s ease, color 0.3s ease;
        }
        .nav-burger:hover {
          color: #E8C84A;
          transform: scale(1.1);
        }
        .lang-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0;
          font-size: 11px;
          letter-spacing: 1px;
          border: 1px solid #333;
          overflow: hidden;
        }
        .lang-btn {
          padding: 5px 10px;
          background: transparent;
          color: #666;
          border: none;
          cursor: pointer;
          font-size: 11px;
          letter-spacing: 1px;
          font-weight: 500;
          transition: all 0.3s ease;
          font-family: inherit;
        }
        .lang-btn:hover {
          color: #D4AF37;
        }
        .lang-btn.active {
          background: linear-gradient(135deg, #B8860B, #D4AF37);
          color: #080808;
          font-weight: 600;
        }
      `}</style>
      <nav
        aria-label="Navigation principale"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: scrolled ? "rgba(8,8,8,0.95)" : "rgba(8,8,8,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: "0 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "72px",
          transition: "all 0.4s ease",
          boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {/* Bottom border animated */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
          opacity: scrolled ? 1 : 0.4,
          animation: "borderGlow 2s ease-in-out infinite",
          transition: "opacity 0.4s ease",
        }} />

        <Link href="/" aria-label="Ciseau Noir — Accueil" style={{ textDecoration: "none" }}>
          <span style={{
            fontSize: "20px",
            letterSpacing: "4px",
            fontWeight: 300,
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "navShimmer 3s linear infinite",
          }}>
            CISEAU NOIR
          </span>
        </Link>

        {/* Desktop */}
        <div style={{ display: "flex", gap: "36px", alignItems: "center" }} className="hidden-mobile">
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link-gold">
              {item.label}
            </Link>
          ))}
          <a href="tel:4186655703" style={{
            color: "#666",
            fontSize: "12px",
            textDecoration: "none",
            letterSpacing: "1px",
            transition: "color 0.3s ease",
          }}>
            (418) 665-5703
          </a>
          <div className="lang-toggle">
            <button
              className={`lang-btn${language === "fr" ? " active" : ""}`}
              onClick={() => setLanguage("fr")}
              aria-label="Français"
            >
              FR
            </button>
            <button
              className={`lang-btn${language === "en" ? " active" : ""}`}
              onClick={() => setLanguage("en")}
              aria-label="English"
            >
              EN
            </button>
          </div>
          <Link href="/booking" className="nav-btn-gold">
            {t("nav.book")}
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="show-mobile nav-burger"
        >
          {open ? "\u2715" : "\u2630"}
        </button>

        {open && (
          <div
            id="mobile-menu"
            style={{
              position: "absolute",
              top: "72px",
              left: 0,
              right: 0,
              background: "rgba(8,8,8,0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(212,175,55,0.2)",
              padding: "32px 40px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{
                color: "#999",
                textDecoration: "none",
                fontSize: "13px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                transition: "color 0.3s ease",
                paddingLeft: "12px",
                borderLeft: "2px solid transparent",
              }}>
                {item.label}
              </Link>
            ))}
            <div style={{ display: "flex", gap: "12px", alignItems: "center", paddingLeft: "12px" }}>
              <div className="lang-toggle">
                <button
                  className={`lang-btn${language === "fr" ? " active" : ""}`}
                  onClick={() => setLanguage("fr")}
                  aria-label="Français"
                >
                  FR
                </button>
                <button
                  className={`lang-btn${language === "en" ? " active" : ""}`}
                  onClick={() => setLanguage("en")}
                  aria-label="English"
                >
                  EN
                </button>
              </div>
            </div>
            <Link href="/booking" className="nav-btn-gold" onClick={() => setOpen(false)} style={{ textAlign: "center", marginTop: "8px" }}>
              {t("nav.book")}
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}
