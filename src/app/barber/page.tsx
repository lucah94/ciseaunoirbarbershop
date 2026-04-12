import { redirect } from "next/navigation";

export default function BarberRoot() {
  redirect("/barber/agenda");
}
