/**
 * Création d'une pub Meta — pipeline complet (image → campagne → ensemble → créatif → pub).
 *
 * TOUT est créé sur PAUSE. Rien ne se diffuse et rien ne se dépense tant qu'un humain
 * n'a pas approuvé sur Telegram (activateAd). C'est la garde-fou principale : le code
 * peut préparer une pub, il ne peut pas la mettre en ligne tout seul.
 *
 * ⚠️ CATÉGORIE SPÉCIALE « EMPLOI »
 * Une offre d'emploi DOIT être déclarée (special_ad_categories: ["EMPLOYMENT"]). Depuis
 * 2026, Meta détecte aussi ce type de contenu dans l'IMAGE ; ne pas le déclarer est traité
 * comme une tentative de contournement (« Evasion »), ce qui peut sanctionner le compte.
 * La déclaration impose : aucun ciblage par âge ni par sexe, rayon minimum 25 km au Canada,
 * aucune exclusion géographique, aucun ciblage détaillé. Le ciblage ci-dessous respecte ça.
 */
import { AD_ACCOUNT_ID, isMetaAdsError, type MetaAdsError } from "@/lib/metaAds";

const GRAPH = "https://graph.facebook.com/v19.0";
const ACT = `act_${AD_ACCOUNT_ID}`;

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "577401682130596";

/** Beauport. Le rayon imposé (25 km) couvre tout Québec, donc la précision au mètre n'importe pas. */
const SHOP_LAT = 46.8565;
const SHOP_LNG = -71.1732;
const MIN_RADIUS_KM = 25; // minimum imposé par Meta pour la catégorie Emploi au Canada

/** Budget quotidien par défaut, en dollars. Modifiable à l'appel. */
export const DEFAULT_DAILY_BUDGET_CAD = 15;
/** Durée par défaut. Avec le budget quotidien, ça plafonne la dépense totale. */
export const DEFAULT_DURATION_DAYS = 10;

/** Plafond dur : jamais de budget quotidien au-delà, même si l'appelant se trompe. */
const MAX_DAILY_BUDGET_CAD = 50;

function token(): string {
  return process.env.FACEBOOK_SYSTEM_USER_TOKEN || "";
}

async function post<T>(path: string, body: Record<string, string>): Promise<T | MetaAdsError> {
  const t = token();
  if (t.length < 50) return { error: "FACEBOOK_SYSTEM_USER_TOKEN absent ou placeholder" };
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, access_token: t }).toString(),
      signal: AbortSignal.timeout(30000),
    });
    const data = (await res.json()) as T & { error?: { message?: string; code?: number; error_user_msg?: string } };
    if (data?.error) {
      const e = data.error;
      return { error: `Meta ${e.code ?? "?"}: ${e.error_user_msg || e.message || "erreur inconnue"}` };
    }
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "erreur réseau Meta" };
  }
}

// ── 1. Image ──────────────────────────────────────────────────────────────────

/**
 * Téléverse le visuel dans le compte pub et retourne son hash.
 * L'image est lue depuis le site (public/pub/...) : pas de fichier binaire dans le code.
 */
export async function uploadAdImage(imageUrl: string): Promise<string | MetaAdsError> {
  let base64: string;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return { error: `Image introuvable (${res.status}) : ${imageUrl}` };
    base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch (e) {
    return { error: `Lecture de l'image impossible : ${e instanceof Error ? e.message : "erreur"}` };
  }

  const r = await post<{ images?: Record<string, { hash?: string }> }>(`${ACT}/adimages`, { bytes: base64 });
  if (isMetaAdsError(r)) return r;

  const hash = Object.values(r.images || {})[0]?.hash;
  return hash ? hash : { error: "Meta n'a pas retourné de hash pour l'image" };
}

// ── 2→5. Campagne, ensemble, créatif, pub ─────────────────────────────────────

export type CreatedAd = {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  dailyBudget: number;
  durationDays: number;
  maxTotalSpend: number;
  previewUrl: string;
};

export type AdSpec = {
  /** Nom interne de la campagne (visible seulement dans le gestionnaire). */
  campaignName: string;
  /** Texte principal de la pub (ce que les gens lisent au-dessus de l'image). */
  message: string;
  /** URL publique du visuel. */
  imageUrl: string;
  dailyBudgetCad?: number;
  durationDays?: number;
};

/**
 * Crée la pub d'embauche complète, TOUT SUR PAUSE.
 * Retourne les identifiants pour l'aperçu et l'activation après approbation.
 */
