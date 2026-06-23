import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getFacebookToken, refreshFacebookToken, isFbTokenError } from "@/lib/fbToken";
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { commentId, message } = await req.json();

  if (!commentId || !message) {
    return NextResponse.json({ error: "commentId et message requis" }, { status: 400 });
  }

  const doReply = async (tok: string) => {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${commentId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: tok }),
      }
    );
    return (await res.json()) as { id?: string; error?: { message?: string; code?: number; type?: string } };
  };

  try {
    let token = await getFacebookToken();
    let data = await doReply(token);
    // AUTO-RÉPARATION : token mort → on re-dérive un token frais et on RÉESSAIE une fois.
    if (data.error && isFbTokenError(data.error)) {
      const fresh = await refreshFacebookToken();
      if (fresh) {
        token = fresh;
        data = await doReply(token);
      }
    }
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
    const token = await getFacebookToken();
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${commentId}?access_token=${token}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
