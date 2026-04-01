import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function toICalDate(date: string, time: string): string {
  return date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
}

function getDuration(service: string): number {
  return service.toLowerCase().includes("coupe") && service.toLowerCase().includes("barbe") ? 45 : 30;
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return toICalDate(date, endTime);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  const duration = getDuration(data.service);
  const dtStart = toICalDate(data.date, data.time);
  const dtEnd = addMinutes(data.date, data.time, duration);
  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ciseau Noir//Barbershop//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.id}@ciseaunoirbarbershop.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${data.service} — Ciseau Noir`,
    `DESCRIPTION:Barbier : ${data.barber}\\nService : ${data.service}\\nPrix : ${data.price}$`,
    "LOCATION:375 Boul. des Chutes\\, Québec\\, QC G1E 3G1",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="rdv-ciseau-noir.ics"`,
    },
  });
}
