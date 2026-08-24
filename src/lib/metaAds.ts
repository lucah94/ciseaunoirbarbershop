/**
 * Lecture du compte publicitaire Meta (Facebook/Instagram) du Ciseau Noir.
 *
 * Ancre = FACEBOOK_SYSTEM_USER_TOKEN (le même token système permanent que Messenger),
 * qui porte le scope ads_management. Le compte pub doit être affecté à l'utilisateur
 * système « Ciseau Noir Bot » dans le portefeuille business — sinon /me/adaccounts
 * renvoie 0 compte et tout ici échoue proprement (voir /api/health → meta_ads).
 *
 * LECTURE SEULE. Aucune fonction de ce module ne crée, modifie ni active de campagne :
 * rien ici ne peut dépenser un sou.
 */

const GRAPH = "https://graph.facebook.com/v19.0";

/** Compte pub du barbershop. Un ID de compte pub n'est pas un secret (pas de fuite ici). */
export const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "365081234060681";

const ACT = `act_${AD_ACCOUNT_ID}`;

export type MetaAdsError = { error: string };

/** Meta renvoie les budgets en unités mineures (cents CAD). */
function centsToDollars(v?: string | number | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) / 100 : null;
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T | MetaAdsError> {
  const token = process.env.FACEBOOK_SYSTEM_USER_TOKEN || "";
  if (token.length < 50) return { error: "FACEBOOK_SYSTEM_USER_TOKEN absent ou placeholder" };

  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  try {
    const res = await fetch(`${GRAPH}/${path}?${qs}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as T & { error?: { message?: string; code?: number } };
    if (data?.error) {
      return { error: `Meta ${data.error.code ?? "?"}: ${data.error.message ?? "erreur inconnue"}` };
    }
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "erreur réseau Meta" };
  }
}

export function isMetaAdsError<T>(r: T | MetaAdsError): r is MetaAdsError {
  return typeof r === "object" && r !== null && "error" in r;
}

// ── Résumé du compte ──────────────────────────────────────────────────────────

export type AccountSummary = {
  id: string;
  name: string;
  currency: string;
  /** Total dépensé depuis TOUJOURS sur ce compte. */
  totalSpentEver: number | null;
  /** Plafond de dépense du compte, s'il y en a un. */
  spendCap: number | null;
  statusCode: number | null;
};

export async function getAccountSummary(): Promise<AccountSummary | MetaAdsError> {
  const r = await graphGet<{
    id?: string;
    name?: string;
    currency?: string;
    amount_spent?: string;
    spend_cap?: string;
    account_status?: number;
  }>(ACT, { fields: "id,name,currency,amount_spent,spend_cap,account_status" });

  if (isMetaAdsError(r)) return r;
  return {
    id: r.id || ACT,
    name: r.name || AD_ACCOUNT_ID,
    currency: r.currency || "CAD",
    totalSpentEver: centsToDollars(r.amount_spent),
    spendCap: centsToDollars(r.spend_cap),
    statusCode: r.account_status ?? null,
  };
}

// ── Dépense par mois ──────────────────────────────────────────────────────────

export type MonthlySpend = {
  month: string; // AAAA-MM
  since: string;
  until: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  /** Coût par clic sur lien, calculé (null si aucun clic). */
  costPerClick: number | null;
};

/** Premier jour du mois, N mois en arrière, en AAAA-MM-JJ. */
function firstOfMonthAgo(monthsBack: number): string {
  const d = new Date();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1));
  return target.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dépense mensuelle sur les N derniers mois (mois courant inclus).
 * Meta limite l'historique à 37 mois.
 */
export async function getMonthlySpend(months = 6): Promise<MonthlySpend[] | MetaAdsError> {
  const safeMonths = Math.min(Math.max(1, Math.floor(months)), 36);
  const r = await graphGet<{
    data?: {
      spend?: string;
      impressions?: string;
      clicks?: string;
      reach?: string;
      date_start?: string;
      date_stop?: string;
    }[];
  }>(`${ACT}/insights`, {
    level: "account",
    time_increment: "monthly",
    fields: "spend,impressions,clicks,reach",
    time_range: JSON.stringify({ since: firstOfMonthAgo(safeMonths - 1), until: today() }),
    limit: "50",
  });

  if (isMetaAdsError(r)) return r;

  return (r.data || []).map((row) => {
    const spend = toNum(row.spend);
    const clicks = toNum(row.clicks);
    return {
      month: (row.date_start || "").slice(0, 7),
      since: row.date_start || "",
      until: row.date_stop || "",
      spend,
      impressions: toNum(row.impressions),
      clicks,
      reach: toNum(row.reach),
      costPerClick: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : null,
    };
  });
}

// ── Campagnes ─────────────────────────────────────────────────────────────────

export type Campaign = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  /** Budget quotidien en $ (null si le budget est au niveau de l'ensemble de pubs). */
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  startTime: string | null;
  stopTime: string | null;
};

export async function listCampaigns(): Promise<Campaign[] | MetaAdsError> {
  const r = await graphGet<{
    data?: {
      id?: string;
      name?: string;
      status?: string;
      effective_status?: string;
      objective?: string;
      daily_budget?: string;
      lifetime_budget?: string;
      start_time?: string;
      stop_time?: string;
    }[];
  }>(`${ACT}/campaigns`, {
    fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "50",
  });

  if (isMetaAdsError(r)) return r;

  return (r.data || []).map((c) => ({
    id: c.id || "",
    name: c.name || "(sans nom)",
    status: c.status || "?",
    effectiveStatus: c.effective_status || "?",
    objective: c.objective || "?",
    dailyBudget: centsToDollars(c.daily_budget),
    lifetimeBudget: centsToDollars(c.lifetime_budget),
    startTime: c.start_time || null,
    stopTime: c.stop_time || null,
  }));
}

/**
 * Somme des budgets quotidiens des campagnes RÉELLEMENT actives.
 * C'est la vraie réponse à « ça me coûte combien par mois » côté engagement :
 * budget quotidien actif × 30,4 jours = dépense mensuelle si tout roule à plein.
 */
export function activeDailyBudget(campaigns: Campaign[]): {
  perDay: number;
  perMonth: number;
  activeCount: number;
} {
  const active = campaigns.filter((c) => c.effectiveStatus === "ACTIVE");
  const perDay = active.reduce((sum, c) => sum + (c.dailyBudget || 0), 0);
  return {
    perDay: Math.round(perDay * 100) / 100,
    perMonth: Math.round(perDay * 30.4 * 100) / 100,
    activeCount: active.length,
  };
}
