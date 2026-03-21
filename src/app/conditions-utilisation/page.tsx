import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions d'utilisation du site et du service de réservation en ligne de Ciseau Noir Barbershop, Québec.",
  openGraph: {
    title: "Conditions d'utilisation — Ciseau Noir Barbershop",
    description: "Conditions d'utilisation du service de réservation en ligne de Ciseau Noir Barbershop.",
    url: "https://ciseaunoir.ca/conditions-utilisation",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/conditions-utilisation",
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

export default function ConditionsUtilisationPage() {
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
          }}>Conditions d&apos;utilisation</h1>
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
            Bienvenue sur le site de Ciseau Noir Barbershop. En accédant à notre site web et en utilisant notre service de réservation en ligne, vous acceptez les présentes conditions d&apos;utilisation. Veuillez les lire attentivement.
          </p>

          <h2 style={sectionTitleStyle}>1. Services proposés</h2>
          <p style={paragraphStyle}>
            Ciseau Noir Barbershop offre des services de barbier professionnels, incluant :
          </p>
          <ul style={listStyle}>
            <li>Coupe + Lavage (shampoing, coupe personnalisée, finition)</li>
            <li>Coupe + Rasage lame & serviette chaude</li>
            <li>Service Premium (coupe, rasage, exfoliant visage)</li>
            <li>Rasage / Barbe (tondeuse ou lame droite)</li>
            <li>Tarif Étudiant (coupe + lavage, preuve d&apos;inscription requise)</li>
          </ul>
          <p style={paragraphStyle}>
            Les tarifs et services sont sujets à modification sans préavis. Les prix affichés sur le site sont en dollars canadiens (CAD) et incluent les taxes applicables, sauf indication contraire.
          </p>

          <h2 style={sectionTitleStyle}>2. Réservation en ligne</h2>
          <p style={paragraphStyle}>
            Notre plateforme de réservation vous permet de prendre rendez-vous en ligne. En effectuant une réservation, vous vous engagez à :
          </p>
          <ul style={listStyle}>
            <li>Fournir des informations exactes et complètes (nom, courriel, téléphone)</li>
            <li>Vous présenter à l&apos;heure convenue</li>
            <li>Nous informer de toute annulation ou modification dans les délais prévus</li>
          </ul>

          <h2 style={sectionTitleStyle}>3. Politique d&apos;annulation</h2>
          <p style={paragraphStyle}>
            Nous comprenons que des imprévus peuvent survenir. Voici notre politique d&apos;annulation :
          </p>
          <ul style={listStyle}>
            <li><strong style={{ color: "#ccc" }}>Annulation gratuite</strong> — Toute annulation effectuée au moins 4 heures avant le rendez-vous est gratuite.</li>
            <li><strong style={{ color: "#ccc" }}>Annulation tardive</strong> — Les annulations effectuées moins de 4 heures avant le rendez-vous peuvent entraîner des frais.</li>
            <li><strong style={{ color: "#ccc" }}>Absence sans préavis (no-show)</strong> — En cas d&apos;absence sans annulation préalable, nous nous réservons le droit de refuser les futures réservations en ligne.</li>
          </ul>
          <p style={paragraphStyle}>
            Pour annuler ou modifier un rendez-vous, utilisez le lien fourni dans votre courriel de confirmation ou contactez-nous directement.
          </p>

          <h2 style={sectionTitleStyle}>4. Retards</h2>
          <p style={paragraphStyle}>
            Nous vous demandons d&apos;arriver à l&apos;heure prévue. Un retard de plus de 15 minutes peut entraîner l&apos;annulation automatique de votre rendez-vous afin de respecter l&apos;horaire des autres clients.
          </p>

          <h2 style={sectionTitleStyle}>5. Comportement</h2>
          <p style={paragraphStyle}>
            Nous nous réservons le droit de refuser le service à toute personne dont le comportement est irrespectueux, menaçant ou perturbateur envers notre personnel ou nos clients. Ciseau Noir Barbershop est un espace professionnel et courtois.
          </p>

          <h2 style={sectionTitleStyle}>6. Propriété intellectuelle</h2>
          <p style={paragraphStyle}>
            L&apos;ensemble du contenu de ce site (textes, images, logos, design) est la propriété exclusive de Ciseau Noir Barbershop et est protégé par les lois sur la propriété intellectuelle. Toute reproduction ou utilisation non autorisée est interdite.
          </p>

          <h2 style={sectionTitleStyle}>7. Limitation de responsabilité</h2>
          <p style={paragraphStyle}>
            Ciseau Noir Barbershop s&apos;efforce d&apos;offrir un service de qualité. Cependant :
          </p>
          <ul style={listStyle}>
            <li>Nous ne garantissons pas la disponibilité ininterrompue du site web ou du système de réservation.</li>
            <li>Nous ne sommes pas responsables des dommages indirects résultant de l&apos;utilisation de notre site.</li>
            <li>Les résultats des services de barbier peuvent varier selon la nature des cheveux et les attentes individuelles.</li>
            <li>En cas d&apos;insatisfaction, veuillez nous en informer sur place afin que nous puissions corriger la situation.</li>
          </ul>

          <h2 style={sectionTitleStyle}>8. Protection des données</h2>
          <p style={paragraphStyle}>
            La collecte et le traitement de vos données personnelles sont régis par notre{" "}
            <a href="/politique-de-confidentialite" style={{ color: "#D4AF37", textDecoration: "none" }}>
              Politique de confidentialité
            </a>.
          </p>

          <h2 style={sectionTitleStyle}>9. Droit applicable</h2>
          <p style={paragraphStyle}>
            Les présentes conditions sont régies par les lois de la province de Québec et les lois fédérales du Canada applicables. Tout litige sera soumis à la compétence exclusive des tribunaux de la ville de Québec.
          </p>

          <h2 style={sectionTitleStyle}>10. Modifications</h2>
          <p style={paragraphStyle}>
            Nous nous réservons le droit de modifier les présentes conditions d&apos;utilisation à tout moment. Les modifications prennent effet dès leur publication sur cette page. L&apos;utilisation continue du site après une modification constitue votre acceptation des nouvelles conditions.
          </p>

          <h2 style={sectionTitleStyle}>11. Contact</h2>
          <p style={paragraphStyle}>
            Pour toute question concernant ces conditions d&apos;utilisation, veuillez nous contacter :
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
        </section>
      </main>
      <Footer />
    </>
  );
}
