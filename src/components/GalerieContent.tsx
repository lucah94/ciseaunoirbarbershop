"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type PortfolioItem = {
  id: string;
  image_url: string;
  title: string;
  category: string;
  created_at: string;
};

const CATEGORIES = ["Toutes", "Coupes", "Dégradés", "Barbes", "Rasages"];

export default function GalerieContent() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPortfolio() {
      const { data } = await supabase
        .from("portfolio")
        .select("id, image_url, title, category, created_at")
        .order("created_at", { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    }
    fetchPortfolio();
  }, []);

  const filtered =
    activeCategory === "Toutes"
      ? items
      : items.filter((i) => i.category === activeCategory);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightbox, closeLightbox]);

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .gallery-card {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(212,175,55,0.15);
          background: #0D0D0D;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          aspect-ratio: 1 / 1;
        }
        .gallery-card:hover {
          border-color: rgba(212,175,55,0.6);
          box-shadow: 0 0 30px rgba(212,175,55,0.25), 0 0 60px rgba(212,175,55,0.1);
          transform: translateY(-4px) scale(1.02);
        }
        .gallery-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.4s ease;
          display: flex;
          align-items: flex-end;
          padding: 20px;
        }
        .gallery-card:hover .gallery-card-overlay {
          opacity: 1;
        }
        .cat-btn {
          padding: 10px 24px;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          border-radius: 24px;
          border: 1px solid rgba(212,175,55,0.2);
          background: transparent;
          color: #999;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: inherit;
        }
        .cat-btn:hover {
          border-color: rgba(212,175,55,0.5);
          color: #D4AF37;
        }
        .cat-btn-active {
          background: linear-gradient(135deg, #D4AF37, #B8860B);
          color: #080808;
          border-color: #D4AF37;
          font-weight: 600;
        }
        .cat-btn-active:hover {
          color: #080808;
        }
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(0,0,0,0.92);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          cursor: pointer;
        }
        .lightbox-close {
          position: absolute;
          top: 24px;
          right: 32px;
          background: none;
          border: none;
          color: #D4AF37;
          font-size: 32px;
          cursor: pointer;
          transition: transform 0.3s ease, color 0.3s ease;
          z-index: 201;
        }
        .lightbox-close:hover {
          transform: scale(1.2);
          color: #E8C84A;
        }
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 900px) {
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 560px) {
          .gallery-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Hero */}
      <section
        style={{
          paddingTop: "160px",
          paddingBottom: "80px",
          textAlign: "center",
          background:
            "radial-gradient(ellipse at top, rgba(212,175,55,0.06) 0%, #080808 70%)",
          position: "relative",
        }}
      >
        <p
          style={{
            color: "#D4AF37",
            letterSpacing: "8px",
            fontSize: "11px",
            textTransform: "uppercase",
            marginBottom: "20px",
            fontWeight: 500,
          }}
        >
          Ciseau Noir
        </p>
        <h1
          style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            fontWeight: 300,
            letterSpacing: "10px",
            textTransform: "uppercase",
            marginBottom: "20px",
            background:
              "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s linear infinite",
          }}
        >
          Nos Réalisations
        </h1>
        <div
          style={{
            width: "80px",
            height: "2px",
            background:
              "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "0 auto 28px",
          }}
        />
        <p
          style={{
            color: "#888",
            fontSize: "16px",
            maxWidth: "520px",
            margin: "0 auto",
            lineHeight: 1.9,
            letterSpacing: "0.5px",
          }}
        >
          Découvrez le savoir-faire de nos barbiers à travers nos réalisations.
        </p>
      </section>

      {/* Categories Filter */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 20px 48px",
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`cat-btn ${activeCategory === cat ? "cat-btn-active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </section>

      {/* Gallery Grid */}
      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 20px 100px",
        }}
      >
        {loading ? (
          <p
            style={{
              textAlign: "center",
              color: "#666",
              fontSize: "14px",
              letterSpacing: "1px",
              padding: "60px 0",
            }}
          >
            Chargement...
          </p>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              border: "1px solid rgba(212,175,55,0.15)",
              borderRadius: "16px",
              background: "#0D0D0D",
            }}
          >
            <p
              style={{
                color: "#888",
                fontSize: "16px",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}
            >
              Aucune réalisation pour le moment.
            </p>
            <p
              style={{
                color: "#555",
                fontSize: "14px",
              }}
            >
              Revenez bientôt pour découvrir nos dernières créations.
            </p>
          </div>
        ) : (
          <div className="gallery-grid">
            {filtered.map((item, index) => (
              <div
                key={item.id}
                className="gallery-card"
                onClick={() => setLightbox(item)}
                role="button"
                tabIndex={0}
                aria-label={`Voir ${item.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightbox(item);
                  }
                }}
                style={{
                  animationName: "fadeInUp",
                  animationDuration: "0.6s",
                  animationFillMode: "both",
                  animationDelay: `${index * 0.08}s`,
                }}
              >
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  unoptimized
                  style={{ objectFit: "cover" }}
                  sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw"
                />
                <div className="gallery-card-overlay">
                  <div>
                    <p
                      style={{
                        color: "#F0F0F0",
                        fontSize: "16px",
                        fontWeight: 400,
                        letterSpacing: "1px",
                        marginBottom: "4px",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        color: "#D4AF37",
                        fontSize: "11px",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.category}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="lightbox-overlay"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.title}
        >
          <button
            className="lightbox-close"
            onClick={closeLightbox}
            aria-label="Fermer"
          >
            ✕
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "800px",
              maxHeight: "80vh",
              aspectRatio: "4 / 3",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid rgba(212,175,55,0.3)",
              boxShadow: "0 0 60px rgba(212,175,55,0.15)",
            }}
          >
            <Image
              src={lightbox.image_url}
              alt={lightbox.title}
              fill
              unoptimized
              style={{ objectFit: "contain", background: "#0D0D0D" }}
              sizes="80vw"
            />
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "32px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "#F0F0F0",
                fontSize: "18px",
                letterSpacing: "2px",
                marginBottom: "6px",
              }}
            >
              {lightbox.title}
            </p>
            <p
              style={{
                color: "#D4AF37",
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              {lightbox.category}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
