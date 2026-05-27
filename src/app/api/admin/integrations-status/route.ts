import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const integrations = [
    {
      name: "Google Analytics 4",
      key: "GA4",
      configured: !!process.env.NEXT_PUBLIC_GA_ID,
      details: process.env.NEXT_PUBLIC_GA_ID ? `ID: ${process.env.NEXT_PUBLIC_GA_ID}` : "Manquant: NEXT_PUBLIC_GA_ID",
      what: "Tracking visiteurs + événements purchase auto",
    },
    {
      name: "Google Ads (via GA4 Measurement Protocol)",
      key: "GA4_MP",
      configured: !!process.env.GA4_API_SECRET,
      details: process.env.GA4_API_SECRET ? "API secret configuré" : "Manquant: GA4_API_SECRET (créer dans GA4 Admin → Data Streams → Measurement Protocol API secrets)",
      what: "Conversions serveur (offline) envoyées à Google Ads via GA4",
    },
    {
      name: "Meta Pixel (Facebook + Instagram)",
      key: "META_PIXEL",
      configured: !!process.env.NEXT_PUBLIC_FB_PIXEL_ID,
      details: process.env.NEXT_PUBLIC_FB_PIXEL_ID ? `Pixel ID: ${process.env.NEXT_PUBLIC_FB_PIXEL_ID}` : "Manquant: NEXT_PUBLIC_FB_PIXEL_ID (Business Manager → Pixels)",
      what: "Tracking visiteurs côté client + events Schedule/Purchase",
    },
    {
      name: "Meta Conversions API (CAPI)",
      key: "META_CAPI",
      configured: !!(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN),
      details: process.env.META_ACCESS_TOKEN ? "Token configuré" : "Manquant: META_PIXEL_ID + META_ACCESS_TOKEN",
      what: "Events serveur dédupliqués avec pixel client — résistant aux ad blockers",
    },
    {
      name: "Google My Business Posts",
      key: "GMB_POSTS",
      configured: !!(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_LOCATION_NAME),
      details: process.env.GOOGLE_LOCATION_NAME ? "Location configurée" : "Manquant: GOOGLE_LOCATION_NAME",
      what: "Auto-post hebdo + auto-réponse aux avis Google",
    },
    {
      name: "Composio (FB+IG auto-post)",
      key: "COMPOSIO",
      configured: !!process.env.COMPOSIO_API_KEY,
      details: process.env.COMPOSIO_API_KEY ? "API key configuré" : "Manquant: COMPOSIO_API_KEY",
      what: "Publication Facebook + Instagram via cron auto-post",
    },
    {
      name: "Twilio SMS",
      key: "TWILIO",
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
      details: process.env.TWILIO_PHONE_NUMBER ? `From: ${process.env.TWILIO_PHONE_NUMBER}` : "Manquant: TWILIO credentials",
      what: "SMS rappels, rebooking, win-back, anniversaire",
    },
    {
      name: "Resend Email",
      key: "RESEND",
      configured: !!process.env.RESEND_API_KEY,
      details: process.env.RESEND_API_KEY ? "API key configuré" : "Manquant: RESEND_API_KEY",
      what: "Confirmations email, newsletter mensuelle, anniversaire",
    },
    {
      name: "Telegram Bot",
      key: "TELEGRAM",
      configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_GROUP_CHAT_ID),
      details: process.env.TELEGRAM_GROUP_CHAT_ID ? `Group: ${process.env.TELEGRAM_GROUP_CHAT_ID}` : "Manquant: TELEGRAM_BOT_TOKEN",
      what: "Notifications RDV + approbation emails sortants",
    },
    {
      name: "OpenRouter (DeepSeek)",
      key: "OPENROUTER",
      configured: !!process.env.OPENROUTER_API_KEY,
      details: process.env.OPENROUTER_API_KEY ? "API key configuré (10x moins cher)" : "Manquant: OPENROUTER_API_KEY (fallback Claude direct)",
      what: "AI génération posts, emails, réponses avis (DeepSeek via OpenRouter)",
    },
    {
      name: "Anthropic Claude (direct)",
      key: "ANTHROPIC",
      configured: !!process.env.ANTHROPIC_API_KEY,
      details: process.env.ANTHROPIC_API_KEY ? "API key configuré" : "Manquant: ANTHROPIC_API_KEY (utilise OpenRouter sinon)",
      what: "AI Figaro assistant + génération contenu",
    },
  ];

  const summary = {
    total: integrations.length,
    active: integrations.filter(i => i.configured).length,
    inactive: integrations.filter(i => !i.configured).length,
  };

  return NextResponse.json({ summary, integrations });
}
