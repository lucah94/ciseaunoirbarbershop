"use client";
import { useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";

type Tab = "sms" | "email" | "campaigns" | "ads";

type MetaCampaign = {
  id: string; name: string; status: string; effectiveStatus: string;
  objective: string; dailyBudget: number | null; lifetimeBudget: number | null;
};
type AdsSpend = {
  account: { name: string; currency: string; totalSpentEver: number | null } | null;
  monthly: { month: string; spend: number; clicks: number; impressions: number; costPerClick: number | null }[];
  averageMonthlySpend: number | null;
  monthsAveraged: number;
  campaigns: MetaCampaign[];
  engagedBudget: { perDay: number; perMonth: number; activeCount: number };
  error?: string;
};

const emptyAds: AdsSpend = {
  account: null, monthly: [], averageMonthlySpend: null, monthsAveraged: 0,
  campaigns: [], engagedBudget: { perDay: 0, perMonth: 0, activeCount: 0 },
};

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("sms");
  const [smsMsg, setSmsMsg] = useState("");
  const [smsCount, setSmsCount] = useState<number | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<string | null>(null);

  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailType, setEmailType] = useState<"test" | "recent" | "all">("test");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<{ id: string; subject: string; sent_to_count: number; created_at: string }[]>([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);

  const [ads, setAds] = useState<AdsSpend | null>(null);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adBusyId, setAdBusyId] = useState<string | null>(null);

  async function loadSmsCount() {
    const res = await fetch("/api/sms/blast");
    if (res.ok) { const d = await res.json(); setSmsCount(d.count); }
  }

  async function sendSms() {
    if (!smsMsg.trim()) return;
    // Garde-fou: ne jamais envoyer si le nombre de destinataires n'est pas connu et > 0
    if (smsCount === null) { setSmsResult("Destinataires non chargés — réessayez."); return; }
    if (smsCount <= 0) { setSmsResult("Aucun destinataire dans la base."); return; }

    // Confirmation riche: nombre exact, aperçu du message et estimation du coût
    const segments = Math.max(1, Math.ceil(smsMsg.length / 160));
    const cost = (smsCount * segments * 0.01).toFixed(2);
    const preview = smsMsg.trim();
    const recap =
      `Envoyer à ${smsCount} clients (~${cost}$) ?\n\n` +
      `Destinataires : ${smsCount}\n` +
      `Segments SMS : ${segments} (${smsMsg.length} caractères)\n` +
      `Coût estimé : ~${cost}$\n\n` +
      `Aperçu du message :\n"${preview}"`;
    if (!confirm(recap)) return;

    setSmsSending(true); setSmsResult(null);
    const res = await fetch("/api/sms/blast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: smsMsg, confirmed: true, confirmedCount: smsCount, estimatedCost: cost }) });
    const d = await res.json();
    setSmsResult(res.ok ? `${d.sent} envoyés, ${d.failed} échoués` : d.error || "Erreur");
    setSmsSending(false);
  }

  async function sendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    if (emailType !== "test" && !confirm(`Envoyer à ${emailType === "all" ? "TOUS" : "les récents (90j)"} ?`)) return;
    setEmailSending(true); setEmailResult(null);
    const res = await fetch("/api/figaro/campaign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: emailSubject, body_html: emailBody, recipient_type: emailType }) });
    const d = await res.json();
    setEmailResult(res.ok ? `${d.sent} email${d.sent > 1 ? "s" : ""} envoyé${d.sent > 1 ? "s" : ""}${d.test ? " (test)" : ""}` : d.error || "Erreur");
    setEmailSending(false);
  }

  async function loadCampaigns() {
    const res = await fetch("/api/figaro/campaign");
    if (res.ok) { const d = await res.json(); setCampaigns(d); setCampaignsLoaded(true); }
  }

  async function loadAds() {
    setAdsLoading(true);
    try {
      const res = await fetch("/api/admin/ads-spend");
      const d = await res.json();
      setAds(res.ok ? d : { ...emptyAds, error: d.error || "Erreur de lecture Meta" });
    } catch {
      setAds({ ...emptyAds, error: "Impossible de joindre Meta" });
    }
    setAdsLoading(false);
  }

  async function toggleAd(c: MetaCampaign) {
    const pausing = c.effectiveStatus === "ACTIVE";
    const budget = c.dailyBudget ? `${c.dailyBudget.toFixed(2)} $/jour` : "budget au niveau de l'ensemble";
    const recap = pausing
      ? `METTRE SUR PAUSE : « ${c.name} » ?\n\nLa diffusion s'arrête et la dépense aussi (${budget}).\nRéversible à tout moment.`
      : `RELANCER : « ${c.name} » ?\n\nLa diffusion reprend et la dépense repart (${budget}).`;
    if (!confirm(recap)) return;

    setAdBusyId(c.id);
    try {
      const res = await fetch("/api/admin/ads-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: c.id, action: pausing ? "pause" : "activate" }),
      });
      const d = await res.json();
      if (!res.ok) alert(d.error || "Erreur");
    } finally {
      setAdBusyId(null);
      await loadAds();
    }
  }

  const tabStyle = (t: Tab) => ({
    padding: "10px 24px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase" as const,
    background: tab === t ? "rgba(212,175,55,0.1)" : "transparent",
    border: `1px solid ${tab === t ? "rgba(212,175,55,0.3)" : "#222"}`,
    color: tab === t ? "#D4AF37" : "#666", cursor: "pointer", borderRadius: "8px", fontWeight: 600,
  });

  const inputStyle = {
    width: "100%", padding: "14px 16px", background: "#0A0A0A", border: "1px solid #222",
    borderRadius: "8px", color: "#F5F5F5", fontSize: "14px", outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "8px" }}>Marketing</h1>
        <p style={{ color: "#666", fontSize: "13px", marginBottom: "32px" }}>SMS blast, campagnes email, historique</p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "32px" }}>
          <button style={tabStyle("sms")} onClick={() => { setTab("sms"); if (smsCount === null) loadSmsCount(); }}>SMS Blast</button>
          <button style={tabStyle("email")} onClick={() => setTab("email")}>Email</button>
          <button style={tabStyle("campaigns")} onClick={() => { setTab("campaigns"); if (!campaignsLoaded) loadCampaigns(); }}>Historique</button>
          <button style={tabStyle("ads")} onClick={() => { setTab("ads"); if (!ads) loadAds(); }}>Pubs Facebook</button>
        </div>

        {/* SMS Tab */}
        {tab === "sms" && (
          <div style={{ background: "#161B22", border: "1px solid rgba(212,175,55,0.18)", borderRadius: "12px", padding: "32px" }}>
            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Envoyer un SMS à tous les clients</p>
            {smsCount !== null && (
              <p style={{ color: "#5a5", fontSize: "13px", marginBottom: "16px" }}>{smsCount} numéros uniques dans la base</p>
            )}
            <textarea value={smsMsg} onChange={e => setSmsMsg(e.target.value)} placeholder="Votre message SMS... (max 160 car.)"
              maxLength={480} rows={3} style={{ ...inputStyle, resize: "vertical", marginBottom: "8px" }} />
            <p style={{ color: smsMsg.length > 160 ? "#f90" : "#555", fontSize: "11px", textAlign: "right", marginBottom: "16px" }}>
              {smsMsg.length} caractères · {Math.max(1, Math.ceil((smsMsg.length || 1) / 160))} SMS ({smsMsg.length <= 160 ? "1 SMS" : smsMsg.length <= 320 ? "2 SMS" : "3 SMS"} = facturation multipliée)
            </p>
            <button onClick={sendSms} disabled={smsSending || !smsMsg.trim() || smsCount === null || smsCount <= 0}
              style={{ background: smsSending ? "#111" : "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", padding: "12px 32px", fontSize: "12px", letterSpacing: "2px", cursor: (smsSending || smsCount === null || smsCount <= 0) ? "not-allowed" : "pointer", opacity: (smsCount === null || smsCount <= 0) ? 0.5 : 1, borderRadius: "8px", fontWeight: 600 }}>
              {smsSending ? "Envoi en cours..." : smsCount === null ? "Chargement des destinataires..." : "Envoyer le SMS"}
            </button>
            {smsResult && <p style={{ color: "#5a5", marginTop: "16px", fontSize: "14px" }}>{smsResult}</p>}
          </div>
        )}

        {/* Email Tab */}
        {tab === "email" && (
          <div style={{ background: "#161B22", border: "1px solid rgba(212,175,55,0.18)", borderRadius: "12px", padding: "32px" }}>
            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Campagne email</p>
            <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Sujet de l'email"
              style={{ ...inputStyle, marginBottom: "12px" }} />
            <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Corps du message (texte simple, les retours à la ligne seront convertis en HTML)"
              rows={6} style={{ ...inputStyle, resize: "vertical", marginBottom: "16px" }} />
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              {(["test", "recent", "all"] as const).map(t => (
                <button key={t} onClick={() => setEmailType(t)}
                  style={{
                    padding: "8px 20px", fontSize: "11px", letterSpacing: "1px", cursor: "pointer", borderRadius: "6px",
                    background: emailType === t ? "rgba(212,175,55,0.15)" : "#0A0A0A",
                    border: `1px solid ${emailType === t ? "rgba(212,175,55,0.3)" : "#222"}`,
                    color: emailType === t ? "#D4AF37" : "#888",
                  }}>
                  {t === "test" ? "Test (admin)" : t === "recent" ? "Récents (90j)" : "Tous les clients"}
                </button>
              ))}
            </div>
            <button onClick={sendEmail} disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
              style={{ background: emailSending ? "#111" : "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", padding: "12px 32px", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", borderRadius: "8px", fontWeight: 600 }}>
              {emailSending ? "Envoi..." : "Envoyer"}
            </button>
            {emailResult && <p style={{ color: "#5a5", marginTop: "16px", fontSize: "14px" }}>{emailResult}</p>}
          </div>
        )}

        {/* Campaigns History Tab */}
        {tab === "campaigns" && (
          <div style={{ background: "#161B22", border: "1px solid rgba(212,175,55,0.18)", borderRadius: "12px", padding: "32px" }}>
            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Historique des campagnes</p>
            {campaigns.length === 0 ? (
              <p style={{ color: "#555", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>Aucune campagne envoyée</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {campaigns.map(c => (
                  <div key={c.id} style={{ padding: "16px", background: "#0A0A0A", border: "1px solid rgba(212,175,55,0.06)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ color: "#F5F5F5", fontSize: "14px", marginBottom: "4px" }}>{c.subject}</p>
                      <p style={{ color: "#666", fontSize: "12px" }}>{new Date(c.created_at).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <span style={{ color: "#D4AF37", fontSize: "14px", fontWeight: 600 }}>{c.sent_to_count} envoyés</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Pubs Facebook (Meta Ads) */}
        {tab === "ads" && (
          <div style={{ background: "#161B22", border: "1px solid rgba(212,175,55,0.18)", borderRadius: "12px", padding: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Pubs Facebook — dépenses et contrôle</p>
              <button onClick={loadAds} disabled={adsLoading}
                style={{ background: "transparent", border: "1px solid #222", color: "#888", padding: "6px 14px", fontSize: "11px", borderRadius: "6px", cursor: adsLoading ? "wait" : "pointer" }}>
                {adsLoading ? "..." : "Rafraîchir"}
              </button>
            </div>

            {adsLoading && !ads && <p style={{ color: "#555", fontSize: "14px" }}>Lecture du compte publicitaire...</p>}

            {ads?.error && (
              <p style={{ color: "#f66", fontSize: "13px", padding: "16px", background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: "8px" }}>
                {ads.error}
              </p>
            )}

            {ads && !ads.error && (
              <>
                {/* Résumé */}
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
                  {[
                    { label: "Moyenne par mois", value: ads.averageMonthlySpend !== null ? `${ads.averageMonthlySpend.toFixed(2)} $` : "—",
                      hint: ads.monthsAveraged > 0 ? `sur ${ads.monthsAveraged} mois complets` : "pas encore de mois complet" },
                    { label: "Engagé en ce moment", value: `${ads.engagedBudget.perMonth.toFixed(2)} $`,
                      hint: `${ads.engagedBudget.perDay.toFixed(2)} $/jour · ${ads.engagedBudget.activeCount} campagne(s) active(s)` },
                    { label: "Dépensé depuis toujours", value: ads.account?.totalSpentEver !== null && ads.account ? `${ads.account.totalSpentEver!.toFixed(2)} $` : "—",
                      hint: ads.account?.currency || "" },
                  ].map((k) => (
                    <div key={k.label} style={{ flex: "1 1 200px", padding: "18px", background: "#0A0A0A", border: "1px solid rgba(212,175,55,0.08)", borderRadius: "10px" }}>
                      <p style={{ color: "#666", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px" }}>{k.label}</p>
                      <p style={{ color: "#D4AF37", fontSize: "22px", fontWeight: 600, marginBottom: "4px" }}>{k.value}</p>
                      <p style={{ color: "#555", fontSize: "11px" }}>{k.hint}</p>
                    </div>
                  ))}
                </div>

                {/* Dépense mois par mois */}
                <p style={{ color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Mois par mois</p>
                {ads.monthly.length === 0 ? (
                  <p style={{ color: "#555", fontSize: "13px", marginBottom: "28px" }}>Aucune dépense sur la période.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "28px" }}>
                    {ads.monthly.map((m) => (
                      <div key={m.month} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#0A0A0A", border: "1px solid rgba(212,175,55,0.06)", borderRadius: "8px" }}>
                        <span style={{ color: "#F5F5F5", fontSize: "13px" }}>{m.month}</span>
                        <span style={{ color: "#666", fontSize: "12px" }}>
                          {m.clicks} clics{m.costPerClick !== null ? ` · ${m.costPerClick.toFixed(2)} $/clic` : ""}
                        </span>
                        <span style={{ color: "#D4AF37", fontSize: "15px", fontWeight: 600 }}>{m.spend.toFixed(2)} $</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Campagnes + pause/relance */}
                <p style={{ color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Campagnes</p>
                {ads.campaigns.length === 0 ? (
                  <p style={{ color: "#555", fontSize: "13px" }}>Aucune campagne sur ce compte.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {ads.campaigns.map((c) => {
                      const active = c.effectiveStatus === "ACTIVE";
                      return (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "16px", background: "#0A0A0A", border: `1px solid ${active ? "rgba(90,170,90,0.25)" : "rgba(212,175,55,0.06)"}`, borderRadius: "8px" }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: "#F5F5F5", fontSize: "14px", marginBottom: "4px" }}>{c.name}</p>
                            <p style={{ color: "#666", fontSize: "11px" }}>
                              <span style={{ color: active ? "#5a5" : "#888" }}>{active ? "● En diffusion" : `○ ${c.effectiveStatus}`}</span>
                              {c.dailyBudget !== null ? ` · ${c.dailyBudget.toFixed(2)} $/jour` : ""}
                            </p>
                          </div>
                          <button onClick={() => toggleAd(c)} disabled={adBusyId === c.id}
                            style={{
                              flexShrink: 0, padding: "9px 20px", fontSize: "11px", letterSpacing: "1.5px", fontWeight: 600, borderRadius: "6px",
                              cursor: adBusyId === c.id ? "wait" : "pointer",
                              background: active ? "rgba(255,120,80,0.1)" : "rgba(90,170,90,0.1)",
                              border: `1px solid ${active ? "rgba(255,120,80,0.35)" : "rgba(90,170,90,0.35)"}`,
                              color: active ? "#f86" : "#5a5",
                            }}>
                            {adBusyId === c.id ? "..." : active ? "METTRE SUR PAUSE" : "RELANCER"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
