import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Programme Fidélité — Ciseau Noir Barbershop",
  description:
    "Vérifiez votre progression vers votre coupe gratuite. 10 visites = 1 coupe offerte chez Ciseau Noir Barbershop à Beauport, Québec.",
  alternates: {
    canonical: "https://ciseaunoirbarbershop.com/fidelite",
  },
  openGraph: {
    title: "Programme Fidélité — Ciseau Noir",
    description: "10 visites = 1 coupe gratuite chez Ciseau Noir Barbershop.",
    url: "https://ciseaunoirbarbershop.com/fidelite",
    images: ["/images/melynda.jpg"],
  },
};

export default function FideliteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
