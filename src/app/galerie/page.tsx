import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GalerieContent from "@/components/GalerieContent";

export const metadata: Metadata = {
  title: "Galerie — Nos Réalisations",
  description: "Découvrez les réalisations de nos barbiers : coupes, dégradés, barbes et rasages. Barbershop premium à Québec — Ciseau Noir.",
  openGraph: {
    title: "Galerie — Ciseau Noir Barbershop",
    description: "Découvrez le savoir-faire de nos barbiers à travers nos réalisations.",
    url: "https://ciseaunoir.ca/galerie",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/galerie",
  },
};

export default function GaleriePage() {
  return (
    <>
      <Navbar />
      <main style={{ background: "#080808", minHeight: "100vh" }}>
        <GalerieContent />
      </main>
      <Footer />
    </>
  );
}
