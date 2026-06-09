/**
 * Conversion tracking pour Google Ads / Meta Ads.
 * Fire-and-forget — n'attend pas la réponse pour ne pas ralentir l'API booking.
 *
 * Env vars requises (optionnelles):
 * - META_PIXEL_ID         (Facebook Pixel ID)
 * - META_ACCESS_TOKEN     (Meta Conversions API token)
 * - META_TEST_EVENT_CODE  (optionnel, pour debug)
 * - GOOGLE_ADS_CONVERSION_ID    (ex: AW-123456789)
 * - GOOGLE_ADS_CONVERSION_LABEL (ex: AbC-D_efG)
 */
import crypto from "crypto";

function hash(value: string | undefined | null): string {
  if (!value) return "";
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhoneE164(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function trackBookingConversion(booking: {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  price: number;
  service: string;
  source?: string;
  created_at?: string;
}): Promise<void> {
  // Lance les 2 trackers en parallèle, sans bloquer l'API
  await Promise.allSettled([
    fireMetaCAPI(booking),
    fireGoogleAdsConversion(booking),
  ]);
}

async function fireMetaCAPI(booking: {
  id: string; client_name: string; client_email: string | null; client_phone: string | null;
  price: number; service: string; source?: string; created_at?: string;
}): Promise<void> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) return;

  const event = {
    event_name: "Schedule",
    event_time: Math.floor(new Date(booking.created_at || Date.now()).getTime() / 1000),
    event_id: booking.id, // déduplication avec pixel client
    action_source: "website",
    event_source_url: "https://ciseaunoirbarbershop.com/booking",
    user_data: {
      em: booking.client_email ? [hash(booking.client_email)] : [],
      ph: booking.client_phone ? [hash(normalizePhoneE164(booking.client_phone))] : [],
      fn: booking.client_name ? [hash(booking.client_name.split(" ")[0])] : [],
      country: [hash("ca")],
    },
    custom_data: {
      currency: "CAD",
      value: booking.price || 0,
      content_name: booking.service,
      content_category: "barbershop",
    },
  };

  const body: Record<string, unknown> = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {}
}

async function fireGoogleAdsConversion(booking: {
  id: string; price: number; created_at?: string;
}): Promise<void> {
  // GA4 Measurement Protocol — imported into Google Ads via GA4 link
  const measurementId = process.env.NEXT_PUBLIC_GA_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (measurementId && apiSecret) {
    try {
      await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: booking.id.slice(0, 16),
          events: [{
            name: "purchase",
            params: {
              transaction_id: booking.id,
              value: booking.price || 0,
              currency: "CAD",
              items: [{ item_name: "Coupe", item_category: "barbershop", price: booking.price || 0, quantity: 1 }],
            },
          }],
        }),
      });
    } catch {}
  }

  // Google Ads Conversion API (direct) — requires AW conversion ID + label
  const conversionId = process.env.GOOGLE_ADS_CONVERSION_ID;
  const conversionLabel = process.env.GOOGLE_ADS_CONVERSION_LABEL;
  const googleAdsApiSecret = process.env.GOOGLE_ADS_API_SECRET;
  if (!conversionId || !conversionLabel || !googleAdsApiSecret) return;

  const customerId = conversionId.replace("AW-", "");
  try {
    await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}:uploadClickConversions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${googleAdsApiSecret}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
      },
      body: JSON.stringify({
        conversions: [{
          conversionAction: `customers/${customerId}/conversionActions/${conversionLabel}`,
          conversionDateTime: new Date(booking.created_at || Date.now()).toISOString().replace("T", " ").replace("Z", "+00:00"),
          conversionValue: booking.price || 0,
          currencyCode: "CAD",
          orderId: booking.id,
        }],
        partialFailure: true,
      }),
    });
  } catch {}
}
