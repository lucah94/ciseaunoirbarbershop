import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import twilio from "twilio";

const BOOKING_URL = process.env.NEXT_PUBLIC_SITE_URL + "/booking";

function twimlResponse(message: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

async function handleSmsBody(from: string, body: string): Promise<NextResponse> {
  if (!from) return new NextResponse("", { status: 400 });

  // Normalize phone for lookup
  const digits = from.replace(/\D/g, "");

  // Find confirmed bookings for this phone number
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .order("date", { ascending: true });

  const matching = (bookings || []).filter(b => {
    const bDigits = (b.client_phone || "").replace(/\D/g, "");
    return bDigits === digits || bDigits === digits.slice(-10) || digits.slice(-10) === bDigits.slice(-10);
  });

  // CONFIRMER
  if (body === "CONFIRMER" || body === "CONFIRM" || body === "OUI") {
    if (matching.length === 0) {
      return twimlResponse("Aucune réservation confirmée trouvée pour ce numéro. Appelez-nous au (418) 665-5703.");
    }

    return twimlResponse("Merci! Votre RDV est confirmé. À bientôt chez Ciseau Noir! ✂️");
  }

  // ANNULER
  if (body === "ANNULER" || body === "CANCEL" || body === "ANNULE") {
    if (matching.length === 0) {
      return twimlResponse("Aucune réservation confirmée trouvée pour ce numéro. Appelez-nous au (418) 665-5703.");
    }

    const next = matching[0];
    const now = new Date();
    const apptDate = new Date(next.date + "T" + next.time);
    const diffMs = apptDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      return twimlResponse(`Désolé, l'annulation doit se faire au moins 1h avant. Votre RDV est dans moins d'une heure. Appelez-nous : (418) 665-5703.`);
    }

    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", next.id);

    return twimlResponse(`✅ Votre RDV du ${next.date} à ${next.time} avec ${next.barber} a été annulé. À bientôt chez Ciseau Noir !`);
  }

  // REPRENDRE / RESERVER
  if (body.includes("REPRENDRE") || body.includes("RESERVER") || body.includes("RDV") || body.includes("RENDEZ") || body.includes("ALLO") || body.includes("BONJOUR")) {
    return twimlResponse(`Bonjour ! Pour prendre un rendez-vous chez Ciseau Noir, visitez : ${BOOKING_URL}\n\nOu appelez-nous au (418) 665-5703. À bientôt ✂️`);
  }

  // Default response
  return twimlResponse(`Ciseau Noir ✂️\n\nRépondez ANNULER pour annuler votre prochain RDV.\nPour réserver : ${BOOKING_URL}\nTél : (418) 665-5703`);
}

export async function POST(req: NextRequest) {
  // Validate Twilio signature to prevent spoofed webhook requests
  const twilioSignature = req.headers.get("x-twilio-signature") || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Read the raw body once — needed for both signature validation and parsing
  const rawBody = await req.text();
  const params: Record<string, string> = {};
  new URLSearchParams(rawBody).forEach((value, key) => { params[key] = value; });

  if (authToken) {
    const url = (process.env.NEXT_PUBLIC_SITE_URL || "") + "/api/sms/webhook";
    const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);
    if (!isValid) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const from = params["From"] || "";
  const body = (params["Body"] || "").trim().toUpperCase();

  try {
    return await handleSmsBody(from, body);
  } catch (e) {
    console.error("SMS webhook error:", e);
    return twimlResponse("Une erreur est survenue. Appelez-nous au (418) 665-5703.");
  }
}
