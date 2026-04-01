"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import AdminSidebar from "@/components/AdminSidebar";

type Post = {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  comments?: { summary: { total_count: number } };
  reactions?: { summary: { total_count: number } };
};

type Comment = {
  id: string;
  message: string;
  from?: { name: string };
  created_time: string;
  like_count: number;
};

const TEMPLATES = [
  { label: "Promotion", text: "✂️ Offre spéciale cette semaine chez Ciseau Noir ! Réservez votre place en ligne : ciseaunoirbarbershop.com" },
  { label: "Horaires", text: "📅 Nos horaires :\nMar–Mer–Sam : 8h30–16h30\nJeu–Ven : 8h30–20h30\nFermé dim & lun\n\n📍 375 Bd des Chutes, Québec | ☎️ (418) 665-5703" },
  { label: "Invitation", text: "🔥 Nouvelle semaine, nouveau look ! Réservez votre coupe avec Melynda ou Diodis sur ciseaunoirbarbershop.com ✂️" },
  { label: "Avis", text: "⭐⭐⭐⭐⭐ Merci à tous nos clients pour vos avis Google ! Chaque avis nous aide à grandir. Laissez le vôtre si vous êtes passé nous voir 🙏" },
];

export default function SocialPage() {
  const [tab, setTab] = useState<"post" | "story" | "comments">("post");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [platform, setPlatform] = useState({ facebook: true, instagram: false, google: false });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [storyPlatform, setStoryPlatform] = useState<"facebook" | "instagram" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateType, setGenerateType] = useState("promotion");
  const [testLoading, setTestLoading] = useState(false);
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);

  const [portfolioModal, setPortfolioModal] = useState(false);
  const [portfolioPhotos, setPortfolioPhotos] = useState<{id:string;url:string;caption?:string}[]>([]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyLoading, setReplyLoading] = useState<string | null>(null);

  useEffect(() => {
    if (tab === "comments") {
      setPostsLoading(true);
      fetch("/api/meta/comments")
        .then(r => r.json())
        .then(data => { setPosts(Array.isArray(data) ? data : []); setPostsLoading(false); });
    }
  }, [tab]);

  async function loadComments(post: Post) {
    setSelectedPost(post);
    const res = await fetch(`/api/meta/comments?postId=${post.id}`);
    const data = await res.json();
    setComments(Array.isArray(data) ? data : []);
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/admin/generate-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: generateType }),
    });
    const data = await res.json();
    if (data.text) setMessage(data.text);
    setGenerating(false);
  }

  async function handleTestAutoPost() {
    setTestLoading(true);
    setStatus(null);
    const res = await fetch("/api/admin/test-post", { method: "POST" });
    const data = await res.json();
    setStatus(data.error ? { error: data.error } : { ok: true });
    setTestLoading(false);
  }

  async function handlePost() {
    setLoading(true);
    setStatus(null);
    const publishToInstagram = platform.instagram;
    const res = await fetch("/api/meta/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, imageUrl: imageUrl || undefined, publishToInstagram }),
    });
    const data = await res.json();

    if (platform.google) {
      await fetch("/api/google/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    }

    setStatus(data.error ? { error: data.error } : { ok: true });
    setLoading(false);
    if (!data.error) { setMessage(""); setImageUrl(""); }
  }

  async function handleStory() {
    if (!imageUrl) { setStatus({ error: "URL d'image requise pour une story" }); return; }
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/meta/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, platform: storyPlatform }),
    });
    const data = await res.json();
    setStatus(data.error ? { error: data.error } : { ok: true });
    setLoading(false);
    if (!data.error) setImageUrl("");
  }

  async function handleReply(commentId: string) {
    if (!replyText[commentId]?.trim()) return;
    setReplyLoading(commentId);
    const res = await fetch("/api/meta/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, message: replyText[commentId] }),
    });
    const data = await res.json();
    if (!data.error) {
      setReplyText(t => ({ ...t, [commentId]: "" }));
      if (selectedPost) loadComments(selectedPost);
    }
    setReplyLoading(null);
  }

  async function loadPortfolio() {
    const res = await fetch("/api/portfolio");
    const data = await res.json();
    setPortfolioPhotos(Array.isArray(data) ? data : []);
    setPortfolioModal(true);
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Supprimer ce commentaire ?")) return;
    await fetch("/api/meta/reply", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    if (selectedPost) loadComments(selectedPost);
  }

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>Réseaux Sociaux</h1>
          <p style={{ color: "#444", fontSize: "13px" }}>Facebook & Instagram — publication, stories, commentaires</p>
        </div>

        {/* Config warning */}
        {!process.env.NEXT_PUBLIC_META_CONFIGURED && (
          <div style={{ background: "#1a1000", border: "1px solid #C9A84C", padding: "20px 24px", marginBottom: "32px" }}>
            <p style={{ color: "#C9A84C", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>⚠ Configuration Meta requise</p>
            <p style={{ color: "#888", fontSize: "13px", lineHeight: 1.6 }}>
              Ajoutez dans votre <code style={{ color: "#C9A84C" }}>.env.local</code> :<br />
              <code style={{ color: "#aaa" }}>FACEBOOK_PAGE_ID=votre_page_id</code><br />
              <code style={{ color: "#aaa" }}>FACEBOOK_ACCESS_TOKEN=votre_token</code><br />
              <code style={{ color: "#aaa" }}>INSTAGRAM_ACCOUNT_ID=votre_ig_id</code> (optionnel)<br /><br />
              <span style={{ color: "#666" }}>Voir le guide de configuration ci-dessous.</span>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", marginBottom: "32px", borderBottom: "1px solid #1A1A1A" }}>
          {([["post", "Publication"], ["story", "Story"], ["comments", "Commentaires"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setStatus(null); }} style={{
              background: "none", border: "none", padding: "12px 24px", cursor: "pointer",
              color: tab === key ? "#C9A84C" : "#555", fontSize: "13px", letterSpacing: "2px",
              borderBottom: tab === key ? "2px solid #C9A84C" : "2px solid transparent",
              textTransform: "uppercase",
            }}>{label}</button>
          ))}
        </div>

        {/* POST TAB */}
        {tab === "post" && (
          <div style={{ maxWidth: "700px" }}>
            {/* Générer avec IA */}
            <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: "20px 24px", marginBottom: "24px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>✨ Générer avec Claude IA</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={generateType}
                  onChange={e => setGenerateType(e.target.value)}
                  style={{ background: "#111", border: "1px solid #333", color: "#F5F5F5", padding: "10px 14px", fontSize: "13px", outline: "none", cursor: "pointer" }}
                >
                  <option value="promotion">Promotion</option>
                  <option value="service">Mise en avant service</option>
                  <option value="tip">Conseil coiffure</option>
                  <option value="appreciation">Remerciement clients</option>
                  <option value="inspirational">Message inspirationnel</option>
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ background: "#C9A84C", border: "none", color: "#0A0A0A", padding: "10px 24px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontWeight: 700, opacity: generating ? 0.6 : 1 }}
                >
                  {generating ? "Génération..." : "✨ Générer"}
                </button>
              </div>
              <p style={{ color: "#444", fontSize: "12px", marginTop: "12px" }}>
                Le texte généré apparaît dans le textarea ci-dessous — tu peux le modifier avant de publier.
              </p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Templates rapides</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => setMessage(t.text)} style={{
                    background: "#111", border: "1px solid #222", color: "#888",
                    padding: "6px 14px", fontSize: "12px", cursor: "pointer", letterSpacing: "1px",
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="Écrivez votre publication..."
                style={{ background: "#111", border: "1px solid #333", color: "#F5F5F5", padding: "14px 16px", fontSize: "14px", width: "100%", outline: "none", resize: "vertical", lineHeight: 1.6 }}
              />
              <p style={{ color: "#444", fontSize: "12px", marginTop: "4px" }}>{message.length} caractères</p>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>Image (URL publique — optionnel)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://exemple.com/image.jpg"
                style={{ background: "#111", border: "1px solid #333", color: "#F5F5F5", padding: "12px 16px", fontSize: "14px", width: "100%", outline: "none" }}
              />
              <button
                onClick={loadPortfolio}
                style={{ marginTop: "8px", background: "none", border: "1px solid #333", color: "#888", padding: "8px 16px", fontSize: "12px", cursor: "pointer", letterSpacing: "1px" }}
              >
                📁 Choisir depuis le portfolio
              </button>
              {imageUrl && <Image src={imageUrl} alt="preview" width={300} height={200} unoptimized style={{ marginTop: "12px", maxWidth: "300px", maxHeight: "200px", objectFit: "cover", border: "1px solid #222" }} />}
            </div>

            <div style={{ marginBottom: "28px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Publier sur</p>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {[["facebook", "Facebook"], ["instagram", "Instagram"]].map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={platform[key as "facebook" | "instagram"]}
                      onChange={e => setPlatform(p => ({ ...p, [key]: e.target.checked }))}
                      style={{ accentColor: "#C9A84C" }}
                    />
                    <span style={{ color: "#F5F5F5", fontSize: "14px" }}>{label}</span>
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={platform.google}
                    onChange={e => setPlatform(p => ({ ...p, google: e.target.checked }))}
                    style={{ accentColor: "#C9A84C" }}
                  />
                  <span style={{ color: "#F5F5F5", fontSize: "14px" }}>Google My Business</span>
                </label>
              </div>
              {platform.instagram && !process.env.NEXT_PUBLIC_INSTAGRAM_CONFIGURED && (
                <p style={{ color: "#C9A84C", fontSize: "12px", marginTop: "8px" }}>⚠ Instagram nécessite INSTAGRAM_ACCOUNT_ID dans .env.local + une image</p>
              )}
            </div>

            {status && (
              <div style={{ padding: "12px 16px", background: status.ok ? "#0a1a0a" : "#1a0a0a", border: `1px solid ${status.ok ? "#2a4a2a" : "#4a2a2a"}`, marginBottom: "20px" }}>
                <p style={{ color: status.ok ? "#5a5" : "#e55", fontSize: "13px" }}>
                  {status.ok ? "✓ Publication envoyée avec succès !" : `✗ Erreur : ${status.error}`}
                </p>
              </div>
            )}

            <button
              onClick={handlePost}
              disabled={loading || !message.trim()}
              style={{
                background: "#C9A84C", color: "#0A0A0A", border: "none", padding: "14px 40px",
                fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", cursor: "pointer",
                opacity: (loading || !message.trim()) ? 0.5 : 1, fontWeight: 600,
              }}
            >
              {loading ? "Publication en cours..." : "Publier →"}
            </button>
          </div>
        )}

        {/* STORY TAB */}
        {tab === "story" && (
          <div style={{ maxWidth: "500px" }}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>URL de l'image (1080×1920 recommandé)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://exemple.com/story.jpg"
                style={{ background: "#111", border: "1px solid #333", color: "#F5F5F5", padding: "12px 16px", fontSize: "14px", width: "100%", outline: "none" }}
              />
              {imageUrl && (
                <Image src={imageUrl} alt="preview" width={180} height={180} unoptimized style={{ marginTop: "12px", maxWidth: "180px", border: "1px solid #222", display: "block" }} />
              )}
            </div>

            <div style={{ marginBottom: "28px" }}>
              <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Publier sur</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(["facebook", "instagram", "both"] as const).map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input type="radio" name="storyPlatform" value={p} checked={storyPlatform === p} onChange={() => setStoryPlatform(p)} style={{ accentColor: "#C9A84C" }} />
                    <span style={{ color: "#F5F5F5", fontSize: "14px", textTransform: "capitalize" }}>
                      {p === "both" ? "Facebook + Instagram" : p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {status && (
              <div style={{ padding: "12px 16px", background: status.ok ? "#0a1a0a" : "#1a0a0a", border: `1px solid ${status.ok ? "#2a4a2a" : "#4a2a2a"}`, marginBottom: "20px" }}>
                <p style={{ color: status.ok ? "#5a5" : "#e55", fontSize: "13px" }}>
                  {status.ok ? "✓ Story publiée avec succès !" : `✗ Erreur : ${status.error}`}
                </p>
              </div>
            )}

            <button
              onClick={handleStory}
              disabled={loading || !imageUrl.trim()}
              style={{
                background: "#C9A84C", color: "#0A0A0A", border: "none", padding: "14px 40px",
                fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", cursor: "pointer",
                opacity: (loading || !imageUrl.trim()) ? 0.5 : 1, fontWeight: 600,
              }}
            >
              {loading ? "Publication..." : "Publier la story →"}
            </button>
          </div>
        )}

        {/* COMMENTS TAB */}
        {tab === "comments" && (
          <div style={{ display: "grid", gridTemplateColumns: selectedPost ? "1fr 1fr" : "1fr", gap: "24px" }}>
            {/* Posts list */}
            <div>
              <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px" }}>Publications récentes</p>
              {postsLoading ? (
                <p style={{ color: "#444" }}>Chargement...</p>
              ) : posts.length === 0 ? (
                <p style={{ color: "#333", fontSize: "14px" }}>Aucune publication trouvée</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {posts.map(post => (
                    <div
                      key={post.id}
                      onClick={() => loadComments(post)}
                      style={{
                        background: selectedPost?.id === post.id ? "#1A1A0A" : "#111",
                        border: `1px solid ${selectedPost?.id === post.id ? "#C9A84C" : "#1A1A1A"}`,
                        padding: "16px", cursor: "pointer",
                      }}
                    >
                      <p style={{ color: "#F5F5F5", fontSize: "13px", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {post.message || "(Photo sans texte)"}
                      </p>
                      <div style={{ display: "flex", gap: "16px" }}>
                        <span style={{ color: "#555", fontSize: "12px" }}>
                          💬 {post.comments?.summary?.total_count || 0}
                        </span>
                        <span style={{ color: "#555", fontSize: "12px" }}>
                          ❤️ {post.reactions?.summary?.total_count || 0}
                        </span>
                        <span style={{ color: "#444", fontSize: "12px" }}>
                          {new Date(post.created_time).toLocaleDateString("fr-CA")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments panel */}
            {selectedPost && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase" }}>Commentaires</p>
                  <button onClick={() => setSelectedPost(null)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "12px" }}>✕</button>
                </div>
                {comments.length === 0 ? (
                  <p style={{ color: "#333", fontSize: "14px" }}>Aucun commentaire</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {comments.map(c => (
                      <div key={c.id} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <p style={{ color: "#C9A84C", fontSize: "12px" }}>{c.from?.name || "Anonyme"}</p>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ color: "#444", fontSize: "11px" }}>{new Date(c.created_time).toLocaleDateString("fr-CA")}</span>
                            <button onClick={() => handleDelete(c.id)} style={{ background: "none", border: "none", color: "#4a1a1a", cursor: "pointer", fontSize: "12px" }} title="Supprimer">🗑</button>
                          </div>
                        </div>
                        <p style={{ color: "#E5E5E5", fontSize: "14px", lineHeight: 1.5, marginBottom: "12px" }}>{c.message}</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="text"
                            placeholder="Répondre..."
                            value={replyText[c.id] || ""}
                            onChange={e => setReplyText(t => ({ ...t, [c.id]: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && handleReply(c.id)}
                            style={{ flex: 1, background: "#0A0A0A", border: "1px solid #222", color: "#F5F5F5", padding: "8px 12px", fontSize: "13px", outline: "none" }}
                          />
                          <button
                            onClick={() => handleReply(c.id)}
                            disabled={replyLoading === c.id || !replyText[c.id]?.trim()}
                            style={{ background: "#C9A84C", border: "none", color: "#0A0A0A", padding: "8px 16px", fontSize: "12px", cursor: "pointer", opacity: replyLoading === c.id ? 0.5 : 1 }}
                          >
                            {replyLoading === c.id ? "..." : "Envoyer"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Setup guide */}
        <div style={{ marginTop: "48px" }}>
        {/* Google My Business setup */}
        {(!process.env.NEXT_PUBLIC_GOOGLE_GMB_CONFIGURED) && (
          <div style={{ marginBottom: "24px", background: "#0D0D0D", border: "1px solid #1A1A1A", padding: "28px" }}>
            <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>Configuration Google My Business</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {[
                "Va sur console.cloud.google.com → Nouveau projet → Ciseau Noir",
                "APIs & Services → Bibliothèque → Active Business Profile API",
                "Identifiants → Créer ID client OAuth → Application Web",
                "URI de redirection : https://ciseaunoirbarbershop.com/api/google/callback",
                "Copie Client ID + Secret dans .env.local",
              ].map((text, i) => (
                <div key={i} style={{ display: "flex", gap: "16px" }}>
                  <span style={{ color: "#C9A84C", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <p style={{ color: "#666", fontSize: "13px", lineHeight: 1.6 }}>{text}</p>
                </div>
              ))}
            </div>
            <a
              href="/api/google/auth"
              style={{ display: "inline-block", background: "#111", border: "1px solid #C9A84C", color: "#C9A84C", padding: "10px 24px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", textDecoration: "none" }}
            >
              🔗 Autoriser Google My Business
            </a>
          </div>
        )}
        <div style={{ background: "#0D0D0D", border: "1px solid #1A1A1A", padding: "28px" }}>
          <p style={{ color: "#555", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Guide de configuration Meta</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { step: "1", text: "Va sur developers.facebook.com → Mes applications → Créer une application" },
              { step: "2", text: "Choisis \"Business\" → donne le nom \"Ciseau Noir\"" },
              { step: "3", text: "Ajoute le produit \"Facebook Login\" et \"Instagram Graph API\"" },
              { step: "4", text: "Dans Graph API Explorer → sélectionne ta page → génère un Page Access Token avec permissions : pages_manage_posts, pages_read_engagement, pages_manage_engagement, instagram_basic, instagram_content_publish" },
              { step: "5", text: "Convertis le token en token long-durée (60 jours) via l'API Token Debug" },
              { step: "6", text: "Ajoute FACEBOOK_PAGE_ID, FACEBOOK_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID dans ton .env.local sur Vercel" },
            ].map(({ step, text }) => (
              <div key={step} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <span style={{ color: "#C9A84C", fontSize: "12px", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>{step}.</span>
                <p style={{ color: "#666", fontSize: "13px", lineHeight: 1.6 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
        </div>
        {portfolioModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 1000, overflow: "auto", padding: "40px 20px" }}>
            <div style={{ maxWidth: "900px", margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>Choisir une photo du portfolio</p>
                <button onClick={() => setPortfolioModal(false)} style={{ background: "none", border: "none", color: "#666", fontSize: "20px", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                {portfolioPhotos.map(photo => (
                  <div
                    key={photo.id}
                    onClick={() => { setImageUrl(photo.url); setPortfolioModal(false); }}
                    style={{ cursor: "pointer", border: "2px solid transparent", transition: "border-color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#C9A84C")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
                  >
                    <div style={{ paddingBottom: "100%", position: "relative", background: "#111" }}>
                      <Image src={photo.url} alt={photo.caption || ""} fill unoptimized style={{ objectFit: "cover" }} />
                    </div>
                    {photo.caption && <p style={{ color: "#888", fontSize: "11px", padding: "6px 4px", textAlign: "center" }}>{photo.caption}</p>}
                  </div>
                ))}
              </div>
              {portfolioPhotos.length === 0 && (
                <p style={{ color: "#444", textAlign: "center", padding: "60px" }}>Aucune photo dans le portfolio</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
