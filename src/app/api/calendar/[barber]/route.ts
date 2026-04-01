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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ barber: string }> }
) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.CALENDAR_SECRET || key !== process.env.CALENDAR_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { barber } = await params;
  const barberName = barber.toLowerCase();
  if (barberName !== "melynda" && barberName !== "diodis") {
    return NextResponse.json({ error: "Barbier invalide" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .ilike("barber", `%${barberName}%`)
    .eq("status", "confirmed")
    .gte("date", today)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);

  const events = (data || []).map((booking) => {
    const duration = getDuration(booking.service);
    const dtStart = toICalDate(booking.date, booking.time);
    const dtEnd = addMinutes(booking.date, booking.time, duration);
    const description = `Client: ${booking.client_name}\\nTél: ${booking.client_phone}\\nService: ${booking.service}\\nPrix: ${booking.price}$`;

    return [
      "BEGIN:VEVENT",
      `UID:${booking.id}@ciseaunoirbarbershop.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${booking.client_name} — ${booking.service}`,
      `DESCRIPTION:${description}`,
      "LOCATION:375 Boul. des Chutes\\, Québec\\, QC G1E 3G1",
      "END:VEVENT",
    ].join("\r\n");
  });

  const displayName = barberName.charAt(0).toUpperCase() + barberName.slice(1);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Ciseau Noir//Barbershop//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Ciseau Noir — ${displayName}`,
    "X-WR-TIMEZONE:America/Toronto",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
