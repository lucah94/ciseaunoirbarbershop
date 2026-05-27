import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cartes-Cadeaux — Ciseau Noir Barbershop",
  description:
    "Offrez une carte-cadeau Ciseau Noir Barbershop. De 30$ à 100$, valable sur tous nos services à Beauport, Québec. Livraison instantanée par courriel.",
  alternates: {
    canonical: "https://ciseaunoirbarbershop.com/cartes-cadeaux",
  },
  openGraph: {
    title: "Cartes-Cadeaux — Ciseau Noir Barbershop",
    description: "Offrez une carte-cadeau Ciseau Noir Barbershop, livrée instantanément par courriel.",
    url: "https://ciseaunoirbarbershop.com/cartes-cadeaux",
    images: ["/images/melynda.jpg"],
  },
};

export default function CartesCadeauxLayout({ children }: { children: React.ReactNode }) {
  return children;
}
