import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Notre Équipe",
  description: "Melynda et Diodis, barbières expertes à Québec. 18+ ans d'expérience. Réservez en ligne avec votre barbière préférée.",
  openGraph: {
    title: "Notre Équipe — Ciseau Noir Barbershop",
    description: "Melynda et Diodis, barbières expertes à Québec. Réservez en ligne.",
    url: "https://ciseaunoir.ca/team",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/team",
  },
};

const TEAM = [
  {
    name: "Melynda",
    id: "melynda",
    role: "Barbière & Co-fondatrice",
    exp: "18+ ans d'expérience",
    bio: "Melynda est la co-fondatrice de Ciseau Noir et l'âme du salon. Avec plus de 18 ans d'expérience dans l'art du barbier, elle maîtrise autant les coupes classiques que les styles contemporains. Sa passion pour son métier se reflète dans chaque client qui sort de son fauteuil.",
    specialties: ["Coupes classiques", "Rasage traditionnel", "Dégradés précis", "Coiffage & finitions"],
  },
  {
    name: "Diodis",
    id: "diodis",
    role: "Barbière",
    exp: "Experte en dégradés",
    bio: "Diodis est reconnue pour sa précision et sa créativité. Spécialiste des dégradés et des coupes modernes, elle sait adapter chaque style à la morphologie et à la personnalité de ses clients. Son souci du détail fait de chaque visite une expérience unique.",
    specialties: ["Dégradés", "Coupes modernes", "Barbe sculptée", "Designs & lignes"],
  },
];

export default function TeamPage() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderPulse {
          0%, 100% { box-shadow: 0 0 15px rgba(212,175,55,0.2), inset 0 0 15px rgba(212,175,55,0.05); }
          50% { box-shadow: 0 0 30px rgba(212,175,55,0.4), inset 0 0 20px rgba(212,175,55,0.1); }
        }
        @keyframes rotateBorder {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .team-card {
          background: #0D0D0D;
          border: 1px solid rgba(212,175,55,0.15);
          border-radius: 20px;
          padding: 48px;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          position: relative;
          overflow: hidden;
        }
        .team-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent);
          opacity: 0;
          transition: opacity 0.4s;
        }
        .team-card:hover {
          border-color: rgba(212,175,55,0.6);
          box-shadow: 0 20px 60px rgba(212,175,55,0.2), 0 0 0 1px rgba(212,175,55,0.1);
          transform: translateY(-8px) scale(1.02);
        }
        .team-card:hover::before {
          opacity: 1;
        }
        .avatar-ring {
          width: 160px;
          height: 160px;
          border-radius: 50%;
          position: relative;
          margin: 0 auto 28px;
        }
        .avatar-ring::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B, #D4AF37);
          animation: rotateBorder 4s linear infinite;
        }
        .avatar-inner {
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;
          z-index: 1;
        }
        .specialty-badge {
          display: inline-block;
          border: 1px solid rgba(212,175,55,0.2);
          color: #999;
          font-size: 11px;
          letter-spacing: 1.5px;
          padding: 8px 18px;
          border-radius: 25px;
          background: rgba(212,175,55,0.04);
          transition: all 0.3s;
        }
        .team-card:hover .specialty-badge {
          border-color: rgba(212,175,55,0.4);
          color: #D4AF37;
          background: rgba(212,175,55,0.08);
        }
        .cta-gold-team {
          display: inline-block;
          background: linear-gradient(135deg, #D4AF37, #B8860B);
          color: #080808;
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 14px 32px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .cta-gold-team:hover {
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
          }}>Notre Équipe</h1>
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
            Des artisans passionnés qui font de chaque coupe une expérience.
          </p>
        </section>

        {/* Team */}
        <section style={{ padding: "40px 20px 100px", maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            gap: "40px",
          }}>
            {TEAM.map((member, i) => (
              <div
                key={member.name}
                className="team-card"
                style={{
                  textAlign: "center",
                  animationName: "fadeInUp",
                  animationDuration: "0.7s",
                  animationFillMode: "both",
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                {/* Avatar with animated gold ring */}
                <div className="avatar-ring">
                  <div className="avatar-inner" style={{ overflow: "hidden" }}>
                    <Image
                      src={member.id === "melynda" ? "/images/melynda.jpg" : "/images/diodis.jpg"}
                      alt={member.name}
                      width={154}
                      height={154}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                    />
                  </div>
                </div>

                {/* Experience badge */}
                <div style={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,134,11,0.1))",
                  border: "1px solid rgba(212,175,55,0.3)",
                  borderRadius: "25px",
                  padding: "6px 20px",
                  marginBottom: "20px",
                }}>
                  <span style={{
                    color: "#E8C84A",
                    fontSize: "11px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}>{member.exp}</span>
                </div>

                {/* Name */}
                <h2 style={{
                  fontSize: "48px",
                  fontWeight: 300,
                  letterSpacing: "6px",
                  color: "#F0F0F0",
                  marginBottom: "8px",
                }}>{member.name}</h2>

                {/* Role in gold */}
                <p style={{
                  fontSize: "13px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  marginBottom: "28px",
                  background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 500,
                }}>{member.role}</p>

                {/* Gold line */}
                <div style={{
                  width: "50px",
                  height: "1px",
                  background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
                  margin: "0 auto 28px",
                }} />

                {/* Bio */}
                <p style={{
                  color: "#999",
                  fontSize: "15px",
                  lineHeight: 1.9,
                  marginBottom: "32px",
                  textAlign: "left",
                }}>{member.bio}</p>

                {/* Specialties */}
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "36px",
                  justifyContent: "center",
                }}>
                  {member.specialties.map((s) => (
                    <span key={s} className="specialty-badge">
                      {s}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <Link href={`/booking?barber=${member.id}`} className="cta-gold-team">
                  Réserver avec {member.name}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Gold separator */}
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 20px" }}>
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
          }}>Choisissez votre barbier et réservez dès maintenant.</p>
          <Link href="/booking" className="cta-gold-team">Réserver maintenant</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
