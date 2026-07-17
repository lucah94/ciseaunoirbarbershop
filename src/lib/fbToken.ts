/**
 * Auto-réparation du token Facebook de PAGE.
 *
 * Ancre = FACEBOOK_SYSTEM_USER_TOKEN (token System User permanent, expire "Jamais").
 * À partir de cette ancre, on dérive le token de PAGE (qui, lui, peut occasionnellement
 * être invalidé par Facebook). Si le token de page hoquette, on le RE-DÉRIVE tout seul
 * depuis le token système — donc le bot ne reste jamais cassé.
 *
 * Priorité de lecture : cache mémoire frais → cache DB frais → re-dérivation → env (fallback).
 */
import { supabaseAdmin } from "@/lib/supabase";

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || "577401682130596";
const GRAPH = "https://graph.facebook.com/v19.0";
const CACHE_KEY = "fb_page_token";
const TTL_MS = 6 * 60 * 60 * 1000; // re-dérive au max aux 6h

let memCache: { token: string; at: number } | null = null;

/** Dérive un token de page frais depuis le token System User permanent. */
async function derivePageToken(): Promise<string | null> {
  const sut = process.env.FACEBOOK_SYSTEM_USER_TOKEN;
  if (!sut) return null;
  try {
    const res = await fetch(`${GRAPH}/${PAGE_ID}?fields=access_token&access_token=${sut}`);
    const data = (await res.json()) as { access_token?: string; error?: unknown };
    if (data?.access_token) return data.access_token;
  } catch {
    /* réseau — on retombera sur le fallback */
  }
  return null;
}

/** Stocke le token dérivé en DB (cache partagé entre les fonctions serverless). */
async function storeToken(token: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("app_settings")
      .upsert({ key: CACHE_KEY, value: token, updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch {
    /* best-effort : un échec de cache ne doit jamais casser l'appel */
  }
}

/**
 * Retourne un token de page valide.
 * Re-dérive automatiquement depuis le token système quand le cache est périmé.
 */
export async function getFacebookToken(): Promise<string> {
  const now = Date.now();
  if (memCache && now - memCache.at < TTL_MS) return memCache.token;

  // Cache DB
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", CACHE_KEY)
      .maybeSingle();
    if (data?.value && data.updated_at && now - new Date(data.updated_at).getTime() < TTL_MS) {
      memCache = { token: data.value, at: now };
      return data.value;
    }
  } catch {
    /* ignore — on tente la re-dérivation */
  }

  // Re-dérivation depuis l'ancre permanente
  const fresh = await derivePageToken();
  if (fresh) {
    memCache = { token: fresh, at: now };
    await storeToken(fresh);
    return fresh;
  }

  // Fallback : token de page statique en env (ou dernier token mémoire)
  return process.env.FACEBOOK_ACCESS_TOKEN || memCache?.token || "";
}

/**
 * Force une re-dérivation immédiate (appelée par le cron fb-token-refresh,
 * ET après une erreur de token côté appel Facebook).
 * Retourne le nouveau token, ou null si l'ancre système est indisponible.
 */
export async function refreshFacebookToken(): Promise<string | null> {
  const fresh = await derivePageToken();
  if (fresh) {
    memCache = { token: fresh, at: Date.now() };
    await storeToken(fresh);
    return fresh;
  }
  return null;
}

/**
 * Vérifie EN LIGNE qu'un token de page fonctionne vraiment (appel Graph /me).
 * Sert au health-check du cron : distingue "token vivant" d'un placeholder / token mort.
 * Retourne { ok, hasAnchor } — hasAnchor=false = le token System User n'est même pas configuré
 * (ou vaut un placeholder), donc l'auto-réparation est IMPOSSIBLE tant que Melynda n'agit pas.
 */
export async function checkFacebookTokenHealth(): Promise<{ ok: boolean; hasAnchor: boolean }> {
  const sut = process.env.FACEBOOK_SYSTEM_USER_TOKEN || "";
  // Un vrai token Facebook fait ~150-250 caractères. Un placeholder ("[SENSITIVE]", "", "set"…)
  // n'a rien à faire ici : inutile d'appeler Graph, l'ancre est absente.
  const hasAnchor = sut.length > 50;
  const token = await getFacebookToken();
  if (!token || token.length < 50) return { ok: false, hasAnchor };
  try {
    const res = await fetch(`${GRAPH}/me?fields=id&access_token=${encodeURIComponent(token)}`);
    return { ok: res.ok, hasAnchor };
  } catch {
    // Erreur réseau ≠ token mort → on ne conclut pas à un échec de token.
    return { ok: true, hasAnchor };
  }
}

/** Détecte une erreur de token Facebook (expiré/invalide) dans une réponse Graph. */
export function isFbTokenError(err: unknown): boolean {
  const e = err as { code?: number; type?: string; message?: string } | undefined;
  if (!e) return false;
  // 190 = access token expired/invalid ; 102 = session ; 10/200 = permissions
  return e.code === 190 || e.code === 102 || e.type === "OAuthException";
}
