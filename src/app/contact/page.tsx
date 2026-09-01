import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez Ciseau Noir Barbershop à Québec. 2275 Avenue Royale, Québec, QC. Téléphone : (418) 665-5703. Horaires, adresse et formulaire de contact.",
  openGraph: {
    title: "Contact — Ciseau Noir Barbershop",
    description: "Adresse, horaires et formulaire de contact. Barbershop premium au 2275 Avenue Royale, Québec.",
    url: "https://ciseaunoirbarbershop.com/contact",
  },
  alternates: {
    canonical: "https://ciseaunoirbarbershop.com/contact",
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
