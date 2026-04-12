"use client";
import { useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";

type Tab = "sms" | "email" | "campaigns";

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

  async function loadSmsCount() {
    const res = await fetch("/api/sms/blast");
    if (res.ok) { const d = await res.json(); setSmsCount(d.count); }
  }

  async function sendSms() {
    if (!smsMsg.trim() || !confirm(`Envoyer ce SMS à ${smsCount} clients ?`)) return;
    setSmsSending(true); setSmsResult(null);
    const res = await fetch("/api/sms/blast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: smsMsg }) });
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
        </div>

        {/* SMS Tab */}
        {tab === "sms" && (
          <div style={{ background: "#161B22", border: "1px solid rgba(212,175,55,0.18)", borderRadius: "12px", padding: "32px" }}>
            <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Envoyer un SMS à tous les clients</p>
            {smsCount !== null && (
              <p style={{ color: "#5a5", fontSize: "13px", marginBottom: "16px" }}>{smsCount} numéros uniques dans la base</p>
            )}
            <textarea value={smsMsg} onChange={e => setSmsMsg(e.target.value)} placeholder="Votre message SMS... (max 160 car.)"
              maxLength={160} rows={3} style={{ ...inputStyle, resize: "vertical", marginBottom: "8px" }} />
            <p style={{ color: "#555", fontSize: "11px", textAlign: "right", marginBottom: "16px" }}>{smsMsg.length}/160</p>
            <button onClick={sendSms} disabled={smsSending || !smsMsg.trim()}
              style={{ background: smsSending ? "#111" : "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37", padding: "12px 32px", fontSize: "12px", letterSpacing: "2px", cursor: "pointer", borderRadius: "8px", fontWeight: 600 }}>
              {smsSending ? "Envoi en cours..." : "Envoyer le SMS"}
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
      </main>
    </div>
  );
}
