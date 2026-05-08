import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  const mimeType = file.type || "image/jpeg";
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `photos/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  // Try to upload to Supabase Storage bucket "portfolio"
  let { data, error } = await supabaseAdmin.storage
    .from("portfolio")
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  // If bucket doesn't exist, create it and retry
  if (error && (error.message.includes("not found") || error.message.includes("does not exist") || error.message.includes("bucket"))) {
    await supabaseAdmin.storage.createBucket("portfolio", { public: true });
    const retry = await supabaseAdmin.storage
      .from("portfolio")
      .upload(filePath, fileBuffer, { contentType: mimeType, upsert: false });
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    // Fallback: return base64 data URL so the photo can still be used
    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return NextResponse.json({ url: dataUrl });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("portfolio")
    .getPublicUrl(data.path);

  return NextResponse.json({ url: urlData.publicUrl });
}
