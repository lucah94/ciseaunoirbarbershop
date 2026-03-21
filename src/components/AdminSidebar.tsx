"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

const NAV = [
  {
    label: "Vue d'ensemble",
    href: "/admin",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Agenda",
    href: "/admin/agenda",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Horaires",
    href: "/admin/horaires",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
        <line x1="2" y1="20" x2="5" y2="17" />
        <line x1="22" y1="20" x2="19" y2="17" />
      </svg>
    ),
  },
  {
    label: "Paye",
    href: "/admin/paye",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: "Comptabilité",
    href: "/admin/comptabilite",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: "Réseaux Sociaux",
    href: "/admin/social",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: "Portfolio",
    href: "/admin/portfolio",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    label: "Bot IA",
    href: "/admin/bot",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 7.27 19H6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h-1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
        <circle cx="9" cy="13" r="1" fill="currentColor" />
        <circle cx="15" cy="13" r="1" fill="currentColor" />
        <path d="M10 17a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/admin/login");
  }

  return (
    <aside
      style={{
        width: "260px",
        background: "linear-gradient(180deg, #060606, #0A0A0A)",
        borderRight: "1px solid rgba(212,175,55,0.1)",
        padding: "32px 0",
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "0 28px 32px",
          borderBottom: "1px solid rgba(212,175,55,0.08)",
        }}
      >
        <p
          style={{
            fontSize: "18px",
            letterSpacing: "5px",
            fontWeight: 300,
            margin: 0,
          }}
        >
          <span
            style={{
              background: "linear-gradient(135deg, #F0F0F0, #AAAAAA)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CISEAU
          </span>{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #D4AF37, #E8C84A, #B8860B)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            NOIR
          </span>
        </p>
        <p
          style={{
            color: "#555",
            fontSize: "10px",
            marginTop: "6px",
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          Administration
        </p>
      </div>

      {/* Navigation */}
      <nav style={{ padding: "20px 0", flex: 1 }}>
        {NAV.map((item) => {
          const isActive = pathname === item.href;
          const isHovered = hoveredLink === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHoveredLink(item.href)}
              onMouseLeave={() => setHoveredLink(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "13px 28px",
                color: isActive ? "#D4AF37" : isHovered ? "#D4AF37" : "#666",
                textDecoration: "none",
                fontSize: "13px",
                letterSpacing: "1px",
                background: isActive
                  ? "rgba(212,175,55,0.08)"
                  : isHovered
                  ? "rgba(212,175,55,0.03)"
                  : "transparent",
                borderLeft: isActive
                  ? "3px solid #D4AF37"
                  : "3px solid transparent",
                transition: "all 0.2s ease",
                position: "relative",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  opacity: isActive ? 1 : 0.6,
                  transition: "opacity 0.2s ease",
                }}
              >
                {item.icon}
              </span>
              <span style={{ fontWeight: isActive ? 500 : 400 }}>
                {item.label}
              </span>
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "3px",
                    height: "60%",
                    background: "#D4AF37",
                    boxShadow: "0 0 8px rgba(212,175,55,0.4)",
                    borderRadius: "0 2px 2px 0",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "20px 28px",
          borderTop: "1px solid rgba(212,175,55,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#555",
            fontSize: "12px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "#D4AF37")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "#555")
          }
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Voir le site
        </Link>
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            color: "#444",
            fontSize: "12px",
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
            letterSpacing: "1px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "#e55")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "#444")
          }
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
