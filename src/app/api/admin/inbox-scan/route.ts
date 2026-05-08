import { NextRequest, NextResponse } from "next/server";
import { fetchAllInboxEmails } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Use metadata-only fetch for speed (no full body)
  const { getGmailToken } = await import("@/lib/gmail");
  const token = await getGmailToken();

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=100",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  const msgList = listData.messages || [];

  const emails: { id: string; from: string; fromEmail: string; subject: string }[] = [];
  for (const { id } of msgList as { id: string }[]) {
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const m = await r.json();
    const headers: Record<string, string> = {};
    for (const h of m.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;
    const from = headers["from"] || "";
    const match = from.match(/<(.+?)>/);
    const fromEmail = match ? match[1] : from.trim();
    emails.push({ id, from, fromEmail, subject: headers["subject"] || "(sans sujet)" });
  }

  // Analyze senders
  const senderMap: Record<string, { count: number; subjects: string[] }> = {};
  for (const e of emails) {
    const key = e.fromEmail || e.from;
    if (!senderMap[key]) senderMap[key] = { count: 0, subjects: [] };
    senderMap[key].count++;
    if (senderMap[key].subjects.length < 3) senderMap[key].subjects.push(e.subject);
  }

  // Categorize
  const spamKeywords = ["unsubscribe", "désabonner", "newsletter", "promo", "offre", "deal", "sale", "no-reply", "noreply", "notification", "donotreply", "marketing", "info@", "news@", "update@", "alert@"];
  const importantKeywords = ["assurance", "banque", "impôt", "legal", "avocat", "gouvernement", "bail", "contrat", "facture", "urgent", "invoice", "supabase", "vercel", "twilio", "resend", "stripe"];

  const spam: typeof emails = [];
  const notifications: typeof emails = [];
  const important: typeof emails = [];
  const other: typeof emails = [];

  for (const e of emails) {
    const text = `${e.from} ${e.subject} ${e.fromEmail}`.toLowerCase();
    if (importantKeywords.some(k => text.includes(k))) {
      important.push(e);
    } else if (spamKeywords.some(k => text.includes(k))) {
      spam.push(e);
    } else if (e.fromEmail.includes("noreply") || e.fromEmail.includes("no-reply") || e.fromEmail.includes("notification")) {
      notifications.push(e);
    } else {
      other.push(e);
    }
  }

  return NextResponse.json({
    total: emails.length,
    categories: {
      important: important.map(e => ({ from: e.from, subject: e.subject, id: e.id })),
      other: other.map(e => ({ from: e.from, subject: e.subject, id: e.id })),
      notifications: notifications.map(e => ({ from: e.from, subject: e.subject, id: e.id })),
      spam: spam.map(e => ({ from: e.from, subject: e.subject, id: e.id })),
    },
    senders: Object.entries(senderMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([email, data]) => ({ email, ...data })),
  });
}
