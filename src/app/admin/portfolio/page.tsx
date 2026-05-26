"use client";
import { useEffect, useState, useRef } from "react";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then(r => r.json())
      .then(data => { setPhotos(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setForm(f => ({ ...f, url: "" }));
    } else {
      setPreviewUrl("");
    }
  }

  async function handleAdd() {
    const hasFile = Boolean(selectedFile);
    const hasUrl = Boolean(form.url.trim());
    if (!hasFile && !hasUrl) return;

    setSaving(true);
    let photoUrl = form.url.trim();

    if (hasFile && selectedFile) {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("/api/admin/portfolio/upload", {
        method: "POST",
        body: fd,
      });
      setUploading(false);
      if (!res.ok) {
        alert("Erreur lors du téléversement de la photo.");
        setSaving(false);
        return;
      }
      const result = await res.json();
      photoUrl = result.url;
    }

    const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: photoUrl, caption: form.caption, tags, barber: form.barber }),
    });
    const data = await res.json();
    if (data.id) {
      setPhotos(p => [data, ...p]);
      setForm({ url: "", caption: "", tags: "", barber: "Melynda" });
      setSelectedFile(null);
      setPreviewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const displayPreview = previewUrl || form.url;
  const canSubmit = !saving && (Boolean(selectedFile) || Boolean(form.url.trim()));

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

              {/* File upload */}
              <div>
                <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
                  Photo ou vidéo depuis la galerie
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  id="photo-file-input"
                />
                <label
                  htmlFor="photo-file-input"
                  style={{
                    display: "inline-block",
                    background: selectedFile ? "#1A2A0A" : "#0A0A0A",
                    border: selectedFile ? "1px solid #4A6A10" : "1px solid #333",
                    color: selectedFile ? "#C9A84C" : "#888",
                    padding: "12px 20px",
                    fontSize: "13px",
                    letterSpacing: "1px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {selectedFile ? `Fichier : ${selectedFile.name}` : "📷 Photo ou vidéo"}
                </label>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    style={{ marginLeft: "10px", background: "none", border: "none", color: "#e55", cursor: "pointer", fontSize: "13px" }}
                  >
                    Retirer
                  </button>
                )}
              </div>

              {/* URL fallback */}
              <div>
                <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
                  Ou URL de la photo
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.url}
                  onChange={e => {
                    setForm(f => ({ ...f, url: e.target.value }));
                    if (e.target.value) {
                      setSelectedFile(null);
                      setPreviewUrl("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }
                  }}
                  style={{ background: "#0A0A0A", border: "1px solid #333", color: "#F5F5F5", padding: "12px 14px", fontSize: "14px", width: "100%", outline: "none" }}
                />
              </div>

              {/* Caption */}
              <div>
                <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
                  Legende (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Degrade classique"
                  value={form.caption}
                  onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  style={{ background: "#0A0A0A", border: "1px solid #333", color: "#F5F5F5", padding: "12px 14px", fontSize: "14px", width: "100%", outline: "none" }}
                />
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
                  Tags (separes par virgule)
                </label>
                <input
                  type="text"
                  placeholder="degrade, barbe, classique"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  style={{ background: "#0A0A0A", border: "1px solid #333", color: "#F5F5F5", padding: "12px 14px", fontSize: "14px", width: "100%", outline: "none" }}
                />
              </div>

              {/* Barber select */}
              <div>
                <label style={{ display: "block", color: "#888", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Barbier</label>
                <select
                  value={form.barber}
                  onChange={e => setForm(f => ({ ...f, barber: e.target.value }))}
                  style={{ background: "#0A0A0A", border: "1px solid #333", color: "#F5F5F5", padding: "12px 14px", fontSize: "14px", width: "100%", outline: "none" }}
                >
                  <option>Melynda</option>
                </select>
              </div>

              {/* Preview */}
              {displayPreview && (
                <div>
                  <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Apercu</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayPreview}
                    alt="Apercu"
                    style={{ maxWidth: "200px", maxHeight: "200px", objectFit: "cover", border: "1px solid #222" }}
                  />
                </div>
              )}

              {!canSubmit && !saving && (
                <p style={{ color: "#888", fontSize: "12px", marginBottom: "8px" }}>
                  ↑ Choisissez d&apos;abord une photo ou vidéo
                </p>
              )}
              <button
                onClick={handleAdd}
                disabled={!canSubmit}
                style={{
                  background: "#C9A84C",
                  border: "none",
                  color: "#0A0A0A",
                  padding: "12px 32px",
                  fontSize: "12px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  opacity: canSubmit ? 1 : 0.5,
                  alignSelf: "flex-start",
                }}
              >
                {uploading ? "Telechargement..." : saving ? "Ajout..." : "Ajouter →"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "#444" }}>Chargement...</p>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <p style={{ color: "#333", fontSize: "16px", marginBottom: "8px" }}>Aucune photo</p>
            <p style={{ color: "#222", fontSize: "13px" }}>Ajoutez vos premieres photos de coupes</p>
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
