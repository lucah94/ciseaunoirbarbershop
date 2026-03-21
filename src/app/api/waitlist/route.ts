import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import twilio from "twilio";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

const waitlistSchema = z.object({
  client_name: z.string().min(1, "Le nom est requis").max(100),
  client_email: z.string().email("Courriel invalide").optional().or(z.literal("")),
  client_phone: z.string().min(1, "Le téléphone est requis").max(20),
  service: z.string().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Format d'heure invalide (HH:MM)"),
  barber: z.string().min(1, "Le coiffeur est requis"),
});

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = rateLimit(req, { limit: 10, windowMs: 60 * 1000 });
  if (rateLimitResponse) return rateLimitResponse;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const result = waitlistSchema.safeParse(rawBody);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
  }

  const { date, time, barber, service, client_name, client_phone, client_email } = result.data;

  const { error } = await supabaseAdmin.from("waitlist").insert([{
    date,
    time,
    barber,
    service: service || null,
    client_name,
    client_phone,
    client_email: client_email || null,
  }]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_PHONE_NUMBER) {
      const dateFormatted = new Date(date + "T12:00:00").toLocaleDateString("fr-CA", {
        weekday: "long", month: "long", day: "numeric",
      });
      await getTwilioClient().messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formatPhone(client_phone),
        body: `Ciseau Noir ✂️ Liste d'attente enregistrée !\n\n${service} avec ${barber}\n📅 ${dateFormatted} à ${time}\n\nVous serez contacté si un créneau se libère.`,
      });
    }
  } catch (smsErr) {
    console.error("Waitlist SMS error:", smsErr);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const isAdmin = cookieHeader.includes("admin_auth=true");
  if (!isAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const barber = searchParams.get("barber");

  let query = supabaseAdmin.from("waitlist").select("*").eq("notified", false).order("created_at", { ascending: true });

  if (date) query = query.eq("date", date);
  if (barber) query = query.eq("barber", barber);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
