import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Services & Tarifs",
  description: "Coupes, rasages lame, service premium et tarif étudiant. Barbershop premium à Québec — 375 Bd des Chutes. (418) 665-5703.",
  openGraph: {
    title: "Services & Tarifs — Ciseau Noir Barbershop",
    description: "Coupes à partir de 30$, rasage lame, service premium 75$. Barbershop premium à Québec.",
    url: "https://ciseaunoir.ca/services",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/services",
  },
};

const SERVICES = [
  {
    name: "Coupe + Lavage",
    price: "35$",
    duration: "45 min",
    desc: "Notre service signature. Shampoing, coupe classique adaptée à votre style, et finition impeccable.",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Finition & coiffage"],
    icon: "✂️",
  },
  {
    name: "Coupe + Rasage Lame & Serviette Chaude",
    price: "50$",
    duration: "60 min",
    desc: "L'expérience complète pour l'homme moderne. Coupe précise et rasage traditionnel à la lame droite.",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Rasage lame droite", "Serviette chaude"],
    icon: "🪒",
  },
  {
    name: "Service Premium",
    price: "75$",
    duration: "75 min",
    desc: "Notre service haut de gamme. Une expérience de barbier complète du début à la fin.",
    includes: ["Shampoing & conditionneur", "Coupe personnalisée", "Rasage lame droite", "Serviette chaude", "Exfoliant visage"],
    featured: true,
    icon: "👑",
  },
  {
    name: "Rasage / Barbe",
    price: "25$",
    duration: "30 min",
    desc: "Pour un rasage net ou une barbe bien taillée. Tondeuse, lame droite et serviette chaude.",
    includes: ["Rasage lame droite ou tondeuse", "Serviette chaude", "Finition barbe"],
    icon: "🧔",
  },
  {
    name: "Tarif Étudiant",
    price: "30$",
    duration: "45 min",
    desc: "Coupe + lavage au tarif étudiant. Preuve d'inscription requise.",
    includes: ["Shampoing", "Coupe classique", "Preuve d'inscription requise"],
    icon: "🎓",
  },
];

export default function ServicesPage() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(212,175,55,0.1); }
          50% { box-shadow: 0 0 40px rgba(212,175,55,0.2); }
        }
        .service-card {
          background: #0D0D0D;
          border: 1px solid rgba(212,175,55,0.2);
          border-radius: 16px;
          padding: 40px;
          position: relative;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          overflow: hidden;
        }
        .service-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent);
          opacity: 0;
          transition: opacity 0.4s;
        }
        .service-card:hover {
          border-color: rgba(212,175,55,0.6);
          box-shadow: 0 20px 60px rgba(212,175,55,0.2), 0 0 0 1px rgba(212,175,55,0.1);
          transform: translateY(-8px) scale(1.02);
        }
        .service-card:hover::before {
          opacity: 1;
        }
        .service-card-featured {
          background: linear-gradient(135deg, #0D0D0D 0%, #1A1508 100%);
          border: 1px solid rgba(212,175,55,0.4);
          animation: pulseGlow 3s ease-in-out infinite;
        }
        .service-tag {
          border: 1px solid rgba(212,175,55,0.15);
          color: #999;
          font-size: 11px;
          letter-spacing: 1px;
          padding: 6px 14px;
          border-radius: 20px;
          background: rgba(212,175,55,0.05);
          transition: all 0.3s;
        }
        .service-card:hover .service-tag {
          border-color: rgba(212,175,55,0.3);
          color: #D4AF37;
        }
        .cta-gold {
          display: inline-block;
          background: linear-gradient(135deg, #D4AF37, #B8860B);
          color: #080808;
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 16px 40px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .cta-gold:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(212,175,55,0.3);
        }
      `}</style>
      <Navbar />
      <main style={{ background: "#080808", minHeight: "100vh" }}>
        {/* Hero */}
        <section style={{
          paddingTop: "160px",
          paddingBottom: "100px",
          textAlign: "center",
          background: "radial-gradient(ellipse at top, rgba(212,175,55,0.06) 0%, #080808 70%)",
          position: "relative",
        }}>
          <p style={{
            color: "#D4AF37",
            letterSpacing: "8px",
            fontSize: "11px",
            textTransform: "uppercase",
            marginBottom: "20px",
            fontWeight: 500,
          }}>Ciseau Noir</p>
          <h1 style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            fontWeight: 300,
            letterSpacing: "10px",
            textTransform: "uppercase",
            marginBottom: "20px",
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s linear infinite",
          }}>Nos Services</h1>
          <div style={{
            width: "80px",
            height: "2px",
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "0 auto 28px",
          }} />
          <p style={{
            color: "#888",
            fontSize: "16px",
            maxWidth: "520px",
            margin: "0 auto",
            lineHeight: 1.9,
            letterSpacing: "0.5px",
          }}>
            Des services de barbier haut de gamme, exécutés avec précision et savoir-faire.
          </p>
        </section>

        {/* Services */}
        <section style={{ padding: "40px 20px 100px", maxWidth: "920px", margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {SERVICES.map((s, index) => (
              <div
                key={s.name}
                className={`service-card ${s.featured ? "service-card-featured" : ""}`}
                style={{
                  animationName: "fadeInUp",
                  animationDuration: "0.6s",
                  animationFillMode: "both",
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                {s.featured && (
                  <div style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                    color: "#080808",
                    fontSize: "10px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    padding: "5px 16px",
                    borderRadius: "20px",
                  }}>
                    Populaire
                  </div>
                )}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "16px",
                  marginBottom: "20px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "12px",
                      background: "rgba(212,175,55,0.08)",
                      border: "1px solid rgba(212,175,55,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      flexShrink: 0,
                    }}>
                      {s.icon}
                    </div>
                    <div>
                      <h2 style={{
                        fontSize: "22px",
                        letterSpacing: "2px",
                        color: "#F0F0F0",
                        marginBottom: "4px",
                        fontWeight: 400,
                      }}>{s.name}</h2>
                      <p style={{
                        color: "#666",
                        fontSize: "13px",
                        letterSpacing: "1px",
                      }}>{s.duration}</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: "42px",
                    fontWeight: 300,
                    background: "linear-gradient(135deg, #E8C84A, #D4AF37)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "none",
                    filter: "drop-shadow(0 0 20px rgba(212,175,55,0.3))",
                  }}>{s.price}</span>
                </div>
                <p style={{
                  color: "#999",
                  fontSize: "15px",
                  lineHeight: 1.8,
                  marginBottom: "24px",
                }}>{s.desc}</p>

                {/* Gold separator */}
                <div style={{
                  width: "100%",
                  height: "1px",
                  background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)",
                  marginBottom: "24px",
                }} />

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {s.includes.map((item) => (
                    <span key={item} className="service-tag">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Gold separator line */}
        <div style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "0 20px",
        }}>
          <div style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)",
          }} />
        </div>

        {/* CTA */}
        <section style={{ textAlign: "center", padding: "80px 20px 120px" }}>
          <p style={{
            color: "#888",
            marginBottom: "40px",
            fontSize: "16px",
            letterSpacing: "0.5px",
          }}>Prêt à réserver votre prochain rendez-vous ?</p>
          <Link href="/booking" className="cta-gold">Réserver maintenant</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
