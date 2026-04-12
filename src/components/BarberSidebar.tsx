"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const NAV = [
  {
    label: "Mon Agenda",
    href: "/barber/agenda",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Mes Horaires",
    href: "/barber/horaires",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

const GOLD = "#D4AF37";

export default function BarberSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/barber-login", { method: "DELETE" });
    router.push("/barber/login");
  }

  if (isMobile) {
    return (
      <>
        <style>{`main { margin-left: 0 !important; padding: 16px 16px 88px !important; }`}</style>
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "72px",
          background: "linear-gradient(0deg, #0D1117, #111318)",
          borderTop: "1px solid rgba(212,175,55,0.18)",
          display: "flex", alignItems: "center",
          zIndex: 200, paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {NAV.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "4px",
                color: isActive ? GOLD : "#666", textDecoration: "none", padding: "8px 0",
              }}>
                <span style={{ opacity: isActive ? 1 : 0.5, display: "flex" }}>{item.icon}</span>
                <span style={{ fontSize: "9px", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: isActive ? 600 : 400 }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button onClick={handleLogout} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "4px",
            background: "none", border: "none", color: "#666", cursor: "pointer", padding: "8px 0",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span style={{ fontSize: "9px", letterSpacing: "0.5px", textTransform: "uppercase" }}>Sortir</span>
          </button>
        </nav>
      </>
    );
  }

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
        <p style={{ color: "#7D8590", fontSize: "10px", marginTop: "6px", letterSpacing: "3px", textTransform: "uppercase" }}>Espace Diodis</p>
      </div>

      <nav style={{ padding: "20px 0", flex: 1 }}>
        {NAV.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "13px 28px",
              color: isActive ? GOLD : "#8B949E",
              textDecoration: "none", fontSize: "13px", letterSpacing: "1px",
              background: isActive ? "rgba(212,175,55,0.08)" : "transparent",
              borderLeft: isActive ? `3px solid ${GOLD}` : "3px solid transparent",
              transition: "all 0.2s ease",
            }}>
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
