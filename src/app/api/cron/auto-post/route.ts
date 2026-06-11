import { NextRequest, NextResponse } from "next/server";
import { postToGoogleMyBusiness } from "@/lib/google";
import type Anthropic from "@anthropic-ai/sdk";
import { aiClient as anthropic, MODELS } from "@/lib/ai";
import { isComposioConfigured, composioFacebookPost, composioInstagramPost } from "@/lib/composio";
import { notifySystemAlert } from "@/lib/telegram";
export const dynamic = 'force-dynamic';

// AUCUNE publication sans l'accord de Melynda. Le cron propose le texte sur Telegram, point.
const REQUIRE_APPROVAL = true;

export const maxDuration = 120;

const PAGE_ID = process.env.FACEBOOK_PAGE_ID!;
const TOKEN = process.env.FACEBOOK_ACCESS_TOKEN!;


// Day of week → content type rotation
// Contenu varié — PAS toujours des promos. Promo seulement le samedi.
const CONTENT_TYPES: Record<number, string[]> = {
  2: ["tip"],                  // Mardi — conseil
  3: ["service_highlight"],    // Mercredi — un service
  4: ["product"],              // Jeudi — produits en salon
  5: ["client_appreciation"],  // Vendredi — merci aux clients
  6: ["promotion"],            // Samedi — promo
};

function getContentTypeForDay(dayOfWeek: number, postIndex: number): string {
  const types = CONTENT_TYPES[dayOfWeek] || ["promotion"];
  return types[postIndex % types.length];
}

const CONTENT_PROMPTS: Record<string, string> = {
  promotion: `Génère une publication Facebook promotionnelle pour Ciseau Noir Barbershop à Québec.
La SEULE offre permise : le forfait VIP (Service Premium — prix normal 75$) en PROMO à 65$. N'invente AUCUN autre rabais, cadeau, gratuité, concours ni prix. Le prix VIP normal est 75$, jamais 50$.
Incite à réserver en ligne sur ciseaunoirbarbershop.com. Emojis appropriés. 2-4 phrases max. En français.`,

  service_highlight: `Génère une publication Facebook qui met en avant un service de Ciseau Noir Barbershop.
Utilise UNIQUEMENT ces vrais prix : Coupe + Lavage 35$, Coupe + Barbe + Lavage 50$, Service Premium 75$, Rasage / Barbe 25$, Étudiant / Enfant 30$. N'invente AUCUN prix ni rabais.
Décris le service avec enthousiasme. Emojis. 3-4 phrases. En français.`,

  tip: `Génère un conseil de coiffure ou de soin de barbe pour les clients de Ciseau Noir Barbershop.
Partage un conseil professionnel utile. Mentionne que Melynda peut aider.
Utilise des emojis. 3-4 phrases. En français.`,

  client_appreciation: `Génère un message de remerciement chaleureux envers les clients de Ciseau Noir Barbershop.
Exprime de la gratitude, invite à laisser un avis Google, et encourage à revenir.
Utilise des emojis. 2-3 phrases. En français.`,

  inspirational: `Génère un message inspirationnel ou motivant lié à la confiance en soi, l'apparence et le style pour Ciseau Noir Barbershop.
Relie cela aux services du salon. Utilise des emojis. 2-3 phrases. En français.`,

  product: `Génère une publication Facebook qui parle des produits de soin disponibles EN SALON chez Ciseau Noir (ex: pommades, huiles à barbe, soins capillaires). N'invente AUCUN prix, rabais ni produit précis non confirmé — reste général. Invite à venir voir/demander en salon. Emojis. 2-3 phrases. En français.`,
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
- Site: ciseaunoirbarbershop.com
- Horaires du jour: ${dayOfWeek === 2 || dayOfWeek === 3 ? "8h30-16h30" : dayOfWeek === 4 || dayOfWeek === 5 ? "8h30-20h30" : "8h30-16h30"}

Génère uniquement le texte de la publication, sans guillemets ni introduction.`;

  // BALANCED = DeepSeek via OpenRouter si configuré (10x moins cher que Claude Opus)
  const response = await anthropic.messages.create({
    model: MODELS.BALANCED,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text || "✂️ Ciseau Noir — Votre barbershop à Québec ! Réservez en ligne sur ciseaunoirbarbershop.com";
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

  // Check configuration — Composio OU Facebook Graph API requis
  const useComposio = isComposioConfigured();
  if (!useComposio && (!PAGE_ID || !TOKEN)) {
    return NextResponse.json({ error: "Facebook credentials manquants (FACEBOOK_PAGE_ID + FACEBOOK_ACCESS_TOKEN ou COMPOSIO_API_KEY requis)" }, { status: 500 });
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

      // ── APPROBATION OBLIGATOIRE : on propose le texte sur Telegram, on ne publie RIEN ─
      if (REQUIRE_APPROVAL) {
        await notifySystemAlert(`📢 <b>Proposition de publication (${contentType})</b>\n\n${content}\n\n⚠️ <i>Rien n'est publié automatiquement. Copie ce texte pour le publier toi-même si tu l'approuves.</i>`).catch(() => {});
        results.push({ index: i + 1, contentType, ok: true, pendingApproval: true, preview: content.slice(0, 120) });
        continue;
      }

      // ── Publication Facebook : Composio en primaire, Graph API en fallback ─
      let fbOk = false;
      let fbPostId: string | undefined;
      let fbError: string | undefined;
      let fbChannel: "composio" | "graph_api" = "composio";

      if (useComposio) {
        const composioResult = await composioFacebookPost(content);
        if (composioResult.success) {
          fbOk = true;
          fbPostId = (composioResult.data as { postId?: string })?.postId;
        } else {
          // Fallback vers Facebook Graph API si Composio échoue
          fbError = composioResult.error;
          if (PAGE_ID && TOKEN) {
            fbChannel = "graph_api";
            const graphResult = await postToFacebook(content);
            if (!graphResult.error) {
              fbOk = true;
              fbPostId = graphResult.id;
              fbError = undefined;
            } else {
              fbError = `composio: ${fbError} | graph_api: ${graphResult.error}`;
            }
          }
        }
      } else {
        fbChannel = "graph_api";
        const graphResult = await postToFacebook(content);
        fbOk = !graphResult.error;
        fbPostId = graphResult.id;
        fbError = graphResult.error;
      }

      // ── Instagram via Composio (bonus si configuré) ────────────────────────
      let igResult: { success: boolean; error?: string } | null = null;
      if (useComposio) {
        try {
          const igRes = await composioInstagramPost(content);
          igResult = { success: igRes.success, error: igRes.error };
        } catch (igErr) {
          igResult = { success: false, error: String(igErr) };
        }
      }

      // ── Google My Business (si configuré) ─────────────────────────────────
      let gmbResult: { success: boolean; error?: string } | null = null;
      if (process.env.GOOGLE_LOCATION_NAME) {
        try {
          gmbResult = await postToGoogleMyBusiness(content);
        } catch (gmbErr) {
          gmbResult = { success: false, error: String(gmbErr) };
        }
      }

      results.push({
        index: i + 1,
        contentType,
        ok: fbOk,
        postId: fbPostId,
        channel: fbChannel,
        ...(fbError ? { error: fbError } : {}),
        preview: content.slice(0, 100) + "...",
        instagram: igResult,
        gmb: gmbResult,
      });
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
