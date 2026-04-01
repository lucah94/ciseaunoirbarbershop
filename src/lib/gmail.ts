// Gmail API helper — reads/replies to emails in Melynda's inbox

export async function getGmailToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Gmail token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  date: string;
}

function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from.trim();
}

function decodeBase64(str: string): string {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts as typeof payload[]) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    for (const part of payload.parts as typeof payload[]) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

export async function fetchUnreadEmails(): Promise<GmailMessage[]> {
  const token = await getGmailToken();

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+in:inbox&maxResults=10",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  if (!listData.messages?.length) return [];

  const messages: GmailMessage[] = [];

  for (const { id } of listData.messages as { id: string }[]) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msg = await msgRes.json();
    const headers = msg.payload?.headers || [];
    const from = getHeader(headers, "from");

    messages.push({
      id,
      threadId: msg.threadId,
      from,
      fromEmail: extractEmail(from),
      subject: getHeader(headers, "subject"),
      body: extractBody(msg.payload || {}).slice(0, 2000),
      date: getHeader(headers, "date"),
    });
  }

  return messages;
}

export async function markAsRead(messageId: string): Promise<void> {
  const token = await getGmailToken();
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

export async function sendGmailReply(params: {
  threadId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const token = await getGmailToken();

  const replySubject = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;
  const rawEmail = [
    `To: ${params.to}`,
    `Subject: ${replySubject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `In-Reply-To: <${params.threadId}>`,
    `References: <${params.threadId}>`,
    "",
    params.body,
  ].join("\r\n");

  const encoded = Buffer.from(rawEmail).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded, threadId: params.threadId }),
  });
}
