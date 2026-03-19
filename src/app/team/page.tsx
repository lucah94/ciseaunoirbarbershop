import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TEAM = [
  {
    name: "Melynda",
    role: "Barbière & Co-fondatrice",
    exp: "18+ ans d'expérience",
    bio: "Melynda est la co-fondatrice de Ciseau Noir et l'âme du salon. Avec plus de 18 ans d'expérience dans l'art du barbier, elle maîtrise autant les coupes classiques que les styles contemporains. Sa passion pour son métier se reflète dans chaque client qui sort de son fauteuil.",
    specialties: ["Coupes classiques", "Rasage traditionnel", "Dégradés précis", "Coiffage & finitions"],
  },
  {
    name: "Diodis",
    role: "Barbier",
    exp: "Expert en dégradés",
    bio: "Diodis est reconnu pour sa précision et sa créativité. Spécialiste des dégradés et des coupes modernes, il sait adapter chaque style à la morphologie et à la personnalité de ses clients. Son souci du détail fait de chaque visite une expérience unique.",
    specialties: ["Dégradés", "Coupes modernes", "Barbe sculptée", "Designs & lignes"],
  },
];

export default function TeamPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: "#0A0A0A", minHeight: "100vh" }}>
        {/* Hero */}
        <section style={{ paddingTop: "140px", paddingBottom: "80px", textAlign: "center", background: "linear-gradient(to bottom, #111 0%, #0A0A0A 100%)" }}>
          <p style={{ color: "#C9A84C", letterSpacing: "6px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Ciseau Noir</p>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 300, letterSpacing: "8px", textTransform: "uppercase", color: "#F5F5F5", marginBottom: "16px" }}>Notre Équipe</h1>
          <div style={{ width: "60px", height: "2px", background: "#C9A84C", margin: "0 auto 24px" }} />
          <p style={{ color: "#888", fontSize: "15px", maxWidth: "500px", margin: "0 auto", lineHeight: 1.8 }}>
            Des artisans passionnés qui font de chaque coupe une expérience.
          </p>
        </section>

        {/* Team */}
        <section style={{ padding: "80px 20px", maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "60px" }}>
            {TEAM.map((member, i) => (
              <div
                key={member.name}
                style={{
                  display: "flex",
                  flexDirection: i % 2 === 0 ? "row" : "row-reverse",
                  gap: "60px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {/* Photo placeholder */}
                <div style={{ flex: "0 0 auto" }}>
                  <div style={{
                    width: "240px", height: "280px",
                    background: "#111",
                    border: "2px solid #C9A84C",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: "12px",
                    margin: "0 auto",
                  }}>
                    <span style={{ fontSize: "64px", color: "#C9A84C" }}>✂</span>
                    <p style={{ color: "#333", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase" }}>Photo à venir</p>
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: "1", minWidth: "280px" }}>
                  <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "12px" }}>{member.exp}</p>
                  <h2 style={{ fontSize: "42px", fontWeight: 300, letterSpacing: "4px", color: "#F5F5F5", marginBottom: "8px" }}>{member.name}</h2>
                  <p style={{ color: "#666", fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "24px" }}>{member.role}</p>
                  <div style={{ width: "40px", height: "1px", background: "#C9A84C", marginBottom: "24px" }} />
                  <p style={{ color: "#888", fontSize: "15px", lineHeight: 1.8, marginBottom: "32px" }}>{member.bio}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {member.specialties.map((s) => (
                      <span key={s} style={{
                        border: "1px solid #2A2A2A", color: "#666",
                        fontSize: "11px", letterSpacing: "1px", padding: "6px 14px",
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: "center", padding: "40px 20px 100px" }}>
          <p style={{ color: "#888", marginBottom: "32px", fontSize: "15px" }}>Choisissez votre barbier et réservez dès maintenant.</p>
          <Link href="/booking" className="btn-gold">Réserver maintenant</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
