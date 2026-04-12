"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const NAV = [
  {
    label: "Vue d'ensemble",
    href: "/admin",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Agenda",
    href: "/admin/agenda",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Paye",
    href: "/admin/paye",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: "Comptabilité",
    href: "/admin/comptabilite",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: "Horaires",
    href: "/admin/horaires",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: "Réseaux Sociaux",
    href: "/admin/social",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: "Portfolio",
    href: "/admin/portfolio",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    label: "Marketing",
    href: "/admin/marketing",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
  },
  {
    label: "Statistiques",
    href: "/admin/statistiques",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: "Santé 🛡️",
    href: "/admin/sante",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: "Figaro ✂️",
    href: "/admin/figaro",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </svg>
    ),
  },
];

// 5 items shown in bottom nav
const BOTTOM_NAV = ["/admin", "/admin/agenda", "/admin/clients", "/admin/paye", "/admin/comptabilite"];

const GOLD = "#D4AF37";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/admin/login");
  }

  // ── MOBILE ──────────────────────────────────────────────────────────────
  if (isMobile) {
    const bottomItems = NAV.filter(n => BOTTOM_NAV.includes(n.href));

    return (
      <>
        <style>{`
          main { margin-left: 0 !important; padding: 16px 16px 88px !important; }
        `}</style>

        {/* Full-screen menu overlay */}
        {menuOpen && (
          <div style={{
            position: "fixed", inset: 0, background: "#0D1117", zIndex: 300,
            display: "flex", flexDirection: "column", padding: "0 0 80px 0",
            overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{
              padding: "24px 24px 20px",
              borderBottom: "1px solid rgba(212,175,55,0.1)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <p style={{ fontSize: "16px", letterSpacing: "4px", fontWeight: 300, color: GOLD }}>
                MENU
              </p>
              <button onClick={() => setMenuOpen(false)} style={{
                background: "none", border: "none", color: "#888", fontSize: "28px",
                cursor: "pointer", lineHeight: 1, padding: "4px 8px",
              }}>×</button>
            </div>

            {/* All nav items */}
            <nav style={{ flex: 1, padding: "12px 0" }}>
              {NAV.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "16px 24px",
                      color: isActive ? GOLD : "#8B949E",
                      textDecoration: "none", fontSize: "15px", letterSpacing: "1px",
                      background: isActive ? "rgba(212,175,55,0.06)" : "transparent",
                      borderLeft: isActive ? `3px solid ${GOLD}` : "3px solid transparent",
                    }}
                  >
                    <span style={{ opacity: isActive ? 1 : 0.5 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer actions */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(212,175,55,0.12)", display: "flex", gap: "24px" }}>
              <Link href="/" style={{ color: "#7D8590", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Voir le site
              </Link>
              <button onClick={handleLogout} style={{
                background: "none", border: "none", color: "#e55", fontSize: "13px",
                cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "8px",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Déconnexion
              </button>
            </div>
          </div>
        )}

        {/* Bottom navigation bar */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "72px",
          background: "linear-gradient(0deg, #0D1117, #111318)",
          borderTop: "1px solid rgba(212,175,55,0.18)",
          display: "flex", alignItems: "center",
          zIndex: 200,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {bottomItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: "4px",
                  color: isActive ? GOLD : "#666",
                  textDecoration: "none",
                  padding: "8px 0",
                  transition: "color 0.2s",
                }}
              >
                <span style={{ opacity: isActive ? 1 : 0.5, display: "flex" }}>{item.icon}</span>
                <span style={{ fontSize: "9px", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: isActive ? 600 : 400 }}>
                  {item.label.length > 8 ? item.label.slice(0, 7) + "." : item.label}
                </span>
              </Link>
            );
          })}

          {/* Plus / Menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "4px",
              background: "none", border: "none",
              color: menuOpen ? GOLD : "#666",
              cursor: "pointer", padding: "8px 0",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span style={{ fontSize: "9px", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 400 }}>Plus</span>
          </button>
        </nav>
      </>
    );
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  return (
    <aside style={{
      width: "260px",
      background: "linear-gradient(180deg, #0D1117, #111318)",
      borderRight: "1px solid rgba(212,175,55,0.15)",
      padding: "32px 0",
      position: "fixed", top: 0, bottom: 0, left: 0,
      display: "flex", flexDirection: "column",
      zIndex: 100,
    }}>
      <div style={{ padding: "0 28px 32px", borderBottom: "1px solid rgba(212,175,55,0.12)" }}>
        <p style={{ fontSize: "18px", letterSpacing: "5px", fontWeight: 300, margin: 0 }}>
          <span style={{ background: "linear-gradient(135deg, #F0F0F0, #AAAAAA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CISEAU</span>
          {" "}
          <span style={{ background: "linear-gradient(135deg, #D4AF37, #E8C84A, #B8860B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NOIR</span>
        </p>
        <p style={{ color: "#7D8590", fontSize: "10px", marginTop: "6px", letterSpacing: "3px", textTransform: "uppercase" }}>Administration</p>
      </div>

      <nav style={{ padding: "20px 0", flex: 1 }}>
        {NAV.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "13px 28px",
                color: isActive ? GOLD : "#8B949E",
                textDecoration: "none", fontSize: "13px", letterSpacing: "1px",
                background: isActive ? "rgba(212,175,55,0.08)" : "transparent",
                borderLeft: isActive ? `3px solid ${GOLD}` : "3px solid transparent",
                transition: "all 0.2s ease",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
              <span style={{ fontWeight: isActive ? 500 : 400 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "20px 28px", borderTop: "1px solid rgba(212,175,55,0.12)", display: "flex", flexDirection: "column", gap: "14px" }}>
        <Link href="/" style={{ color: "#7D8590", fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Voir le site
        </Link>
        <button onClick={handleLogout} style={{
          background: "none", border: "none", color: "#666", fontSize: "12px",
          cursor: "pointer", textAlign: "left", padding: 0, letterSpacing: "1px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
