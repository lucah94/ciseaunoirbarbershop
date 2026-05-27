import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HomeContent from "@/components/HomeContent";

export const metadata: Metadata = {
  title: "Ciseau Noir — Barbershop Québec",
  description: "Salon de barbier premium à Québec. Coupes, rasages et soins professionnels. 375 Boul. des Chutes. Réservez en ligne.",
  openGraph: {
    title: "Ciseau Noir — Barbershop Québec",
    description: "Salon de barbier premium à Québec. Coupes, rasages et soins professionnels. Réservez en ligne.",
    url: "https://ciseaunoirbarbershop.com",
  },
  alternates: {
    canonical: "https://ciseaunoirbarbershop.com",
  },
};

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HomeContent />
      </main>
      <Footer />
    </>
  );
}
