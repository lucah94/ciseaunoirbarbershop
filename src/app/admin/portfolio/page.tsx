"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import AdminSidebar from "@/components/AdminSidebar";

type Photo = {
  id: string;
  url: string;
  caption?: string;
  tags?: string[];
  barber: string;
  created_at: string;
};

export default function PortfolioPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: "", caption: "", tags: "", barber: "Melynda" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/portfolio")
      .then(r => r.json())
      .then(data => { setPhotos(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  async function handleAdd() {
    if (!form.url.trim()) return;
    setSaving(true);
    const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: form.url, caption: form.caption, tags, barber: form.barber }),
    });
    const data = await res.json();
    if (data.id) {
      setPhotos(p => [data, ...p]);
      setForm({ url: "", caption: "", tags: "", barber: "Melynda" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette photo ?")) return;
    await fetch("/api/portfolio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPhotos(p => p.filter(ph => ph.id !== id));
  }

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "3px", color: "#F5F5F5", marginBottom: "4px" }}>Portfolio</h1>
            <p style={{ color: "#444", fontSize: "13px" }}>{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            style={{ background: "#C9A84C", border: "none", color: "#0A0A0A", padding: "10px 24px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontWeight: 700 }}
          >
            {showForm ? "✕ Annuler" : "+ Ajouter une photo"}
          </button>
        </div>

        {showForm && (
          <div style={{ background: "#111", border: "1px solid #1A1A1A", padding: "28px", marginBottom: "32px", maxWidth: "600px" }}>
            <p style={{ color: "#C9A84C", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Nouvelle photo</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { label: "URL de la photo *", key: "url", placeholder: "https://..." },
                { label: "Légende (optionnel)", key: "caption", placeholder: "Ex: Dégradé classique" },
                { label: "Tags (séparés par virgule)", key: "tags", placeholder: "dégradé, barbe, classique" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ background: "#0A0A0A", border: "1px solid #333", color: "#F5F5F5", padding: "12px 14px", fontSize: "14px", width: "100%", outline: "none" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Barbier</label>
                <select
                  value={form.barber}
                  onChange={e => setForm(f => ({ ...f, barber: e.target.value }))}
                  style={{ background: "#0A0A0A", border: "1px solid #333", color: "#F5F5F5", padding: "12px 14px", fontSize: "14px", width: "100%", outline: "none" }}
                >
                  <option>Melynda</option>
                  <option>Diodis</option>
                </select>
              </div>
              {form.url && (
                <Image src={form.url} alt="preview" width={200} height={200} unoptimized style={{ maxWidth: "200px", maxHeight: "200px", objectFit: "cover", border: "1px solid #222" }} />
              )}
              <button
                onClick={handleAdd}
                disabled={saving || !form.url.trim()}
                style={{ background: "#C9A84C", border: "none", color: "#0A0A0A", padding: "12px 32px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontWeight: 700, opacity: (saving || !form.url) ? 0.5 : 1, alignSelf: "flex-start" }}
              >
                {saving ? "Ajout..." : "Ajouter →"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "#444" }}>Chargement...</p>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <p style={{ color: "#333", fontSize: "16px", marginBottom: "8px" }}>Aucune photo</p>
            <p style={{ color: "#222", fontSize: "13px" }}>Ajoutez vos premières photos de coupes</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
            {photos.map(photo => (
              <div key={photo.id} style={{ background: "#111", border: "1px solid #1A1A1A", overflow: "hidden", position: "relative" }}>
                <div style={{ position: "relative", paddingBottom: "100%", background: "#0A0A0A" }}>
                  <Image
                    src={photo.url}
                    alt={photo.caption || "Photo"}
                    fill
                    unoptimized
                    style={{ objectFit: "cover" }}
                  />
                  <button
                    onClick={() => handleDelete(photo.id)}
                    style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.7)", border: "1px solid #4a1a1a", color: "#e55", width: "28px", height: "28px", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: "12px" }}>
                  {photo.caption && <p style={{ color: "#F5F5F5", fontSize: "13px", marginBottom: "8px" }}>{photo.caption}</p>}
                  {photo.tags && photo.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                      {photo.tags.map(tag => (
                        <span key={tag} style={{ background: "#1A1A0A", border: "1px solid #2A2A10", color: "#C9A84C", fontSize: "10px", padding: "2px 8px", letterSpacing: "1px" }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <p style={{ color: "#444", fontSize: "11px" }}>{photo.barber} · {new Date(photo.created_at).toLocaleDateString("fr-CA")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