export async function createEmploymentAd(spec: AdSpec): Promise<CreatedAd | MetaAdsError> {
  const dailyBudget = Math.min(
    Math.max(1, spec.dailyBudgetCad ?? DEFAULT_DAILY_BUDGET_CAD),
    MAX_DAILY_BUDGET_CAD
  );
  const durationDays = Math.min(Math.max(1, spec.durationDays ?? DEFAULT_DURATION_DAYS), 60);

  // 1. Visuel
  const imageHash = await uploadAdImage(spec.imageUrl);
  if (isMetaAdsError(imageHash)) return imageHash;

  // 2. Campagne — catégorie Emploi déclarée, sur PAUSE
  const campaign = await post<{ id?: string }>(`${ACT}/campaigns`, {
    name: spec.campaignName,
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",
    special_ad_categories: JSON.stringify(["EMPLOYMENT"]),
    special_ad_category_country: JSON.stringify(["CA"]),
    // Le budget vit sur l'ensemble de pubs (daily_budget plus bas), pas la campagne —
    // donc pas de partage de budget entre ensembles à activer.
    is_adset_budget_sharing_enabled: "false",
  });
  if (isMetaAdsError(campaign)) return campaign;
  const campaignId = campaign.id;
  if (!campaignId) return { error: "Campagne créée sans identifiant" };

  // 3. Ensemble de publicités — ciblage conforme Emploi (pas d'âge, pas de sexe, rayon 25 km)
  const endTime = new Date(Date.now() + durationDays * 86400_000).toISOString();
  const adSet = await post<{ id?: string }>(`${ACT}/adsets`, {
    name: `${spec.campaignName} — Québec 25 km`,
    campaign_id: campaignId,
    status: "PAUSED",
    daily_budget: String(Math.round(dailyBudget * 100)), // Meta veut des cents
    billing_event: "IMPRESSIONS",
    optimization_goal: "CONVERSATIONS",
    // Enchère automatique (Meta optimise seul dans le budget quotidien fixé) — sans ce
    // champ, Meta exige un montant d'enchère manuel qu'on ne veut pas gérer à la main.
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "MESSENGER",
    end_time: endTime,
    promoted_object: JSON.stringify({ page_id: PAGE_ID }),
    targeting: JSON.stringify({
      geo_locations: {
        custom_locations: [
          { latitude: SHOP_LAT, longitude: SHOP_LNG, radius: MIN_RADIUS_KM, distance_unit: "kilometer" },
        ],
      },
      // Emploi : 18-65+ obligatoire, tous les sexes, aucun ciblage détaillé.
      age_min: 18,
      age_max: 65,
    }),
  });
  if (isMetaAdsError(adSet)) return adSet;
  const adSetId = adSet.id;
  if (!adSetId) return { error: "Ensemble de publicités créé sans identifiant" };

  // 4. Créatif — clic vers Messenger
  const creative = await post<{ id?: string }>(`${ACT}/adcreatives`, {
    name: `${spec.campaignName} — visuel`,
    object_story_spec: JSON.stringify({
      page_id: PAGE_ID,
      link_data: {
        image_hash: imageHash,
        link: `https://m.me/${PAGE_ID}`,
        message: spec.message,
        call_to_action: {
          type: "LEARN_MORE",
          value: { app_destination: "MESSENGER" },
        },
      },
    }),
  });
  if (isMetaAdsError(creative)) return creative;
  const creativeId = creative.id;
  if (!creativeId) return { error: "Créatif créé sans identifiant" };

  // 5. La pub elle-même
  const ad = await post<{ id?: string }>(`${ACT}/ads`, {
    name: spec.campaignName,
    adset_id: adSetId,
    status: "PAUSED",
    creative: JSON.stringify({ creative_id: creativeId }),
  });
  if (isMetaAdsError(ad)) return ad;
  const adId = ad.id;
  if (!adId) return { error: "Publicité créée sans identifiant" };

  return {
    campaignId,
    adSetId,
    creativeId,
    adId,
    dailyBudget,
    durationDays,
    maxTotalSpend: Math.round(dailyBudget * durationDays * 100) / 100,
    previewUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCOUNT_ID}&selected_campaign_ids=${campaignId}`,
  };
}

// ── Activation (après approbation humaine) ────────────────────────────────────

/**
 * Met en ligne la pub approuvée : campagne + ensemble + pub passent à ACTIVE.
 * Appelé UNIQUEMENT depuis le bouton « Approuver » de Telegram.
 */
export async function activateAd(ids: {
  campaignId: string;
  adSetId: string;
  adId: string;
}): Promise<{ ok: true } | MetaAdsError> {
  for (const id of [ids.campaignId, ids.adSetId, ids.adId]) {
    if (!/^\d+$/.test(id)) return { error: `Identifiant invalide : ${id}` };
    const r = await post<{ success?: boolean }>(id, { status: "ACTIVE" });
    if (isMetaAdsError(r)) return r;
  }
  return { ok: true };
}

/** Supprime une pub refusée (campagne entière) — rien ne traîne dans le compte. */
export async function deleteCampaign(campaignId: string): Promise<{ ok: true } | MetaAdsError> {
  if (!/^\d+$/.test(campaignId)) return { error: "Identifiant de campagne invalide" };
  const r = await post<{ success?: boolean }>(campaignId, { status: "DELETED" });
  return isMetaAdsError(r) ? r : { ok: true };
}
