"use client";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useTransform, useScroll, type Variants } from "framer-motion";
import { useRef, useState, useEffect } from "react";

/* ───── 3D Tilt Card ───── */
function Card3D({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-8, 8]);

  function handleMouse(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{
        ...style,
        perspective: 1000,
        transformStyle: "preserve-3d",
        rotateX,
        rotateY,
        transition: "box-shadow 0.3s ease",
      }}
      whileHover={{
        translateZ: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(212,175,55,0.1)",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ───── Animated Counter ───── */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const duration = 2000;
          const step = (ts: number) => {
            if (!start) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            setCount(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ───── Section Fade-In ───── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};

/* ───── Stagger container ───── */
const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

/* ───── Reviews Data ───── */
const reviews = [
  { name: "Marc-Antoine D.", rating: 5, text: "Meilleur barbershop à Québec, sans hésiter. Melynda est une artiste avec les ciseaux. Ambiance chaleureuse et résultat impeccable à chaque visite." },
  { name: "Jean-François L.", rating: 5, text: "Service exceptionnel! Le rasage à la lame est une vraie expérience de détente. Je recommande à tous les gars qui veulent se sentir comme des rois." },
  { name: "Sébastien R.", rating: 5, text: "J'ai essayé plusieurs barbiers à Québec et Ciseau Noir est de loin le meilleur. Attention aux détails, propreté et professionnalisme au rendez-vous." },
  { name: "Alexandre P.", rating: 4, text: "Excellent service, très professionnel. Le dégradé fait par Diodis était parfait. Le seul point, c'est que c'est parfois difficile d'avoir un rendez-vous rapidement." },
  { name: "Mathieu B.", rating: 5, text: "Ça fait 2 ans que je vais chez Ciseau Noir et je ne changerais pour rien au monde. Chaque coupe est exactement ce que je veux. Bravo à toute l'équipe!" },
  { name: "Nicolas G.", rating: 5, text: "Ambiance premium, service 5 étoiles. Le traitement complet avec serviette chaude et exfoliant, c'est le luxe. Ma blonde m'a dit que je sentais trop bon!" },
  { name: "Étienne C.", rating: 4, text: "Très bonne expérience, l'ambiance est top et le résultat toujours soigné. Le prix est un peu plus élevé qu'ailleurs, mais la qualité est vraiment là. Je recommande!" },
];

function Stars({ count }: { count: number }) {
  return (
    <span style={{ color: "#D4AF37", fontSize: "16px", letterSpacing: "2px" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ opacity: i < count ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

/* ───── Reviews Grid ───── */
function ReviewsGrid() {
  return (
    <div>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={staggerContainer}
        className="reviews-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "24px",
        }}
      >
        {reviews.map((review, i) => (
          <motion.div
            key={review.name}
            variants={staggerItem}
            style={{
              background: "linear-gradient(145deg, #111111, #0D0D0D)",
              border: "1px solid #1A1A1A",
              padding: "36px 28px",
              position: "relative",
              transition: "border-color 0.4s ease, box-shadow 0.4s ease",
            }}
            whileHover={{
              borderColor: "rgba(212,175,55,0.3)",
              boxShadow: "0 0 30px rgba(212,175,55,0.08)",
            }}
          >
            {/* Quote icon */}
            <span style={{
              position: "absolute",
              top: "20px",
              right: "24px",
              fontSize: "36px",
              color: "rgba(212,175,55,0.15)",
              fontFamily: "Georgia, serif",
              lineHeight: 1,
            }}>
              &ldquo;
            </span>
            <Stars count={review.rating} />
            <p style={{
              color: "#AAA",
              fontSize: "14px",
              lineHeight: 1.8,
              fontWeight: 300,
              margin: "16px 0 20px",
              fontStyle: "italic",
            }}>
              &ldquo;{review.text}&rdquo;
            </p>
            <p style={{
              color: "#D4AF37",
              fontSize: "12px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              fontWeight: 500,
            }}>
              {review.name}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Responsive: on small screens show 1 card */}
      <style>{`
        @media (max-width: 900px) {
          .reviews-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 901px) and (max-width: 1100px) {
          .reviews-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

/* ───── Main Component ───── */
export default function HomeContent() {
  const [ctaHovered, setCtaHovered] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroScale = useTransform(heroScroll, [0, 1], [1, 0.92]);
  const heroOpacity = useTransform(heroScroll, [0, 0.8], [1, 0]);

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(212,175,55,0.2), 0 0 40px rgba(212,175,55,0.05); }
          50% { box-shadow: 0 0 30px rgba(212,175,55,0.4), 0 0 60px rgba(212,175,55,0.15); }
        }
        @keyframes borderRotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .hero-cta {
          display: inline-block;
          padding: 18px 48px;
          font-size: 13px;
          letter-spacing: 3px;
          text-transform: uppercase;
          text-decoration: none;
          font-weight: 600;
          background: linear-gradient(135deg, #B8860B, #D4AF37);
          color: #080808;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          animation: glowPulse 2s ease-in-out infinite;
        }
        .hero-cta:hover {
          background: linear-gradient(135deg, #D4AF37, #E8C84A);
          box-shadow: 0 0 40px rgba(212,175,55,0.4), 0 0 80px rgba(212,175,55,0.15);
          transform: translateY(-2px);
        }
        .hero-outline {
          display: inline-block;
          padding: 18px 48px;
          font-size: 13px;
          letter-spacing: 3px;
          text-transform: uppercase;
          text-decoration: none;
          font-weight: 400;
          color: #D4AF37;
          border: 1px solid rgba(212,175,55,0.4);
          background: transparent;
          transition: all 0.3s ease;
        }
        .hero-outline:hover {
          border-color: #D4AF37;
          background: rgba(212,175,55,0.05);
          box-shadow: 0 0 20px rgba(212,175,55,0.15);
        }
      `}</style>

      {/* ═══════ HERO ═══════ */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          minHeight: "100vh",
          background: "#080808",
          overflow: "hidden",
        }}
      >
        {/* Radial glow */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(ellipse at 50% 40%, rgba(212,175,55,0.06) 0%, transparent 60%)",
        }} />
        {/* Subtle grid pattern */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(212,175,55,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.02) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          opacity: 0.5,
        }} />

        <motion.div style={{ position: "relative", zIndex: 1, padding: "0 20px", scale: heroScale, opacity: heroOpacity }}>
          {/* Floating scissors icon */}
          <div style={{
            animation: "float 4s ease-in-out infinite",
            marginBottom: "32px",
            fontSize: "40px",
            color: "#D4AF37",
            filter: "drop-shadow(0 0 20px rgba(212,175,55,0.3))",
          }}>
            ✂
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            style={{
              color: "#D4AF37",
              letterSpacing: "8px",
              fontSize: "12px",
              textTransform: "uppercase",
              marginBottom: "28px",
              fontWeight: 400,
            }}
          >
            Québec City
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{
              fontSize: "clamp(52px, 9vw, 110px)",
              fontWeight: 200,
              letterSpacing: "12px",
              textTransform: "uppercase",
              lineHeight: 1.05,
              marginBottom: "16px",
              background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s linear infinite",
            }}
          >
            CISEAU<br />NOIR
          </motion.h1>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            style={{
              width: "60px",
              height: "1px",
              background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
              margin: "24px auto",
            }}
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
            style={{
              fontSize: "14px",
              letterSpacing: "6px",
              color: "#777",
              textTransform: "uppercase",
              marginBottom: "56px",
              fontWeight: 300,
            }}
          >
            Barbershop
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8 }}
            style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link href="/booking" className="hero-cta">
              Réserver maintenant
            </Link>
            <Link href="/services" className="hero-outline">
              Nos services
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════ SEPARATOR ═══════ */}
      <div style={{
        height: "1px",
        background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
        animation: "pulse 2s ease-in-out infinite",
      }} />

      {/* ═══════ À PROPOS ═══════ */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
        style={{ background: "#0D0D0D", padding: "120px 20px", textAlign: "center" }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p style={{
            letterSpacing: "6px",
            fontSize: "11px",
            textTransform: "uppercase",
            marginBottom: "20px",
            color: "#D4AF37",
            fontWeight: 500,
          }}>
            Notre histoire
          </p>
          <h2 style={{
            marginBottom: "20px",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 200,
            letterSpacing: "6px",
            textTransform: "uppercase",
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s linear infinite",
          }}>
            L&apos;Art du Barbier
          </h2>
          <div style={{
            width: "50px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "0 auto 40px",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          <p style={{
            color: "#999",
            lineHeight: 2,
            fontSize: "16px",
            fontWeight: 300,
            maxWidth: "650px",
            margin: "0 auto",
          }}>
            Ciseau Noir est un salon de barbier d&apos;exception situé au cœur de Québec.
            Avec plus de 18 ans d&apos;expérience, nous offrons une expérience de coiffure
            masculine alliant tradition et modernité dans un cadre élégant et raffiné.
          </p>
        </div>
      </motion.section>

      {/* ═══════ STATS ═══════ */}
      <section style={{
        background: "#080808",
        padding: "60px 20px",
        borderTop: "1px solid #111",
        borderBottom: "1px solid #111",
      }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "center",
            gap: "60px",
            flexWrap: "wrap",
            textAlign: "center",
          }}
        >
          {[
            { value: 18, suffix: "+", label: "Ans d'expérience" },
            { value: 44, suffix: "", label: "Avis 5 étoiles" },
            { value: 2, suffix: "", label: "Barbières expertes" },
          ].map((stat) => (
            <motion.div key={stat.label} variants={staggerItem} style={{ minWidth: "140px" }}>
              <p style={{
                fontSize: "48px",
                fontWeight: 200,
                letterSpacing: "2px",
                color: "#D4AF37",
                marginBottom: "8px",
              }}>
                <Counter target={stat.value} suffix={stat.suffix} />
              </p>
              <p style={{ color: "#666", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══════ BARBIERS ═══════ */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
        style={{ background: "#080808", padding: "120px 20px", textAlign: "center" }}
      >
        <p style={{
          color: "#D4AF37",
          letterSpacing: "6px",
          fontSize: "11px",
          textTransform: "uppercase",
          marginBottom: "20px",
          fontWeight: 500,
        }}>
          Notre équipe
        </p>
        <h2 style={{
          marginBottom: "20px",
          fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 200,
          letterSpacing: "6px",
          textTransform: "uppercase",
          background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "shimmer 3s linear infinite",
        }}>
          Les Artisans
        </h2>
        <div style={{
          width: "50px",
          height: "1px",
          background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
          margin: "0 auto",
          animation: "pulse 2s ease-in-out infinite",
        }} />

        <div style={{
          display: "flex",
          gap: "48px",
          justifyContent: "center",
          flexWrap: "wrap",
          marginTop: "72px",
          maxWidth: "900px",
          margin: "72px auto 0",
        }}>
          {[
            { name: "Melynda", role: "Barbière & Co-fondatrice", years: "18+ ans d'expérience" },
            { name: "Diodis", role: "Barbière", years: "Experte en dégradés" },
          ].map((barber, i) => (
            <motion.div
              key={barber.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.6 }}
              style={{ flex: "1", minWidth: "260px", maxWidth: "360px" }}
            >
              <div style={{
                padding: "48px 32px",
                background: "#0D0D0D",
                border: "1px solid #1A1A1A",
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.4s ease",
              }}>
                {/* Animated border top */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "2px",
                  background: "linear-gradient(90deg, transparent, #D4AF37, #E8C84A, #D4AF37, transparent)",
                  backgroundSize: "200% 100%",
                  animation: "borderRotate 3s ease-in-out infinite",
                }} />

                <div style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  border: "2px solid #D4AF37",
                  margin: "0 auto 28px",
                  overflow: "hidden",
                  boxShadow: "0 0 30px rgba(212,175,55,0.15)",
                  position: "relative",
                }}>
                  <Image
                    src={`/images/${barber.name.toLowerCase()}.jpg`}
                    alt={barber.name}
                    width={120}
                    height={120}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <h3 style={{
                  fontSize: "22px",
                  letterSpacing: "4px",
                  color: "#F0F0F0",
                  marginBottom: "10px",
                  fontWeight: 300,
                  textTransform: "uppercase",
                }}>{barber.name}</h3>
                <p style={{
                  fontSize: "11px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "#D4AF37",
                  fontWeight: 500,
                }}>{barber.role}</p>
                <p style={{ color: "#666", fontSize: "13px", marginTop: "10px" }}>{barber.years}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ═══════ SEPARATOR ═══════ */}
      <div style={{
        height: "1px",
        background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
        animation: "pulse 2s ease-in-out infinite",
      }} />

      {/* ═══════ SERVICES ═══════ */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
        style={{ background: "#0D0D0D", padding: "120px 20px", textAlign: "center" }}
      >
        <p style={{
          color: "#D4AF37",
          letterSpacing: "6px",
          fontSize: "11px",
          textTransform: "uppercase",
          marginBottom: "20px",
          fontWeight: 500,
        }}>
          Ce qu&apos;on offre
        </p>
        <h2 style={{
          marginBottom: "20px",
          fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 200,
          letterSpacing: "6px",
          textTransform: "uppercase",
          background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "shimmer 3s linear infinite",
        }}>
          Nos Services
        </h2>
        <div style={{
          width: "50px",
          height: "1px",
          background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
          margin: "0 auto",
          animation: "pulse 2s ease-in-out infinite",
        }} />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={staggerContainer}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
            maxWidth: "1100px",
            margin: "72px auto 0",
          }}
        >
          {[
            { service: "Coupe + Lavage", price: "35$", desc: "Coupe classique avec shampoing" },
            { service: "Coupe + Rasage Lame", price: "50$", desc: "Coupe, rasage lame & serviette chaude" },
            { service: "Service Premium", price: "75$", desc: "Coupe, rasage, serviette chaude & exfoliant" },
            { service: "Rasage / Barbe", price: "25$", desc: "Rasage lame, barbe & tondeuse" },
            { service: "Tarif Étudiant", price: "30$", desc: "Coupe + lavage (preuve requise)" },
          ].map((item, i) => (
            <motion.div key={item.service} variants={staggerItem}>
            <Card3D
              style={{
                background: "linear-gradient(145deg, #111111, #0D0D0D)",
                padding: "44px 32px",
                border: "1px solid #1A1A1A",
                cursor: "default",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Subtle corner accent */}
              <div style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "60px",
                height: "60px",
                background: "linear-gradient(135deg, transparent 50%, rgba(212,175,55,0.05) 50%)",
              }} />
              <p style={{
                fontSize: "36px",
                fontWeight: 200,
                marginBottom: "12px",
                background: "linear-gradient(135deg, #D4AF37, #E8C84A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>{item.price}</p>
              <h3 style={{
                fontSize: "14px",
                letterSpacing: "3px",
                color: "#F0F0F0",
                marginBottom: "14px",
                textTransform: "uppercase",
                fontWeight: 500,
              }}>{item.service}</h3>
              <p style={{ color: "#666", fontSize: "13px", lineHeight: 1.7 }}>{item.desc}</p>
            </Card3D>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          style={{ marginTop: "56px" }}
        >
          <Link href="/booking" className="hero-cta">
            Réserver une place
          </Link>
        </motion.div>
      </motion.section>

      {/* ═══════ CTA ═══════ */}
      <section style={{
        padding: "120px 20px",
        textAlign: "center",
        background: "#080808",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative gradient orbs */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeUp}
          style={{ position: "relative", zIndex: 1 }}
        >
          <h2 style={{
            marginBottom: "20px",
            fontSize: "clamp(26px, 4vw, 40px)",
            fontWeight: 200,
            letterSpacing: "4px",
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s linear infinite",
          }}>
            Prêt pour votre prochain look?
          </h2>
          <div style={{
            width: "50px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "0 auto",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          <p style={{
            color: "#888",
            margin: "32px auto",
            maxWidth: "500px",
            lineHeight: 1.9,
            fontSize: "15px",
            fontWeight: 300,
          }}>
            Réservez en ligne en moins de 2 minutes. Walk-ins bienvenus.
          </p>
          <Link href="/booking" className="hero-cta">
            Réserver maintenant
          </Link>
        </motion.div>
      </section>

      {/* ═══════ AVIS GOOGLE ═══════ */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeUp}
        style={{
          background: "#0D0D0D",
          padding: "120px 20px",
          textAlign: "center",
          borderTop: "1px solid #111",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <p style={{
            color: "#D4AF37",
            letterSpacing: "6px",
            fontSize: "11px",
            textTransform: "uppercase",
            marginBottom: "20px",
            fontWeight: 500,
          }}>
            Avis Google
          </p>
          <h2 style={{
            marginBottom: "20px",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 200,
            letterSpacing: "6px",
            textTransform: "uppercase",
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s linear infinite",
          }}>
            Ce que nos clients disent
          </h2>
          <div style={{
            width: "50px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "0 auto",
            animation: "pulse 2s ease-in-out infinite",
          }} />

          {/* Rating summary */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            flexWrap: "wrap",
            margin: "40px 0 48px",
          }}>
            <span style={{
              color: "#D4AF37",
              fontSize: "36px",
              letterSpacing: "6px",
              filter: "drop-shadow(0 0 8px rgba(212,175,55,0.3))",
            }}>
              ★★★★★
            </span>
            <div style={{ textAlign: "left" }}>
              <p style={{
                color: "#F0F0F0",
                fontSize: "36px",
                fontWeight: 200,
                letterSpacing: "2px",
              }}>
                5.0
              </p>
              <p style={{ color: "#555", fontSize: "12px", letterSpacing: "1px" }}>44 avis Google</p>
            </div>
          </div>

          {/* Reviews grid */}
          <ReviewsGrid />

          <div style={{ marginTop: "40px" }}>
            <a
              href="https://www.google.com/maps/search/Ciseau+Noir+Barbershop+Québec"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#D4AF37",
                fontSize: "12px",
                letterSpacing: "2px",
                textDecoration: "none",
                borderBottom: "1px solid rgba(212,175,55,0.4)",
                paddingBottom: "4px",
                transition: "border-color 0.3s ease",
              }}
            >
              Voir tous les avis sur Google →
            </a>
          </div>
        </div>
      </motion.section>

      {/* ═══════ INFO ═══════ */}
      <section style={{
        background: "#111111",
        padding: "80px 20px",
        borderTop: "1px solid #1A1A1A",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "60px",
          flexWrap: "wrap",
          maxWidth: "1000px",
          margin: "0 auto",
          textAlign: "center",
        }}>
          <div>
            <p style={{
              color: "#D4AF37",
              letterSpacing: "3px",
              fontSize: "11px",
              textTransform: "uppercase",
              marginBottom: "14px",
              fontWeight: 500,
            }}>Adresse</p>
            <p style={{ color: "#999", fontSize: "14px", lineHeight: 1.8 }}>
              375 Bd des Chutes<br />Québec, QC G1E 3G1
            </p>
            <a href="tel:4186655703" style={{
              color: "#D4AF37",
              fontSize: "13px",
              textDecoration: "none",
              display: "block",
              marginTop: "10px",
              transition: "color 0.3s ease",
            }}>
              (418) 665-5703
            </a>
          </div>
          <div>
            <p style={{
              color: "#D4AF37",
              letterSpacing: "3px",
              fontSize: "11px",
              textTransform: "uppercase",
              marginBottom: "14px",
              fontWeight: 500,
            }}>Horaires</p>
            <p style={{ color: "#999", fontSize: "13px", lineHeight: 2.2 }}>
              Mar–Mer : 8h30–16h30<br />
              Jeu–Ven : 8h30–20h30<br />
              Sam : 9h00–16h30<br />
              <span style={{ color: "#555" }}>Dim–Lun : Fermé</span>
            </p>
          </div>
          <div>
            <p style={{
              color: "#D4AF37",
              letterSpacing: "3px",
              fontSize: "11px",
              textTransform: "uppercase",
              marginBottom: "14px",
              fontWeight: 500,
            }}>Walk-ins</p>
            <p style={{ color: "#999", fontSize: "14px" }}>
              Bienvenus<br />selon disponibilité
            </p>
          </div>
          <div>
            <p style={{
              color: "#D4AF37",
              letterSpacing: "3px",
              fontSize: "11px",
              textTransform: "uppercase",
              marginBottom: "14px",
              fontWeight: 500,
            }}>Nous suivre</p>
            <a
              href="https://www.facebook.com/profile.php?id=61575695811602"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#999",
                fontSize: "13px",
                textDecoration: "none",
                display: "block",
                marginBottom: "8px",
                transition: "color 0.3s ease",
              }}
            >
              Facebook →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
