import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteFacebookPost } from "@/lib/posts";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Find posted rows whose expires_at has passed and have a fb_post_id
  const { data: expired, error } = await supabaseAdmin
    .from("pending_posts")
    .select("id, fb_post_id")
    .eq("status", "posted")
    .not("expires_at", "is", null)
    .not("fb_post_id", "is", null)
    .lt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!expired?.length) {
    return NextResponse.json({ ok: true, expired: 0 });
  }

  const results: { id: string; deleted: boolean }[] = [];

  for (const row of expired) {
    const deleted = await deleteFacebookPost(row.fb_post_id as string);
    await supabaseAdmin
      .from("pending_posts")
      .update({ status: "expired" })
      .eq("id", row.id);
    results.push({ id: row.id as string, deleted });
  }

  return NextResponse.json({ ok: true, expired: results.length, results });
}
