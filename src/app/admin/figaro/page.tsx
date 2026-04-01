"use client";
import { useEffect, useState, useCallback } from "react";
import AdminSidebar from "@/components/AdminSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type FigaroMessage = {
  id: string;
  from_name: string;
  from_email: string;
  message: string;
  ai_response?: string;
  escalated?: boolean;
  resolved?: boolean;
  created_at: string;
};

type Campaign = {
  id: string;
  subject: string;
  sent_to_count: number;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function excerpt(text: string, max = 120): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#D4AF37";
const BG = "#0A0A0A";
const SURFACE = "#111111";
const BORDER = "#1A1A1A";
const TEXT_DIM = "#555555";
const TEXT_MID = "#888888";
const TEXT_MAIN = "#F5F5F5";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "3px",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "1px",
        textTransform: "uppercase" as const,
        background: color === "orange" ? "rgba(200,100,0,0.18)" : "rgba(50,160,80,0.18)",
        color: color === "orange" ? "#E07020" : "#3CA860",
        border: `1px solid ${color === "orange" ? "rgba(200,100,0,0.3)" : "rgba(50,160,80,0.3)"}`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Tab 1: Boîte de réception ────────────────────────────────────────────────

function InboxTab() {
  const [messages, setMessages] = useState<FigaroMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/figaro/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.messages ?? []));
      }
    } catch {
      // silently fail — empty state shown
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function markResolved(id: string) {
    setResolvingId(id);
    try {
      await fetch("/api/figaro/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: true }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, resolved: true } : m))
      );
    } catch {
      // ignore
    }
    setResolvingId(null);
  }

  if (loading) {
    return (
      <p style={{ color: TEXT_DIM, fontSize: "14px", padding: "32px 0" }}>
        Chargement des messages…
      </p>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        style={{
          textAlign: "center" as const,
          padding: "60px 0",
          color: TEXT_DIM,
        }}
      >
        <p style={{ fontSize: "40px", marginBottom: "16px" }}>✂️</p>
        <p style={{ fontSize: "14px", letterSpacing: "1px" }}>
          Aucun message reçu
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
      {messages.map((msg) => {
        const expanded = expandedId === msg.id;
        return (
          <div
            key={msg.id}
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              padding: "20px 24px",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "10px",
                flexWrap: "wrap" as const,
                gap: "8px",
              }}
            >
              <div>
                <span style={{ color: TEXT_MAIN, fontWeight: 500, fontSize: "14px" }}>
                  {msg.from_name || "Inconnu"}
                </span>
                <span style={{ color: TEXT_DIM, fontSize: "12px", marginLeft: "10px" }}>
                  {msg.from_email}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" as const }}>
                {msg.escalated && <Badge color="orange" label="Escaladé" />}
                {msg.resolved && <Badge color="green" label="Résolu" />}
                <span style={{ color: TEXT_DIM, fontSize: "11px" }}>
                  {formatDate(msg.created_at)}
                </span>
              </div>
            </div>

            {/* Message excerpt */}
            <p style={{ color: TEXT_MID, fontSize: "13px", lineHeight: 1.6, marginBottom: "12px" }}>
              {excerpt(msg.message)}
            </p>

            {/* AI response toggle */}
            {msg.ai_response && (
              <div style={{ marginBottom: "12px" }}>
                <button
                  onClick={() => setExpandedId(expanded ? null : msg.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: GOLD,
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: 0,
                    letterSpacing: "1px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      transition: "transform 0.2s",
                      transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  >
                    ▶
                  </span>
                  Réponse de Figaro
                </button>
                {expanded && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "14px 16px",
                      background: "rgba(201,168,76,0.06)",
                      border: `1px solid rgba(201,168,76,0.15)`,
                      borderLeft: `3px solid ${GOLD}`,
                    }}
                  >
                    <p style={{ color: "#D4C08A", fontSize: "13px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {msg.ai_response}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action */}
            {!msg.resolved && (
              <button
                onClick={() => markResolved(msg.id)}
                disabled={resolvingId === msg.id}
                style={{
                  background: "none",
                  border: `1px solid rgba(50,160,80,0.4)`,
                  color: "#3CA860",
                  padding: "7px 18px",
                  fontSize: "12px",
                  letterSpacing: "1px",
                  cursor: resolvingId === msg.id ? "not-allowed" : "pointer",
                  opacity: resolvingId === msg.id ? 0.5 : 1,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (resolvingId !== msg.id) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(50,160,80,0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                {resolvingId === msg.id ? "Enregistrement…" : "✓ Marquer résolu"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 2: Campagne Email ────────────────────────────────────────────────────

function CampaignTab() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState<"all" | "recent">("all");
  const [confirmed, setConfirmed] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  useEffect(() => {
    async function loadCampaigns() {
      setLoadingCampaigns(true);
      try {
        const res = await fetch("/api/figaro/campaign");
        if (res.ok) {
          const data = await res.json();
          setCampaigns(Array.isArray(data) ? data : (data.campaigns ?? []));
        }
      } catch {
        // silently fail
      }
      setLoadingCampaigns(false);
    }
    loadCampaigns();
  }, []);

  async function sendCampaign() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/figaro/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body_html: body, recipient_type: recipient }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ count: data.count ?? data.sent_to_count ?? 0 });
        setCampaigns((prev) => [
          {
            id: data.id ?? String(Date.now()),
            subject,
            sent_to_count: data.count ?? data.sent_to_count ?? 0,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setSubject("");
        setBody("");
      } else {
        setResult({ error: data.error ?? "Erreur inconnue" });
      }
    } catch (e) {
      setResult({ error: String(e) });
    }
    setSending(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0D0D0D",
    border: `1px solid ${BORDER}`,
    color: TEXT_MAIN,
    padding: "12px 14px",
    fontSize: "13px",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  };

  const labelStyle: React.CSSProperties = {
    color: TEXT_DIM,
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    marginBottom: "8px",
    display: "block",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "32px", alignItems: "start" }}>
      {/* Form */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, padding: "28px" }}>
        <p style={{ color: TEXT_DIM, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" as const, marginBottom: "24px" }}>
          Nouvelle campagne
        </p>

        {/* Subject */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Sujet</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex: Nouveaux horaires du printemps"
            style={inputStyle}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Bonjour,&#10;&#10;..."
            rows={8}
            style={{ ...inputStyle, resize: "vertical" as const, lineHeight: "1.6" }}
          />
        </div>

        {/* Recipient selector */}
        <div style={{ marginBottom: "24px" }}>
          <label style={labelStyle}>Destinataires</label>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
            {[
              { value: "all", label: "Tous les clients" },
              { value: "recent", label: "Clients récents (90 jours)" },
            ].map(({ value, label }) => (
              <label
                key={value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  color: recipient === value ? GOLD : TEXT_MID,
                  fontSize: "13px",
                  transition: "color 0.2s",
                }}
              >
                <input
                  type="radio"
                  name="recipient"
                  value={value}
                  checked={recipient === value}
                  onChange={() => setRecipient(value as "all" | "recent")}
                  style={{ accentColor: GOLD_BRIGHT }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        {(subject || body) && (
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Aperçu</label>
            <div
              style={{
                background: "#F9F6EE",
                border: `1px solid #DDD`,
                padding: "20px 24px",
                fontFamily: "Georgia, serif",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  borderBottom: "2px solid #C9A84C",
                  paddingBottom: "12px",
                  marginBottom: "16px",
                }}
              >
                <p style={{ color: "#1A1A1A", fontWeight: 700, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" as const, marginBottom: "4px" }}>
                  CISEAU NOIR BARBERSHOP
                </p>
                <p style={{ color: "#333", fontSize: "16px", fontWeight: 600 }}>
                  {subject || "(sujet)"}
                </p>
              </div>
              <p
                style={{
                  color: "#333",
                  fontSize: "14px",
                  lineHeight: "1.8",
                  whiteSpace: "pre-wrap",
                }}
              >
                {body || "(corps du message)"}
              </p>
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "12px",
                  borderTop: "1px solid #DDD",
                  color: "#888",
                  fontSize: "11px",
                }}
              >
                Ciseau Noir Barbershop — ciseaunoir.ca
              </div>
            </div>
          </div>
        )}

        {/* Result feedback */}
        {result && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 16px",
              background: result.error ? "rgba(200,50,50,0.08)" : "rgba(50,160,80,0.08)",
              border: `1px solid ${result.error ? "rgba(200,50,50,0.25)" : "rgba(50,160,80,0.25)"}`,
            }}
          >
            {result.error ? (
              <p style={{ color: "#e55", fontSize: "13px" }}>✗ Erreur : {result.error}</p>
            ) : (
              <p style={{ color: "#3CA860", fontSize: "13px" }}>
                ✓ {result.count} email{(result.count ?? 0) > 1 ? "s" : ""} envoyé{(result.count ?? 0) > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Test email */}
        <div style={{ marginBottom: "16px" }}>
          <button
            onClick={async () => {
              if (!subject.trim() || !body.trim()) return;
              setTestSent(false);
              await fetch("/api/figaro/campaign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject: `[TEST] ${subject}`, body_html: body, recipient_type: "test" }),
              });
              setTestSent(true);
            }}
            disabled={!subject.trim() || !body.trim()}
            style={{ background: "none", border: `1px solid ${BORDER}`, color: TEXT_MID, padding: "10px 20px", fontSize: "12px", cursor: "pointer", borderRadius: "4px", width: "100%" }}
          >
            {testSent ? "✓ Test envoyé à Melynda" : "Envoyer un test à Melynda d'abord"}
          </button>
        </div>

        {/* Confirmation */}
        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "14px" }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
          <span style={{ color: TEXT_MID, fontSize: "13px" }}>Je confirme l&apos;envoi à tous les destinataires</span>
        </label>

        {/* Send button */}
        <button
          onClick={sendCampaign}
          disabled={sending || !subject.trim() || !body.trim() || !confirmed}
          style={{
            background: sending || !subject.trim() || !body.trim() || !confirmed ? "#1A1A1A" : GOLD,
            color: sending || !subject.trim() || !body.trim() || !confirmed ? TEXT_DIM : "#0A0A0A",
            border: "none",
            padding: "13px 32px",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase" as const,
            cursor: sending || !subject.trim() || !body.trim() || !confirmed ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            width: "100%",
          }}
        >
          {sending ? "Envoi en cours…" : result?.count ? `✓ ${result.count} emails envoyés !` : "Envoyer la campagne →"}
        </button>
      </div>

      {/* Past campaigns */}
      <div>
        <p style={{ color: TEXT_DIM, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" as const, marginBottom: "16px" }}>
          Campagnes précédentes
        </p>
        {loadingCampaigns ? (
          <p style={{ color: TEXT_DIM, fontSize: "13px" }}>Chargement…</p>
        ) : campaigns.length === 0 ? (
          <p style={{ color: TEXT_DIM, fontSize: "13px" }}>Aucune campagne envoyée</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "8px" }}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  padding: "14px 18px",
                }}
              >
                <p style={{ color: TEXT_MAIN, fontSize: "13px", fontWeight: 500, marginBottom: "6px" }}>
                  {c.subject}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: GOLD, fontSize: "12px" }}>
                    {c.sent_to_count} destinataire{c.sent_to_count !== 1 ? "s" : ""}
                  </span>
                  <span style={{ color: TEXT_DIM, fontSize: "11px" }}>
                    {formatDate(c.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 3: Configuration ─────────────────────────────────────────────────────

function ConfigTab() {
  const steps = [
    "Aller sur resend.com → Domains → Add Domain → « ciseaunoir.ca »",
    "Ajouter les DNS records fournis par Resend chez votre registraire (TXT, MX)",
    "Attendre la validation DNS (jusqu'à 48h)",
    "Créer un « Inbound Route » pointant vers https://ciseaunoir.ca/api/contact",
  ];

  return (
    <div style={{ maxWidth: "720px", display: "flex", flexDirection: "column" as const, gap: "24px" }}>
      {/* Main info card */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <span style={{ fontSize: "28px" }}>✂️</span>
          <div>
            <p style={{ color: TEXT_MAIN, fontSize: "15px", fontWeight: 500 }}>
              Comment fonctionne Figaro
            </p>
            <p style={{ color: TEXT_DIM, fontSize: "12px" }}>
              Assistant IA de Ciseau Noir
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" as const, gap: "16px" }}>
          <InfoRow
            icon="💬"
            title="Formulaire de contact"
            desc="Figaro répond automatiquement aux messages reçus via le formulaire de contact du site. Chaque message est traité par l'IA, puis stocké avec la réponse dans la boîte de réception."
          />
          <InfoRow
            icon="📱"
            title="Escalade SMS vers Melynda"
            desc="Si Figaro détecte un message urgent (plainte, urgence, demande hors-norme), il escalade automatiquement vers Melynda par SMS via Twilio. Le message est alors marqué « Escaladé »."
          />
          <InfoRow
            icon="✅"
            title="Résolution"
            desc="Une fois un message traité, vous pouvez le marquer « Résolu » depuis la boîte de réception. Les messages résolus restent visibles pour l'historique."
          />
        </div>
      </div>

      {/* Resend Inbound card */}
      <div style={{ background: SURFACE, border: `1px solid rgba(201,168,76,0.2)`, padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <span style={{ fontSize: "22px" }}>📧</span>
          <div>
            <p style={{ color: GOLD, fontSize: "13px", fontWeight: 600, letterSpacing: "1px" }}>
              Activer les emails entrants sur ciseaunoir.ca
            </p>
            <p style={{ color: TEXT_DIM, fontSize: "12px" }}>
              Optionnel — permet à Figaro de traiter les emails directs
            </p>
          </div>
        </div>

        <p style={{ color: TEXT_MID, fontSize: "13px", lineHeight: 1.7, marginBottom: "20px" }}>
          Pour que Figaro reçoive et traite les emails envoyés directement à une adresse
          <code style={{ color: GOLD, background: "rgba(201,168,76,0.1)", padding: "1px 6px", borderRadius: "2px", margin: "0 4px" }}>
            @ciseaunoir.ca
          </code>
          , configurez Resend Inbound :
        </p>

        <div style={{ display: "flex", flexDirection: "column" as const, gap: "12px" }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <span
                style={{
                  flexShrink: 0,
                  width: "24px",
                  height: "24px",
                  background: "rgba(201,168,76,0.15)",
                  border: `1px solid rgba(201,168,76,0.3)`,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: GOLD,
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <p style={{ color: TEXT_MID, fontSize: "13px", lineHeight: 1.6, paddingTop: "2px" }}>
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Current status note */}
      <div
        style={{
          background: "rgba(201,168,76,0.05)",
          border: `1px solid rgba(201,168,76,0.12)`,
          padding: "18px 22px",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "2px" }}>ℹ️</span>
        <p style={{ color: TEXT_MID, fontSize: "13px", lineHeight: 1.7 }}>
          <strong style={{ color: TEXT_MAIN, fontWeight: 500 }}>Statut actuel :</strong>{" "}
          Figaro traite les messages du formulaire de contact du site. Les emails entrants directs ne sont pas encore activés.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: "14px", paddingTop: "16px", borderTop: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: "20px", flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ color: TEXT_MAIN, fontSize: "13px", fontWeight: 500, marginBottom: "6px" }}>
          {title}
        </p>
        <p style={{ color: TEXT_MID, fontSize: "13px", lineHeight: 1.6 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Campagne SMS ────────────────────────────────────────────────────────

function SMSCampaignTab() {
  const DEFAULT_MSG = `Salut, c'est Melynda de Ciseau Noir 🖤 À partir de maintenant, votre 10e coupe est gratuite ! Les places partent vite — réservez ici : ciseaunoirbarbershop.com/fidelite — Répondez STOP pour ne plus recevoir de msgs.`;
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [twilioBalance, setTwilioBalance] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch("/api/sms/blast").then(r => r.json()).then(d => setContactCount(d.count ?? 0));
    fetch("/api/sms/balance").then(r => r.json()).then(d => {
      if (d.balance !== undefined) {
        const usd = Number(d.balance);
        const cad = (usd * 1.39).toFixed(2);
        setTwilioBalance(`${usd.toFixed(2)} USD (~${cad} CAD)`);
      }
    });
  }, []);

  async function handleSend() {
    setSending(true);
    setResult(null);
    const res = await fetch("/api/sms/blast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    setResult(data);
    setSending(false);
    setConfirmed(false);
  }

  const estimatedCostUSD = contactCount ? (contactCount * 0.01).toFixed(2) : "...";
  const estimatedCostCAD = contactCount ? (contactCount * 0.01 * 1.39).toFixed(2) : "...";
  const estimatedCost = contactCount ? `~${estimatedCostUSD}$ USD (~${estimatedCostCAD}$ CAD)` : "...";

  return (
    <div style={{ maxWidth: "640px" }}>
      <p style={{ color: GOLD, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "24px" }}>Campagne SMS — Tous les contacts</p>

      {/* Stats */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
        {[
          { label: "Contacts avec téléphone", value: contactCount ?? "..." },
          { label: "Coût estimé", value: estimatedCost },
          { label: "Solde Twilio", value: twilioBalance ? `${twilioBalance}` : "..." },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "16px" }}>
            <p style={{ color: TEXT_DIM, fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" }}>{s.label}</p>
            <p style={{ color: TEXT_MAIN, fontSize: "20px", fontWeight: 300 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Message */}
      <div style={{ marginBottom: "20px" }}>
        <p style={{ color: TEXT_MID, fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>Message</p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={5}
          style={{ width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT_MAIN, padding: "14px", fontSize: "14px", borderRadius: "8px", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
        />
        <p style={{ color: TEXT_DIM, fontSize: "12px", marginTop: "6px" }}>{message.length} caractères</p>
      </div>

      {/* Confirmation + Envoi */}
      {!result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
            <span style={{ color: TEXT_MID, fontSize: "13px" }}>
              Je confirme l&apos;envoi à <strong style={{ color: TEXT_MAIN }}>{contactCount ?? "..."} contacts</strong> (~{estimatedCost}$ USD)
            </span>
          </label>
          <button
            onClick={handleSend}
            disabled={!confirmed || sending || !message.trim()}
            style={{
              background: confirmed && !sending ? `linear-gradient(135deg, ${GOLD_BRIGHT}, #B8860B)` : "#1A1A1A",
              color: confirmed && !sending ? "#080808" : "#444",
              border: "none", padding: "16px 32px", borderRadius: "8px",
              fontWeight: 700, fontSize: "13px", letterSpacing: "2px",
              textTransform: "uppercase", cursor: confirmed && !sending ? "pointer" : "not-allowed",
              alignSelf: "flex-start",
            }}>
            {sending ? `Envoi en cours... ⏳` : `📱 Envoyer à tous les contacts`}
          </button>
          {sending && <p style={{ color: TEXT_DIM, fontSize: "12px" }}>Ça peut prendre quelques minutes — ne fermez pas la page.</p>}
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div style={{ background: result.failed === 0 ? "rgba(85,170,85,0.06)" : "rgba(212,175,55,0.06)", border: `1px solid ${result.failed === 0 ? "rgba(85,170,85,0.2)" : "rgba(212,175,55,0.2)"}`, borderRadius: "10px", padding: "24px" }}>
          <p style={{ color: result.failed === 0 ? "#5a5" : GOLD, fontSize: "16px", fontWeight: 500, marginBottom: "12px" }}>
            {result.failed === 0 ? "✅ Envoi complété !" : "⚠️ Envoi terminé avec erreurs"}
          </p>
          <p style={{ color: TEXT_MID, fontSize: "14px" }}>✅ Envoyés : <strong style={{ color: TEXT_MAIN }}>{result.sent}</strong></p>
          {result.failed > 0 && <p style={{ color: TEXT_MID, fontSize: "14px" }}>❌ Échecs : <strong style={{ color: "#e55" }}>{result.failed}</strong></p>}
          <button onClick={() => setResult(null)} style={{ marginTop: "16px", background: "none", border: `1px solid ${BORDER}`, color: TEXT_DIM, padding: "8px 16px", cursor: "pointer", borderRadius: "6px", fontSize: "12px" }}>
            Envoyer une autre campagne
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "inbox" | "campaign" | "sms" | "config";

export default function FigaroPage() {
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [messageCount, setMessageCount] = useState<number | null>(null);

  // Fetch message count for tab label
  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/figaro/messages");
        if (res.ok) {
          const data = await res.json();
          const msgs: FigaroMessage[] = Array.isArray(data) ? data : (data.messages ?? []);
          setMessageCount(msgs.length);
        }
      } catch {
        // ignore
      }
    }
    fetchCount();
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    {
      id: "inbox",
      label: `Boîte de réception${messageCount !== null ? ` (${messageCount})` : ""}`,
    },
    { id: "campaign", label: "Campagne Email" },
    { id: "sms", label: "📱 Campagne SMS" },
    { id: "config", label: "Comment configurer Figaro" },
  ];

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />

      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        {/* Page Header */}
        <div style={{ marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 300,
              letterSpacing: "3px",
              color: TEXT_MAIN,
              marginBottom: "6px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                background: `linear-gradient(135deg, ${GOLD_BRIGHT}, #E8C84A, #B8860B)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FIGARO
            </span>
            <span style={{ fontSize: "22px" }}>✂️</span>
          </h1>
          <p style={{ color: TEXT_DIM, fontSize: "13px", letterSpacing: "1px" }}>
            Assistant IA de Ciseau Noir
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "0",
            borderBottom: `1px solid ${BORDER}`,
            marginBottom: "32px",
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? `2px solid ${GOLD_BRIGHT}` : "2px solid transparent",
                  color: isActive ? GOLD_BRIGHT : TEXT_DIM,
                  padding: "10px 24px",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: "1px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: "-1px",
                  whiteSpace: "nowrap" as const,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = "#888";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = TEXT_DIM;
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "inbox" && <InboxTab />}
        {activeTab === "campaign" && <CampaignTab />}
        {activeTab === "sms" && <SMSCampaignTab />}
        {activeTab === "config" && <ConfigTab />}
      </main>
    </div>
  );
}
