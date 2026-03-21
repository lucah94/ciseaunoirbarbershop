import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { postToGoogleMyBusiness } from "@/lib/google";

const PAGE_ID = process.env.FACEBOOK_PAGE_ID!;
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Day of week → content type rotation
const CONTENT_TYPES: Record<number, string[]> = {
  2: ["promotion", "service_highlight"],       // Tuesday
  3: ["tip", "client_appreciation"],            // Wednesday
  4: ["promotion", "tip"],                      // Thursday
  5: ["service_highlight", "client_appreciation"], // Friday
  6: ["promotion", "inspirational"],            // Saturday
};

function getContentTypeForDay(dayOfWeek: number, postIndex: number): string {
  const types = CONTENT_TYPES[dayOfWeek] || ["promotion"];
  return types[postIndex % types.length];
}

const CONTENT_PROMPTS: Record<string, string> = {
  promotion: `Génère une publication Facebook promotionnelle pour Ciseau Noir Barbershop à Québec.
Mentionne une offre spéciale, un service ou incite à réserver en ligne sur ciseunoirbarbershop.com.
Utilise des emojis appropriés. 2-4 phrases max. En français.`,

  service_highlight: `Génère une publication Facebook qui met en avant un service spécifique de Ciseau Noir Barbershop.
Choisis aléatoirement parmi : Coupe adulte (35$), Coupe + Barbe (45$), Coupe enfant (25$), Barbe (20$), Coupe + Lavage (35$).
Décris le service avec enthousiasme. Inclus les coiffeurs Melynda et Diodis. Utilise des emojis. 3-4 phrases. En français.`,

  tip: `Génère un conseil de coiffure ou de soin de barbe pour les clients de Ciseau Noir Barbershop.
Partage un conseil professionnel utile. Mentionne que les experts Melynda et Diodis peuvent aider.
Utilise des emojis. 3-4 phrases. En français.`,

  client_appreciation: `Génère un message de remerciement chaleureux envers les clients de Ciseau Noir Barbershop.
Exprime de la gratitude, invite à laisser un avis Google, et encourage à revenir.
Utilise des emojis. 2-3 phrases. En français.`,

  inspirational: `Génère un message inspirationnel ou motivant lié à la confiance en soi, l'apparence et le style pour Ciseau Noir Barbershop.
Relie cela aux services du salon. Utilise des emojis. 2-3 phrases. En français.`,
};

async function generatePostContent(contentType: string, dayOfWeek: number): Promise<string> {
  const dayNames: Record<number, string> = {
    2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi",
  };
  const dayName = dayNames[dayOfWeek] || "aujourd'hui";

  const prompt = `${CONTENT_PROMPTS[contentType] || CONTENT_PROMPTS.promotion}

Contexte: Nous sommes ${dayName}.
Informations:
- Adresse: 375 Boul. des Chutes, Québec
- Téléphone: (418) 665-5703
- Site: ciseunoirbarbershop.com
- Horaires du jour: ${dayOfWeek === 2 || dayOfWeek === 3 ? "8h30-16h30" : dayOfWeek === 4 || dayOfWeek === 5 ? "8h30-20h30" : "8h30-16h30"}

Génère uniquement le texte de la publication, sans guillemets ni introduction.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text || "✂️ Ciseau Noir — Votre barbershop à Québec ! Réservez en ligne sur ciseunoirbarbershop.com";
}

async function postToFacebook(message: string): Promise<{ id?: string; error?: string }> {
  const res = await fetch(`https://graph.facebook.com/v19.0/${PAGE_ID}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: TOKEN }),
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  // Authorization check
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Check configuration
  if (!PAGE_ID || !TOKEN) {
    return NextResponse.json({ error: "Facebook credentials manquants" }, { status: 500 });
  }

  // Get current day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Only run on open days (Tue=2, Wed=3, Thu=4, Fri=5, Sat=6)
  const openDays = [2, 3, 4, 5, 6];
  if (!openDays.includes(dayOfWeek)) {
    return NextResponse.json({
      ok: false,
      reason: "Closed day — no post made",
      dayOfWeek,
    });
  }

  // Determine how many posts to make (from query param, default 1)
  const timesPerDay = Math.min(parseInt(req.nextUrl.searchParams.get("times") || "1"), 2);

  const results = [];

  for (let i = 0; i < timesPerDay; i++) {
    const contentType = getContentTypeForDay(dayOfWeek, i);
    try {
      const content = await generatePostContent(contentType, dayOfWeek);
      const fbResult = await postToFacebook(content);

      // Post to Google My Business if configured
      let gmbResult: { success: boolean; error?: string } | null = null;
      if (process.env.GOOGLE_LOCATION_NAME) {
        try {
          gmbResult = await postToGoogleMyBusiness(content);
        } catch (gmbErr) {
          gmbResult = { success: false, error: String(gmbErr) };
        }
      }

      if (fbResult.error) {
        results.push({ index: i + 1, contentType, ok: false, error: fbResult.error, gmb: gmbResult });
      } else {
        results.push({ index: i + 1, contentType, ok: true, postId: fbResult.id, preview: content.slice(0, 100) + "...", gmb: gmbResult });
      }
    } catch (e) {
      results.push({ index: i + 1, contentType, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({
    ok: results.every(r => r.ok),
    dayOfWeek,
    posts: results,
  });
}
