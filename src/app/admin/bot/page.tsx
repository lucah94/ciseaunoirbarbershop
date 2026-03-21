"use client";
import { useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  messages: Array<{ role: string; content: string }>;
  customer_profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const DAYS = [
  { label: "Mardi", value: 2 },
  { label: "Mercredi", value: 3 },
  { label: "Jeudi", value: 4 },
  { label: "Vendredi", value: 5 },
  { label: "Samedi", value: 6 },
];

export default function BotPage() {
  const [botEnabled, setBotEnabled] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [postDays, setPostDays] = useState<number[]>([2, 3, 4, 5, 6]);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [testPosting, setTestPosting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string; reason?: string; posts?: Array<{ contentType: string; ok: boolean; preview?: string; error?: string }> } | null>(null);
  const [stats, setStats] = useState({ total: 0, today: 0 });

  // Load bot state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ciseau_bot_enabled");
    if (saved !== null) setBotEnabled(saved === "true");

    const savedDays = localStorage.getItem("ciseau_post_days");
    if (savedDays) {
      try { setPostDays(JSON.parse(savedDays)); } catch { /* ignore */ }
    }

    const savedPpd = localStorage.getItem("ciseau_posts_per_day");
    if (savedPpd) setPostsPerDay(parseInt(savedPpd) || 1);
  }, []);

  function toggleBot() {
    const next = !botEnabled;
    setBotEnabled(next);
    localStorage.setItem("ciseau_bot_enabled", String(next));
  }

  function toggleDay(day: number) {
    const next = postDays.includes(day)
      ? postDays.filter(d => d !== day)
      : [...postDays, day].sort();
    setPostDays(next);
    localStorage.setItem("ciseau_post_days", JSON.stringify(next));
  }

  function changePostsPerDay(n: number) {
    setPostsPerDay(n);
    localStorage.setItem("ciseau_posts_per_day", String(n));
  }

  // Load conversations from Supabase
  useEffect(() => {
    async function loadConversations() {
      setLoading(true);
      const { data, error } = await supabase
        .from("messenger_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setConversations(data);

        // Compute stats
        const today = new Date().toISOString().split("T")[0];
        const todayConvs = data.filter(c => c.updated_at?.startsWith(today));
        const todayMsgs = todayConvs.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
        setStats({ total: data.length, today: todayMsgs });
      }
      setLoading(false);
    }

    loadConversations();
  }, []);

  function getLastMessage(conv: Conversation): string {
    const msgs = conv.messages || [];
    if (msgs.length === 0) return "Aucun message";
    return msgs[msgs.length - 1].content?.slice(0, 80) || "...";
  }

  function formatTime(ts: string): string {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
  }

  async function testAutoPost() {
    setTestPosting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/test-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ times: postsPerDay }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ error: String(e) });
    }
    setTestPosting(false);
  }

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>
            Bot IA
          </h1>
          <p style={{ color: "#444", fontSize: "13px" }}>
            Messenger — conversations, auto-post Facebook
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "40px" }}>
          {[
            { label: "Conversations totales", value: stats.total },
            { label: "Messages aujourd'hui", value: stats.today },
            { label: "Statut bot", value: botEnabled ? "Actif" : "Inactif" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{label}</p>
              <p style={{ color: "#C9A84C", fontSize: "28px", fontWeight: 300 }}>{value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
          {/* Left column */}
          <div>
            {/* Bot status toggle */}
            <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", marginBottom: "24px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>
                Statut du Bot Messenger
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button
                  onClick={toggleBot}
                  style={{
                    width: "52px", height: "28px",
                    background: botEnabled ? "#C9A84C" : "#222",
                    border: "none", borderRadius: "14px",
                    cursor: "pointer", position: "relative", transition: "background 0.2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: "4px",
                    left: botEnabled ? "26px" : "4px",
                    width: "20px", height: "20px",
                    background: "#fff", borderRadius: "50%", transition: "left 0.2s",
                    display: "block",
                  }} />
                </button>
                <span style={{ color: botEnabled ? "#C9A84C" : "#555", fontSize: "14px" }}>
                  {botEnabled ? "Bot actif — répond automatiquement" : "Bot inactif"}
                </span>
              </div>
              {!botEnabled && (
                <p style={{ color: "#444", fontSize: "12px", marginTop: "12px" }}>
                  Note : Ce toggle est visuel (localStorage). Pour désactiver réellement le webhook, retirez le MESSENGER_VERIFY_TOKEN de l'env.
                </p>
              )}
            </div>

            {/* Auto-post configuration */}
            <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", marginBottom: "24px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>
                Configuration Auto-Post Facebook
              </p>

              <div style={{ marginBottom: "20px" }}>
                <p style={{ color: "#888", fontSize: "12px", marginBottom: "12px" }}>Jours de publication</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {DAYS.map(({ label, value }) => (
                    <label key={value} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={postDays.includes(value)}
                        onChange={() => toggleDay(value)}
                        style={{ accentColor: "#C9A84C" }}
                      />
                      <span style={{ color: postDays.includes(value) ? "#C9A84C" : "#555", fontSize: "13px" }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <p style={{ color: "#888", fontSize: "12px", marginBottom: "12px" }}>Publications par jour</p>
                <div style={{ display: "flex", gap: "12px" }}>
                  {[1, 2].map(n => (
                    <button
                      key={n}
                      onClick={() => changePostsPerDay(n)}
                      style={{
                        background: postsPerDay === n ? "#C9A84C" : "#1A1A1A",
                        color: postsPerDay === n ? "#0A0A0A" : "#666",
                        border: `1px solid ${postsPerDay === n ? "#C9A84C" : "#333"}`,
                        padding: "8px 24px", fontSize: "14px", cursor: "pointer",
                      }}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={testAutoPost}
                disabled={testPosting}
                style={{
                  background: "none", border: "1px solid #C9A84C",
                  color: "#C9A84C", padding: "10px 24px",
                  fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase",
                  cursor: testPosting ? "not-allowed" : "pointer",
                  opacity: testPosting ? 0.5 : 1,
                }}
              >
                {testPosting ? "Publication en cours..." : "Tester auto-post →"}
              </button>

              {testResult && (
                <div style={{
                  marginTop: "16px", padding: "16px",
                  background: testResult.ok ? "#0a1a0a" : "#1a0a0a",
                  border: `1px solid ${testResult.ok ? "#2a4a2a" : "#4a2a2a"}`,
                }}>
                  {testResult.error ? (
                    <p style={{ color: "#e55", fontSize: "13px" }}>Erreur: {testResult.error}</p>
                  ) : testResult.reason ? (
                    <p style={{ color: "#888", fontSize: "13px" }}>{testResult.reason}</p>
                  ) : (
                    <>
                      <p style={{ color: testResult.ok ? "#5a5" : "#e55", fontSize: "13px", marginBottom: "8px" }}>
                        {testResult.ok ? "✓ Publication(s) réussie(s)" : "✗ Certaines publications ont échoué"}
                      </p>
                      {testResult.posts?.map((p, i) => (
                        <div key={i} style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #222" }}>
                          <p style={{ color: "#888", fontSize: "12px" }}>
                            Post {i + 1} ({p.contentType}): {p.ok ? <span style={{ color: "#5a5" }}>✓</span> : <span style={{ color: "#e55" }}>✗ {p.error}</span>}
                          </p>
                          {p.preview && <p style={{ color: "#555", fontSize: "11px", marginTop: "4px", fontStyle: "italic" }}>"{p.preview}"</p>}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Webhook info */}
            <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: "20px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>
                Configuration Webhook
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { label: "Webhook URL", value: "[votre-domaine]/api/meta/messenger" },
                  { label: "Verify Token", value: "ciseaunoir_messenger_2026" },
                  { label: "Cron auto-post", value: "[votre-domaine]/api/cron/auto-post" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ color: "#444", fontSize: "11px", marginBottom: "2px" }}>{label}</p>
                    <code style={{ color: "#C9A84C", fontSize: "12px", fontFamily: "monospace" }}>{value}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — conversations */}
          <div>
            <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>
                Conversations Messenger
              </p>

              {loading ? (
                <p style={{ color: "#444", fontSize: "14px" }}>Chargement...</p>
              ) : conversations.length === 0 ? (
                <p style={{ color: "#333", fontSize: "14px" }}>Aucune conversation pour l'instant.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConv(selectedConv?.id === conv.id ? null : conv)}
                      style={{
                        padding: "14px 16px",
                        background: selectedConv?.id === conv.id ? "#1A1A0A" : "#0D0D0D",
                        border: `1px solid ${selectedConv?.id === conv.id ? "#C9A84C" : "#1A1A1A"}`,
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                        <p style={{ color: "#F5F5F5", fontSize: "13px", fontWeight: 500 }}>
                          {conv.sender_name || `Utilisateur ${conv.sender_id.slice(-6)}`}
                        </p>
                        <span style={{ color: "#444", fontSize: "11px", flexShrink: 0, marginLeft: "8px" }}>
                          {formatTime(conv.updated_at)}
                        </span>
                      </div>
                      <p style={{ color: "#555", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {getLastMessage(conv)}
                      </p>
                      <p style={{ color: "#333", fontSize: "11px", marginTop: "4px" }}>
                        {conv.messages?.length || 0} messages
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation detail */}
            {selectedConv && (
              <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "24px", marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <p style={{ color: "#C9A84C", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase" }}>
                    {selectedConv.sender_name || `ID: ${selectedConv.sender_id.slice(-8)}`}
                  </p>
                  <button
                    onClick={() => setSelectedConv(null)}
                    style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "16px" }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ maxHeight: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(selectedConv.messages || []).map((msg, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: msg.role === "user" ? "flex-start" : "flex-end",
                        maxWidth: "85%",
                        padding: "10px 14px",
                        background: msg.role === "user" ? "#1A1A1A" : "#1A1A0A",
                        border: `1px solid ${msg.role === "user" ? "#222" : "#2A2A0A"}`,
                      }}
                    >
                      <p style={{ color: msg.role === "user" ? "#E5E5E5" : "#C9A84C", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                        {msg.role === "user" ? (selectedConv.sender_name || "Client") : "Bot IA"}
                      </p>
                      <p style={{ color: "#CCC", fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
