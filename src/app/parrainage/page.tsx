import type { Metadata } from "next";
import ParrainageClient from "./ParrainageClient";

export const metadata: Metadata = {
  title: "Parrainage",
  description: "Référez un ami chez Ciseau Noir Barbershop et recevez tous les deux 5$ de rabais. Programme de parrainage exclusif.",
  openGraph: {
    title: "Parrainage — Ciseau Noir Barbershop",
    description: "Référez un ami et recevez tous les deux 5$ de rabais sur votre prochaine visite.",
    url: "https://ciseaunoir.ca/parrainage",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/parrainage",
  },
};

export default function ParrainagePage() {
  return <ParrainageClient />;
}
