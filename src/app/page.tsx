import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        {/* HERO */}
        <section
          className="relative flex items-center justify-center text-center"
          style={{
            minHeight: "100vh",
            background: "linear-gradient(to bottom, #0A0A0A 0%, #1A1A1A 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(circle at 50% 50%, rgba(201,168,76,0.08) 0%, transparent 70%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1, padding: "0 20px" }}>
            <p style={{ color: "#C9A84C", letterSpacing: "6px", fontSize: "12px", textTransform: "uppercase", marginBottom: "24px" }}>
              Québec City
            </p>
            <h1 style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 300, letterSpacing: "8px", textTransform: "uppercase", lineHeight: 1.1, color: "#F5F5F5", marginBottom: "24px" }}>
              CISEAU<br />
              <span style={{ color: "#C9A84C" }}>NOIR</span>
            </h1>
            <p style={{ fontSize: "14px", letterSpacing: "4px", color: "#888", textTransform: "uppercase", marginBottom: "48px" }}>
              Barbershop
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/booking" className="btn-gold">
                Réserver maintenant
              </Link>
              <Link href="/services" className="btn-outline">
                Nos services
              </Link>
            </div>
          </div>
        </section>

        {/* À PROPOS */}
        <section style={{ background: "#111111", padding: "100px 20px", textAlign: "center" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <p className="gold" style={{ letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Notre histoire</p>
            <h2 className="section-title" style={{ color: "#F5F5F5", marginBottom: "16px" }}>L&apos;Art du Barbier</h2>
            <div className="divider" />
            <p style={{ color: "#999", lineHeight: 1.9, fontSize: "16px", marginTop: "32px" }}>
              Ciseau Noir est un salon de barbier d&apos;exception situé au cœur de Québec.
              Avec plus de 18 ans d&apos;expérience, nous offrons une expérience de coiffure
              masculine alliant tradition et modernité dans un cadre élégant et raffiné.
            </p>
          </div>
        </section>

        {/* BARBIERS */}
        <section style={{ background: "#0A0A0A", padding: "100px 20px", textAlign: "center" }}>
          <p className="gold" style={{ letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Notre équipe</p>
          <h2 className="section-title" style={{ color: "#F5F5F5", marginBottom: "16px" }}>Les Artisans</h2>
          <div className="divider" />
          <div style={{ display: "flex", gap: "40px", justifyContent: "center", flexWrap: "wrap", marginTop: "64px", maxWidth: "900px", margin: "64px auto 0" }}>
            {[
              { name: "Melynda", role: "Barbière & Co-fondatrice", years: "18+ ans d'expérience" },
              { name: "Diodis", role: "Barbier", years: "Expert en dégradés" },
            ].map((barber) => (
              <div key={barber.name} style={{ flex: "1", minWidth: "250px", maxWidth: "350px" }}>
                <div style={{
                  width: "160px", height: "160px", borderRadius: "50%",
                  background: "#1A1A1A", border: "2px solid #C9A84C",
                  margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <span style={{ fontSize: "48px", color: "#C9A84C" }}>✂</span>
                </div>
                <h3 style={{ fontSize: "24px", letterSpacing: "3px", color: "#F5F5F5", marginBottom: "8px" }}>{barber.name}</h3>
                <p className="gold" style={{ fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase" }}>{barber.role}</p>
                <p style={{ color: "#666", fontSize: "13px", marginTop: "8px" }}>{barber.years}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SERVICES */}
        <section style={{ background: "#111111", padding: "100px 20px", textAlign: "center" }}>
          <p className="gold" style={{ letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Ce qu&apos;on offre</p>
          <h2 className="section-title" style={{ color: "#F5F5F5", marginBottom: "16px" }}>Nos Services</h2>
          <div className="divider" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px", maxWidth: "1000px", margin: "64px auto 0" }}>
            {[
              { service: "Coupe + Lavage", price: "35$", desc: "Coupe classique avec shampoing" },
              { service: "Coupe + Rasage Lame", price: "50$", desc: "Coupe, rasage lame & serviette chaude" },
              { service: "Service Premium", price: "75$", desc: "Coupe, rasage, serviette chaude & exfoliant" },
              { service: "Rasage / Barbe", price: "25$", desc: "Rasage lame, barbe & tondeuse" },
              { service: "Tarif Étudiant", price: "30$", desc: "Coupe + lavage (preuve requise)" },
            ].map((item) => (
              <div key={item.service} style={{
                background: "#1A1A1A", padding: "36px 28px",
                border: "1px solid #222", transition: "border-color 0.3s"
              }}>
                <p style={{ fontSize: "28px", color: "#C9A84C", fontWeight: 300, marginBottom: "8px" }}>{item.price}</p>
                <h3 style={{ fontSize: "16px", letterSpacing: "2px", color: "#F5F5F5", marginBottom: "12px", textTransform: "uppercase" }}>{item.service}</h3>
                <p style={{ color: "#666", fontSize: "13px", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "48px" }}>
            <Link href="/booking" className="btn-gold">Réserver une place</Link>
          </div>
        </section>

        {/* CTA */}
        <section style={{
          padding: "100px 20px", textAlign: "center",
          background: "linear-gradient(135deg, #1A1A0A 0%, #0A0A0A 50%, #0A1A1A 100%)"
        }}>
          <h2 className="section-title" style={{ color: "#F5F5F5", marginBottom: "16px" }}>Prêt pour votre prochain look?</h2>
          <div className="divider" />
          <p style={{ color: "#888", margin: "24px auto", maxWidth: "500px", lineHeight: 1.8 }}>
            Réservez en ligne en moins de 2 minutes. Walk-ins bienvenus.
          </p>
          <Link href="/booking" className="btn-gold">Réserver maintenant</Link>
        </section>

        {/* INFO */}
        <section style={{ background: "#111111", padding: "60px 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "60px", flexWrap: "wrap", maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
            <div>
              <p className="gold" style={{ letterSpacing: "3px", fontSize: "11px", textTransform: "uppercase", marginBottom: "12px" }}>Adresse</p>
              <p style={{ color: "#999", fontSize: "14px" }}>375 Boul. des Chutes<br />Québec, QC</p>
            </div>
            <div>
              <p className="gold" style={{ letterSpacing: "3px", fontSize: "11px", textTransform: "uppercase", marginBottom: "12px" }}>Walk-ins</p>
              <p style={{ color: "#999", fontSize: "14px" }}>Bienvenus<br />selon disponibilité</p>
            </div>
            <div>
              <p className="gold" style={{ letterSpacing: "3px", fontSize: "11px", textTransform: "uppercase", marginBottom: "12px" }}>Annulation</p>
              <p style={{ color: "#999", fontSize: "14px" }}>1 heure<br />avant le rendez-vous</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
