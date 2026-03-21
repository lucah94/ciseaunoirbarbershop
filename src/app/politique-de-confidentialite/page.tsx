import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité de Ciseau Noir Barbershop. Informations sur la collecte, l'utilisation et la protection de vos données personnelles.",
  openGraph: {
    title: "Politique de confidentialité — Ciseau Noir Barbershop",
    description: "Politique de confidentialité de Ciseau Noir Barbershop.",
    url: "https://ciseaunoir.ca/politique-de-confidentialite",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/politique-de-confidentialite",
  },
};

const sectionTitleStyle = {
  fontSize: "20px",
  fontWeight: 400 as const,
  letterSpacing: "3px",
  textTransform: "uppercase" as const,
  color: "#D4AF37",
  marginBottom: "16px",
  marginTop: "48px",
};

const paragraphStyle = {
  color: "#999",
  fontSize: "15px",
  lineHeight: 1.9,
  marginBottom: "16px",
};

const listStyle = {
  color: "#999",
  fontSize: "15px",
  lineHeight: 2,
  paddingLeft: "24px",
  marginBottom: "16px",
};

export default function PolitiqueDeConfidentialitePage() {
  return (
    <>
      <Navbar />
      <main style={{ background: "#080808", minHeight: "100vh" }}>
        {/* Hero */}
        <section style={{
          paddingTop: "160px",
          paddingBottom: "60px",
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
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 300,
            letterSpacing: "8px",
            textTransform: "uppercase",
            marginBottom: "20px",
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>Politique de confidentialité</h1>
          <div style={{
            width: "80px",
            height: "2px",
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "0 auto",
          }} />
        </section>

        {/* Content */}
        <section style={{ maxWidth: "800px", margin: "0 auto", padding: "0 20px 100px" }}>
          <p style={{ ...paragraphStyle, color: "#666", fontSize: "13px" }}>
            Dernière mise à jour : 20 mars 2026
          </p>

          <p style={paragraphStyle}>
            Ciseau Noir Barbershop (ci-après « nous », « notre ») s&apos;engage à protéger la vie privée de ses clients et utilisateurs. Cette politique de confidentialité explique comment nous collectons, utilisons, stockons et protégeons vos données personnelles lorsque vous utilisez notre site web et nos services de réservation en ligne.
          </p>

          <h2 style={sectionTitleStyle}>1. Données collectées</h2>
          <p style={paragraphStyle}>
            Nous collectons les informations suivantes lorsque vous utilisez notre service de réservation :
          </p>
          <ul style={listStyle}>
            <li>Nom et prénom</li>
            <li>Adresse courriel</li>
            <li>Numéro de téléphone</li>
            <li>Données de rendez-vous (date, heure, service choisi, barbier sélectionné)</li>
            <li>Données de navigation (via Google Analytics)</li>
          </ul>

          <h2 style={sectionTitleStyle}>2. Utilisation des données</h2>
          <p style={paragraphStyle}>Vos données personnelles sont utilisées pour :</p>
          <ul style={listStyle}>
            <li>Gérer et confirmer vos rendez-vous</li>
            <li>Vous envoyer des rappels et confirmations par courriel et SMS</li>
            <li>Communiquer avec vous concernant nos services</li>
            <li>Améliorer notre site web et nos services grâce aux données analytiques</li>
          </ul>

          <h2 style={sectionTitleStyle}>3. Services tiers</h2>
          <p style={paragraphStyle}>
            Nous utilisons les services tiers suivants pour le fonctionnement de notre plateforme :
          </p>
          <ul style={listStyle}>
            <li><strong style={{ color: "#D4AF37" }}>Supabase</strong> — Stockage sécurisé de vos données (rendez-vous, informations de contact). Les données sont hébergées sur des serveurs sécurisés.</li>
            <li><strong style={{ color: "#D4AF37" }}>Resend</strong> — Envoi de courriels de confirmation et de rappel de rendez-vous.</li>
            <li><strong style={{ color: "#D4AF37" }}>Twilio</strong> — Envoi de SMS de confirmation et de rappel de rendez-vous.</li>
            <li><strong style={{ color: "#D4AF37" }}>Google Analytics</strong> — Collecte de données anonymisées sur la navigation pour améliorer l&apos;expérience utilisateur. Ces données incluent les pages visitées, la durée des sessions et le type d&apos;appareil utilisé.</li>
          </ul>

          <h2 style={sectionTitleStyle}>4. Conservation des données</h2>
          <p style={paragraphStyle}>
            Vos données personnelles sont conservées aussi longtemps que nécessaire pour fournir nos services. Les données de rendez-vous sont conservées pour une durée maximale de 24 mois après votre dernier rendez-vous. Vous pouvez demander la suppression de vos données à tout moment.
          </p>

          <h2 style={sectionTitleStyle}>5. Vos droits</h2>
          <p style={paragraphStyle}>
            Conformément aux lois applicables sur la protection des données personnelles, vous disposez des droits suivants :
          </p>
          <ul style={listStyle}>
            <li><strong style={{ color: "#ccc" }}>Droit d&apos;accès</strong> — Vous pouvez demander une copie de vos données personnelles que nous détenons.</li>
            <li><strong style={{ color: "#ccc" }}>Droit de rectification</strong> — Vous pouvez demander la correction de données inexactes ou incomplètes.</li>
            <li><strong style={{ color: "#ccc" }}>Droit de suppression</strong> — Vous pouvez demander la suppression de vos données personnelles.</li>
            <li><strong style={{ color: "#ccc" }}>Droit d&apos;opposition</strong> — Vous pouvez vous opposer au traitement de vos données à des fins de marketing.</li>
            <li><strong style={{ color: "#ccc" }}>Droit à la portabilité</strong> — Vous pouvez demander le transfert de vos données dans un format structuré.</li>
          </ul>

          <h2 style={sectionTitleStyle}>6. Sécurité</h2>
          <p style={paragraphStyle}>
            Nous mettons en place des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données personnelles contre tout accès non autorisé, modification, divulgation ou destruction. L&apos;accès aux données est restreint aux personnes autorisées uniquement.
          </p>

          <h2 style={sectionTitleStyle}>7. Cookies</h2>
          <p style={paragraphStyle}>
            Notre site utilise des cookies nécessaires au bon fonctionnement du site ainsi que des cookies analytiques (Google Analytics) pour améliorer votre expérience. Vous pouvez gérer vos préférences de cookies via les paramètres de votre navigateur.
          </p>

          <h2 style={sectionTitleStyle}>8. Contact</h2>
          <p style={paragraphStyle}>
            Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, veuillez nous contacter :
          </p>
          <div style={{
            background: "#0D0D0D",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: "12px",
            padding: "28px",
            marginTop: "16px",
          }}>
            <p style={{ color: "#F0F0F0", fontSize: "16px", marginBottom: "8px", fontWeight: 400 }}>
              Ciseau Noir Barbershop
            </p>
            <p style={{ color: "#999", fontSize: "14px", lineHeight: 2 }}>
              375 Bd des Chutes, Québec, QC G1E 3G1<br />
              Courriel : <a href="mailto:ciseaunoirbarbershop@gmail.com" style={{ color: "#D4AF37", textDecoration: "none" }}>ciseaunoirbarbershop@gmail.com</a><br />
              Téléphone : <a href="tel:4186655703" style={{ color: "#D4AF37", textDecoration: "none" }}>(418) 665-5703</a>
            </p>
          </div>

          <h2 style={sectionTitleStyle}>9. Modifications</h2>
          <p style={paragraphStyle}>
            Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. Toute modification sera publiée sur cette page avec la date de mise à jour. Nous vous encourageons à consulter cette page régulièrement.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
