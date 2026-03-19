import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ background: "#0A0A0A", borderTop: "1px solid #1A1A1A", padding: "60px 40px 40px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "40px" }}>
        <div>
          <p style={{ fontSize: "20px", letterSpacing: "4px", color: "#F5F5F5", fontWeight: 300, marginBottom: "12px" }}>
            CISEAU <span style={{ color: "#C9A84C" }}>NOIR</span>
          </p>
          <p style={{ color: "#555", fontSize: "13px" }}>Barbershop — Québec City</p>
        </div>
        <div>
          <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Navigation</p>
          {[
            { label: "Accueil", href: "/" },
            { label: "Services", href: "/services" },
            { label: "Réservation", href: "/booking" },
            { label: "Contact", href: "/contact" },
          ].map((item) => (
            <div key={item.href} style={{ marginBottom: "8px" }}>
              <Link href={item.href} style={{ color: "#666", textDecoration: "none", fontSize: "13px" }}>{item.label}</Link>
            </div>
          ))}
        </div>
        <div>
          <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Adresse</p>
          <p style={{ color: "#666", fontSize: "13px", lineHeight: 1.8 }}>
            375 Boul. des Chutes<br />
            Québec, QC<br />
            Canada
          </p>
        </div>
        <div>
          <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Réservations</p>
          <Link href="/booking" className="btn-outline" style={{ fontSize: "11px", padding: "10px 20px" }}>
            Réserver en ligne
          </Link>
        </div>
      </div>
      <div style={{ maxWidth: "1000px", margin: "40px auto 0", borderTop: "1px solid #1A1A1A", paddingTop: "24px", textAlign: "center" }}>
        <p style={{ color: "#444", fontSize: "12px" }}>© 2026 Ciseau Noir Barbershop. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
