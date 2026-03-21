"use client";
import { useEffect, useState, useMemo } from "react";
import AdminSidebar from "@/components/AdminSidebar";

type Booking = {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  barber: string;
  service: string;
  price: number;
  date: string;
  time: string;
  status: string;
};

type ClientStats = {
  name: string;
  phone: string;
  email: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string;
  noShowCount: number;
  loyaltyProgress: number; // X out of 10
};

type SortKey = "name" | "totalVisits" | "totalSpent" | "lastVisit" | "noShowCount" | "loyaltyProgress";
type SortDir = "asc" | "desc";

export default function ClientsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalVisits");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(Array.isArray(data) ? data : data.bookings || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const clients = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = (b.client_email || b.client_phone || "").toLowerCase();
      if (!key) continue;
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }

    const stats: ClientStats[] = [];
    for (const [, bks] of map) {
      const completed = bks.filter((b) => b.status === "completed");
      const noShows = bks.filter((b) => b.status === "no_show");
      const lastCompleted = completed
        .map((b) => b.date)
        .sort()
        .reverse()[0] || "";
      const latest = bks[0];

      stats.push({
        name: latest.client_name,
        phone: latest.client_phone || "",
        email: latest.client_email || "",
        totalVisits: completed.length,
        totalSpent: completed.reduce((sum, b) => sum + (b.price || 0), 0),
        lastVisit: lastCompleted,
        noShowCount: noShows.length,
        loyaltyProgress: completed.length % 10,
      });
    }
    return stats;
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            c.email.toLowerCase().includes(q)
        )
      : clients;

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "lastVisit") cmp = a.lastVisit.localeCompare(b.lastVisit);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [clients, search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const thStyle: React.CSSProperties = {
    padding: "14px 12px",
    color: "#C9A84C",
    fontSize: "10px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    textAlign: "left",
    borderBottom: "1px solid #1A1A1A",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
    fontWeight: 500,
  };

  const tdStyle: React.CSSProperties = {
    padding: "14px 12px",
    fontSize: "13px",
    color: "#CCC",
    borderBottom: "1px solid #111",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0A0A0A" }}>
      <AdminSidebar />
      <main style={{ marginLeft: "260px", flex: 1, padding: "40px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <p
            style={{
              color: "#C9A84C",
              letterSpacing: "4px",
              fontSize: "11px",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Administration
          </p>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 300,
              letterSpacing: "6px",
              color: "#F5F5F5",
              margin: 0,
            }}
          >
            CLIENTS
          </h1>
          <div
            style={{
              width: "40px",
              height: "2px",
              background: "#C9A84C",
              marginTop: "12px",
            }}
          />
        </div>

        {/* Search */}
        <div style={{ marginBottom: "24px" }}>
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone ou courriel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "12px 18px",
              background: "#111",
              border: "1px solid #222",
              color: "#F5F5F5",
              fontSize: "13px",
              borderRadius: "4px",
              outline: "none",
              fontFamily: "Georgia, serif",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#C9A84C")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#222")}
          />
        </div>

        {/* Stats summary */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginBottom: "32px",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Total clients", value: clients.length },
            {
              label: "Visites complétées",
              value: clients.reduce((s, c) => s + c.totalVisits, 0),
            },
            {
              label: "Revenus totaux",
              value: `${clients.reduce((s, c) => s + c.totalSpent, 0).toFixed(2)}$`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#111",
                border: "1px solid #1A1A1A",
                padding: "20px 28px",
                minWidth: "160px",
              }}
            >
              <p
                style={{
                  color: "#555",
                  fontSize: "10px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                {stat.label}
              </p>
              <p
                style={{
                  color: "#C9A84C",
                  fontSize: "24px",
                  fontWeight: 300,
                  margin: 0,
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ color: "#555", fontSize: "14px" }}>Chargement...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "#555", fontSize: "14px" }}>
            {search ? "Aucun client trouvé." : "Aucun client enregistré."}
          </p>
        ) : (
          <div
            style={{
              background: "#0D0D0D",
              border: "1px solid #1A1A1A",
              borderRadius: "4px",
              overflow: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "800px",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle} onClick={() => handleSort("name")}>
                    Client{arrow("name")}
                  </th>
                  <th style={{ ...thStyle, cursor: "default" }}>Téléphone</th>
                  <th style={{ ...thStyle, cursor: "default" }}>Courriel</th>
                  <th style={thStyle} onClick={() => handleSort("totalVisits")}>
                    Visites{arrow("totalVisits")}
                  </th>
                  <th style={thStyle} onClick={() => handleSort("totalSpent")}>
                    Total ($){arrow("totalSpent")}
                  </th>
                  <th style={thStyle} onClick={() => handleSort("lastVisit")}>
                    Dernière visite{arrow("lastVisit")}
                  </th>
                  <th style={thStyle} onClick={() => handleSort("noShowCount")}>
                    No-shows{arrow("noShowCount")}
                  </th>
                  <th
                    style={thStyle}
                    onClick={() => handleSort("loyaltyProgress")}
                  >
                    Fidélité{arrow("loyaltyProgress")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={i}
                    style={{
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(212,175,55,0.03)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td style={{ ...tdStyle, color: "#F5F5F5", fontWeight: 500 }}>
                      {c.name}
                    </td>
                    <td style={tdStyle}>{c.phone || "—"}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontSize: "12px",
                        color: "#888",
                      }}
                    >
                      {c.email || "—"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#C9A84C",
                        fontWeight: 500,
                      }}
                    >
                      {c.totalVisits}
                    </td>
                    <td style={tdStyle}>
                      {c.totalSpent > 0 ? `${c.totalSpent.toFixed(2)}$` : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: "12px" }}>
                      {c.lastVisit
                        ? new Date(c.lastVisit + "T12:00:00").toLocaleDateString(
                            "fr-CA",
                            { day: "numeric", month: "short", year: "numeric" }
                          )
                        : "—"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: c.noShowCount > 0 ? "#e55" : "#555",
                      }}
                    >
                      {c.noShowCount}
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "60px",
                            height: "6px",
                            background: "#1A1A1A",
                            borderRadius: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${(c.loyaltyProgress / 10) * 100}%`,
                              height: "100%",
                              background:
                                c.loyaltyProgress >= 8
                                  ? "#C9A84C"
                                  : c.loyaltyProgress >= 5
                                  ? "#888"
                                  : "#444",
                              borderRadius: "3px",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.loyaltyProgress}/10
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p
          style={{
            color: "#333",
            fontSize: "11px",
            marginTop: "16px",
            letterSpacing: "1px",
          }}
        >
          {filtered.length} client{filtered.length !== 1 ? "s" : ""} affichés
        </p>
      </main>
    </div>
  );
}
