import { supabaseAdmin } from "@/lib/supabase";
import { notifySystemAlert } from "@/lib/telegram";

/**
 * Wrapper de traçabilité pour les crons.
 *
 * Enregistre chaque exécution dans la table `cron_executions` :
 *   id (uuid auto) | cron_name | started_at | finished_at | status | duration_ms | detail
 *
 * - Succès → status='ok', detail = aperçu tronqué (300 chars) du résultat.
 * - Erreur → status='error', detail = message d'erreur, alerte Telegram, PUIS rethrow
 *            (on ne masque jamais l'erreur au cron / à Vercel).
 *
 * ROBUSTESSE : toute défaillance du logging lui-même (insert/update) est avalée —
 * jamais elle ne doit faire planter le cron. Seul le `fn()` peut faire échouer la fonction.
 */
export async function runCron<T>(cronName: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  let logId: string | null = null;

  // ── Insert "début" (best-effort) ───────────────────────────────────────────
  try {
    const { data } = await supabaseAdmin
      .from("cron_executions")
      .insert({
        cron_name: cronName,
        started_at: startedAt.toISOString(),
        status: "running",
      })
      .select("id")
      .single();
    logId = (data?.id as string) ?? null;
  } catch {
    // Logging non bloquant — on continue même si l'insert échoue.
  }

  try {
    const result = await fn();

    // ── Update "succès" (best-effort) ─────────────────────────────────────────
    try {
      const finishedAt = new Date();
      let detail = "";
      try {
        detail = JSON.stringify(result ?? null).slice(0, 300);
      } catch {
        detail = String(result).slice(0, 300);
      }
      if (logId) {
        await supabaseAdmin
          .from("cron_executions")
          .update({
            status: "ok",
            finished_at: finishedAt.toISOString(),
            duration_ms: finishedAt.getTime() - startedAt.getTime(),
            detail,
          })
          .eq("id", logId);
      }
    } catch {
      // Logging non bloquant.
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // ── Update "erreur" (best-effort) ─────────────────────────────────────────
    try {
      const finishedAt = new Date();
      if (logId) {
        await supabaseAdmin
          .from("cron_executions")
          .update({
            status: "error",
            finished_at: finishedAt.toISOString(),
            duration_ms: finishedAt.getTime() - startedAt.getTime(),
            detail: message.slice(0, 300),
          })
          .eq("id", logId);
      }
    } catch {
      // Logging non bloquant.
    }

    // ── Alerte Telegram (best-effort) ─────────────────────────────────────────
    try {
      await notifySystemAlert(`Cron <b>${cronName}</b> a échoué :\n${message.slice(0, 500)}`);
    } catch {
      // Alerte non bloquante.
    }

    // On relance l'erreur pour ne pas la masquer.
    throw err;
  }
}
