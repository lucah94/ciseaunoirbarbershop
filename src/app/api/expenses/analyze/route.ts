import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ["Loyer", "Produits", "Équipement", "Marketing", "Téléphone", "Assurances", "Salaires", "Employés", "Autre"];

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "Fichiers requis" }, { status: 400 });

  const results = await Promise.all(files.map(async (file) => {
    // Upload photo vers Supabase Storage
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const bytes = await file.arrayBuffer();
    await supabaseAdmin.storage.from("receipts").upload(filename, bytes, { contentType: file.type });
    const { data: urlData } = supabaseAdmin.storage.from("receipts").getPublicUrl(filename);
    const receiptUrl = urlData.publicUrl;

    // Convertir en base64 pour Claude
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    // Analyser avec Claude Vision
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: `Analyse ce reçu/facture et retourne UNIQUEMENT un JSON valide avec ces champs:
{
  "description": "nom du fournisseur ou description courte",
  "amount": 0.00,
  "category": "une de: ${CATEGORIES.join(", ")}",
  "date": "YYYY-MM-DD"
}
Si tu ne peux pas lire une valeur, utilise null. Retourne seulement le JSON, rien d'autre.`
          }
        ]
      }]
    });

    let extracted = { description: "", amount: 0, category: "Autre", date: new Date().toISOString().split("T")[0] };
    try {
      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const json = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (json.description) extracted.description = json.description;
      if (json.amount) extracted.amount = parseFloat(json.amount);
      if (json.category && CATEGORIES.includes(json.category)) extracted.category = json.category;
      if (json.date) extracted.date = json.date;
    } catch {}

    return { ...extracted, receipt_url: receiptUrl };
  }));

  return NextResponse.json(results);
}
