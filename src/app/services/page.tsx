import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const SERVICES = [
  {
    name: "Coupe + Lavage",
    price: "35$",
    duration: "45 min",
    desc: "Notre service signature. Shampoing, coupe classique adaptée à votre style, et finition impeccable.",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Finition & coiffage"],
  },
  {
    name: "Coupe + Rasage Lame & Serviette Chaude",
    price: "50$",
    duration: "60 min",
    desc: "L'expérience complète pour l'homme moderne. Coupe précise et rasage traditionnel à la lame droite.",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Rasage lame droite", "Serviette chaude"],
  },
  {
    name: "Service Premium",
    price: "75$",
    duration: "75 min",
    desc: "Notre service haut de gamme. Une expérience de barbier complète du début à la fin.",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Rasage lame droite", "Serviette chaude", "Exfoliant visage"],
    featured: true,
  },
  {
    name: "Rasage / Barbe",
    price: "25$",
    duration: "30 min",
    desc: "Pour un rasage net ou une barbe bien taillée. Tondeuse, lame droite et serviette chaude.",
    includes: ["Rasage lame droite ou tondeuse", "Serviette chaude", "Finition barbe"],
  },
  {
    name: "Tarif Étudiant",
    price: "30$",
    duration: "45 min",
    desc: "Coupe + lavage au tarif étudiant. Preuve d'inscription requise.",
    includes: ["Shampoing", "Coupe classique", "Preuve d'inscription requise"],
  },
];

export default function ServicesPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: "#0A0A0A", minHeight: "100vh" }}>
        {/* Hero */}
        <section style={{ paddingTop: "140px", paddingBottom: "80px", textAlign: "center", background: "linear-gradient(to bottom, #111 0%, #0A0A0A 100%)" }}>
          <p style={{ color: "#C9A84C", letterSpacing: "6px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Ciseau Noir</p>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 300, letterSpacing: "8px", textTransform: "uppercase", color: "#F5F5F5", marginBottom: "16px" }}>Nos Services</h1>
          <div style={{ width: "60px", height: "2px", background: "#C9A84C", margin: "0 auto 24px" }} />
          <p style={{ color: "#888", fontSize: "15px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.8 }}>
            Des services de barbier haut de gamme, exécutés avec précision et savoir-faire.
          </p>
        </section>

        {/* Services */}
        <section style={{ padding: "80px 20px", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {SERVICES.map((s) => (
              <div
                key={s.name}
                style={{
                  background: s.featured ? "#111" : "#0F0F0F",
                  border: `2px solid ${s.featured ? "#C9A84C" : "#1A1A1A"}`,
                  padding: "40px",
                  position: "relative",
                }}
              >
                {s.featured && (
                  <div style={{
                    position: "absolute", top: "-1px", right: "32px",
                    background: "#C9A84C", color: "#0A0A0A",
                    fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase",
                    fontWeight: 700, padding: "4px 16px"
                  }}>
                    Populaire
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <h2 style={{ fontSize: "20px", letterSpacing: "2px", color: "#F5F5F5", marginBottom: "4px" }}>{s.name}</h2>
                    <p style={{ color: "#666", fontSize: "13px" }}>{s.duration}</p>
                  </div>
                  <span style={{ fontSize: "36px", color: "#C9A84C", fontWeight: 300 }}>{s.price}</span>
                </div>
                <p style={{ color: "#888", fontSize: "14px", lineHeight: 1.7, marginBottom: "24px" }}>{s.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {s.includes.map((item) => (
                    <span key={item} style={{
                      border: "1px solid #2A2A2A", color: "#666",
                      fontSize: "11px", letterSpacing: "1px", padding: "6px 12px",
                    }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: "center", padding: "60px 20px 100px" }}>
          <p style={{ color: "#888", marginBottom: "32px", fontSize: "15px" }}>Prêt à réserver votre prochain rendez-vous ?</p>
          <Link href="/booking" className="btn-gold">Réserver maintenant</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
