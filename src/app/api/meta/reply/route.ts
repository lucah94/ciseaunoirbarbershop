import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;

function requireAdmin(req: NextRequest) {
  const auth = req.cookies.get("admin_auth");
  if (!auth || auth.value !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { commentId, message } = await req.json();

  if (!commentId || !message) {
    return NextResponse.json({ error: "commentId et message requis" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${commentId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: TOKEN }),
      }
    );
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { commentId } = await req.json();
  if (!commentId) return NextResponse.json({ error: "commentId requis" }, { status: 400 });

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${commentId}?access_token=${TOKEN}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
