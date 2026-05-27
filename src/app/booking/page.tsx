import type { Metadata } from "next";
import BookingClient from "./BookingClient";

export const metadata: Metadata = {
  title: "Réservation en ligne",
  description: "Réservez votre rendez-vous chez Ciseau Noir Barbershop en moins de 2 minutes. Coupes, rasages, service premium à Beauport, Québec.",
  openGraph: {
    title: "Réservation — Ciseau Noir Barbershop",
    description: "Réservez en ligne avec Melynda. Coupes, rasages, service premium à Québec.",
    url: "https://ciseaunoirbarbershop.com/booking",
    images: ["/images/melynda.jpg"],
  },
  alternates: {
    canonical: "https://ciseaunoirbarbershop.com/booking",
  },
};

export default function BookingPage() {
  return <BookingClient />;
}
