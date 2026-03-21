import type { Metadata } from "next";
import BookingClient from "./BookingClient";

export const metadata: Metadata = {
  title: "Réservation en ligne",
  description: "Réservez votre rendez-vous chez Ciseau Noir Barbershop en moins de 2 minutes. Choisissez votre service, votre barbière et votre créneau. 375 Boul. des Chutes, Québec.",
  openGraph: {
    title: "Réservation — Ciseau Noir Barbershop",
    description: "Réservez en ligne avec Melynda ou Diodis. Coupes, rasages, service premium à Québec.",
    url: "https://ciseaunoir.ca/booking",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca/booking",
  },
};

export default function BookingPage() {
  return <BookingClient />;
}
