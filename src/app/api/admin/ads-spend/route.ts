import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getAccountSummary,
  getMonthlySpend,
  listCampaigns,
  activeDailyBudget,
  isMetaAdsError,
} from "@/lib/metaAds";

export const dynamic = "force-dynamic";

/**
 * Dépenses publicitaires Meta — LECTURE SEULE.
 * Répond à « la pub Facebook me coûte combien par mois » : dépense réelle mois par mois,
 * campagnes en cours et budget quotidien actuellement engagé.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const months = Math.min(
    Math.max(1, Number(req.nextUrl.searchParams.get("months")) || 6),
    36
  );

  const [account, monthly, campaigns] = await Promise.all([
    getAccountSummary(),
    getMonthlySpend(months),
    listCampaigns(),
  ]);

  const errors = [account, monthly, campaigns]
    .filter(isMetaAdsError)
    .map((e) => e.error);

  // Une seule cause = un seul message clair, plutôt qu'un objet à moitié vide.
  if (errors.length === 3) {
    return NextResponse.json({ error: errors[0] }, { status: 502 });
  }

  const campaignList = isMetaAdsError(campaigns) ? [] : campaigns;
  const monthlyList = isMetaAdsError(monthly) ? [] : monthly;
  const engaged = activeDailyBudget(campaignList);

  // Moyenne sur les mois COMPLETS uniquement — inclure le mois en cours
  // (souvent à moitié écoulé) tirerait la moyenne vers le bas à tort.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const complete = monthlyList.filter((m) => m.month !== currentMonth);
  const avgMonthly = complete.length
    ? Math.round((complete.reduce((s, m) => s + m.spend, 0) / complete.length) * 100) / 100
    : null;

  return NextResponse.json({
    account: isMetaAdsError(account) ? null : account,
    monthly: monthlyList,
    averageMonthlySpend: avgMonthly,
    monthsAveraged: complete.length,
    campaigns: campaignList,
    engagedBudget: engaged,
    warnings: errors.length ? errors : undefined,
  });
}
