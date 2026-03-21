import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez Ciseau Noir Barbershop à Québec. 375 Boulevard des Chutes, Québec, QC. Téléphone : (418) 665-5703. Horaires, adresse et formulaire de contact.",
  openGraph: {
    title: "Contact — Ciseau Noir Barbershop",
    description: "Adresse, horaires et formulaire de contact. Barbershop premium au 375 Boul. des Chutes, Québec.",
    url: "https://ciseaunoir.ca/contact",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/contact",
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
