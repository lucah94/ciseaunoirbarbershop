"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { localDateStr } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

type Booking = {
  id: string; client_name: string; client_phone: string; client_email: string;
  barber: string; service: string; price: number; date: string; time: string;
  status: string; note: string; source?: string;
};

type ClientResult = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

type Block = {
  id: string; barber: string; date: string; start_time: string; end_time: string; reason: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#D4AF37",
  completed: "#5a5",
  cancelled: "#e55",
  no_show: "#f90",
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirme",
  completed: "Complete",
  cancelled: "Annule",
  no_show: "No-show",
};

// Palette de couleurs assignée par ordre des barbiers (1er or, 2e bleu, 3e vert, 4e rose...).
// Chaque barbier a une couleur distincte automatiquement — peu importe combien il y en a.
const BARBER_PALETTE = ["#D4AF37", "#4A9EDB", "#4CAF50", "#E0699F", "#E58A4A", "#9B7EDE", "#52B9C4", "#C45252"];

const SERVICES = [
  { label: "Coupe + Lavage", price: 35 },
  { label: "Coupe + Rasage Lame & Serviette Chaude", price: 50 },
  { label: "Service Premium", price: 75 },
  { label: "Rasage / Barbe", price: 25 },
  { label: "Étudiant / Enfant", price: 30 },
  { label: "Coupe (enfants,étudiants,bébés)", price: 30 },
];


const TIME_SLOTS: string[] = [];
for (let h = 8; h < 21; h++) {
  for (const m of [0, 15, 30, 45]) {
    if (h === 8 && m === 0) continue; // start at 08:15
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export default function AgendaPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const retryRef = useRef(0);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const calendarRef = useRef<FullCalendar>(null);
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
  const [isMobile, setIsMobile] = useState(false);

  // New RDV modal state
  const [showNewRDV, setShowNewRDV] = useState(false);
  const [newRDV, setNewRDV] = useState({
    client_name: "", client_phone: "", client_email: "",
    barber: "Melynda", service: "Coupe + Lavage", price: 35,
    date: localDateStr(), time: "09:00", note: "",
    is_recurring: false, recurrence_pattern: "biweekly", recurrence_count: 8,
  });
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Block tranche horaire
  const [showBlock, setShowBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ barber: "Melynda", date: localDateStr(), start_time: "09:00", end_time: "11:00", reason: "" });
  const [blockSaving, setBlockSaving] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [barbers, setBarbers] = useState<{ name: string; schedule: Record<string, { open: string; close: string } | null> }[]>([]);
  const [overrides, setOverrides] = useState<{ barber: string; date: string; open: string; close: string }[]>([]);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ service: "", price: 0, barber: "", date: "", time: "", end_time: "", note: "", client_name: "", client_phone: "", client_email: "" });
  const [editSaving, setEditSaving] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Close client dropdown on outside click or Escape
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fenêtre glissante : on charge aujourd'hui −60j → futur (au lieu de TOUT depuis janvier).
  // datesSet (sur le calendrier) étend la fenêtre vers le passé si on y navigue.
  const startRef = useRef<string>((() => { const d = new Date(); d.setDate(d.getDate() - 60); return localDateStr(d); })());

  const fetchBookings = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12000);
    fetch(`/api/bookings?start=${startRef.current}&_=${Date.now()}`, { signal: ctrl.signal, cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        clearTimeout(timeout);
        const list = Array.isArray(data) ? data : [];
        setBookings(list);
        setLoading(false);
        setLoadError(false);
        retryRef.current = 0;

        // Fetch loyalty visit counts for unique client emails
        const emails = [...new Set(list.map((b: Booking) => b.client_email).filter(Boolean))] as string[];
        emails.forEach(email => {
          fetch(`/api/loyalty?email=${encodeURIComponent(email)}&_=${Date.now()}`, { cache: "no-store" })
            .then(r => r.json())
            .then(d => {
              if (d && typeof d.visits === "number") {
                setVisitCounts(prev => ({ ...prev, [email]: d.visits }));
              }
            })
            .catch(() => {});
        });
      })
      .catch(() => {
        clearTimeout(timeout);
        setLoading(false);
        setLoadError(true);
        // Auto-retry up to 5 times with increasing delay
        if (retryRef.current < 5) {
          retryRef.current += 1;
          setTimeout(fetchBookings, retryRef.current * 3000);
        }
      });
  }, []);

  const fetchBlocks = useCallback(() => {
    fetch(`/api/admin/blocks?_=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => setBlocks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Charger barbers + day_overrides pour validation horaire
  useEffect(() => {
    const loadBarbersOverrides = () => {
      fetch(`/api/barbers?_=${Date.now()}`, { cache: "no-store" })
        .then(r => r.json())
        .then(data => Array.isArray(data) && setBarbers(data))
        .catch(() => {});
      fetch(`/api/admin/day-overrides?_=${Date.now()}`, { cache: "no-store" })
        .then(r => r.json())
        .then(data => Array.isArray(data) && setOverrides(data))
        .catch(() => {});
    };
    loadBarbersOverrides();
    const channel = supabase.channel("agenda-barbers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "barbers" }, loadBarbersOverrides)
      .on("postgres_changes", { event: "*", schema: "public", table: "barber_day_overrides" }, loadBarbersOverrides)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchBlocks();

    // Push live via Supabase Realtime — 0 délai, vrai WebSocket
    const channel = supabase
      .channel("admin-agenda-realtime")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => { if (!selected && !showNewRDV && !showBlock) fetchBookings(); }
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "barber_blocks" },
        () => { if (!selected && !showNewRDV && !showBlock) fetchBlocks(); }
      )
      .subscribe();

    // Filet polling 5 min (au cas où WebSocket déconnecte)
    const interval = setInterval(() => {
      if (!selected && !showNewRDV && !showBlock) {
        fetchBookings();
        fetchBlocks();
      }
    }, 300000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchBookings, fetchBlocks, selected, showNewRDV, showBlock]);

  // Client search with debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (clientSearch.trim().length < 2) {
      setClientResults([]);
      setShowClientDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/clients?q=${encodeURIComponent(clientSearch.trim())}&_=${Date.now()}`, { cache: "no-store" })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setClientResults(data);
            setShowClientDropdown(data.length > 0);
          }
        })
        .catch(() => {});
    }, 300);
  }, [clientSearch]);

  function selectClient(c: ClientResult) {
    setNewRDV(prev => ({
      ...prev,
      client_name: c.name || "",
      client_phone: c.phone || "",
      client_email: c.email || "",
    }));
    setClientSearch(c.name || "");
    setShowClientDropdown(false);
    setClientResults([]);
  }

  async function submitNewRDV() {
    if (!newRDV.client_name.trim() || !newRDV.date || !newRDV.time) return;
    setSubmitting(true);
    try {
      const endpoint = newRDV.is_recurring ? "/api/bookings/recurring" : "/api/bookings";
      const body = newRDV.is_recurring
        ? {
            client_name: newRDV.client_name.trim(),
            client_phone: newRDV.client_phone.trim(),
            client_email: newRDV.client_email.trim(),
            barber: newRDV.barber,
            service: newRDV.service,
            price: newRDV.price,
            date: newRDV.date,
            time: newRDV.time,
            note: newRDV.note.trim(),
            recurrence_pattern: newRDV.recurrence_pattern,
            recurrence_count: newRDV.recurrence_count,
          }
        : {
            client_name: newRDV.client_name.trim(),
            client_phone: newRDV.client_phone.trim(),
            client_email: newRDV.client_email.trim(),
            barber: newRDV.barber,
            service: newRDV.service,
            price: newRDV.price,
            date: newRDV.date,
            time: newRDV.time,
            note: newRDV.note.trim(),
            status: "confirmed",
            force: true,
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json().catch(() => null);
        const isRecurring = newRDV.is_recurring;
        const targetDate = newRDV.date;
        setShowNewRDV(false);
        setSubmitError(null);
        resetNewRDVForm();
        if (!isRecurring && created && created.id) {
          // Non-récurrent : ajout direct au state, pas de reset calendrier
          setBookings(prev => [...prev, created]);
          if (calendarRef.current) {
            calendarRef.current.getApi().gotoDate(created.date);
          }
        } else {
          // Récurrent : refresh silencieux (pas de loading = pas de reset calendrier)
          fetch(`/api/bookings?start=${startRef.current}&_=${Date.now()}`, { cache: "no-store" })
            .then(r => r.json())
            .then(data => {
              const list = Array.isArray(data) ? data : [];
              setBookings(list);
              if (calendarRef.current) {
                calendarRef.current.getApi().gotoDate(targetDate);
              }
            })
            .catch(() => {});
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setSubmitError(res.status === 409
          ? `⚠️ ${errData.error || "Ce créneau est déjà occupé."}`
          : `Erreur: ${errData.error || "Impossible de créer le RDV."}`);
      }
    } catch (e) {
      console.error("New RDV error:", e);
      setSubmitError("Erreur de connexion. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetNewRDVForm() {
    setSubmitError(null);
    setNewRDV({
      client_name: "", client_phone: "", client_email: "",
      barber: "Melynda", service: "Coupe + Lavage", price: 35,
      date: localDateStr(), time: "09:00", note: "",
      is_recurring: false, recurrence_pattern: "biweekly", recurrence_count: 8,
    });
    setClientSearch("");
    setClientResults([]);
    setShowClientDropdown(false);
  }

  async function saveBlock() {
    if (!blockForm.date || !blockForm.start_time || !blockForm.end_time) return;
    setBlockSaving(true);
    await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barber: blockForm.barber.toLowerCase(), date: blockForm.date, start_time: blockForm.start_time, end_time: blockForm.end_time, reason: blockForm.reason || null }),
    });
    setShowBlock(false);
    setBlockSaving(false);
    fetchBlocks();
  }

  async function saveEdit() {
    if (!selected) return;

    // Validation: end_time doit être après time
    if (editForm.end_time && editForm.time) {
      const [sh, sm] = editForm.time.split(":").map(Number);
      const [eh, em] = editForm.end_time.split(":").map(Number);
      if (eh * 60 + em <= sh * 60 + sm) {
        alert("L'heure de fin doit être après l'heure de début");
        return;
      }
    }
    if (editForm.price < 0) { alert("Prix invalide"); return; }

    setEditSaving(true);
    const updates: Record<string, string | number> = {};
    if (editForm.service !== selected.service) updates.service = editForm.service;
    if (editForm.price !== selected.price) updates.price = editForm.price;
    if (editForm.barber !== selected.barber) updates.barber = editForm.barber;
    if (editForm.date !== selected.date) updates.date = editForm.date;
    if (editForm.time !== selected.time) updates.time = editForm.time;
    if (editForm.end_time && editForm.end_time !== (selected as Booking & { end_time?: string }).end_time) updates.end_time = editForm.end_time;
    if (editForm.note !== (selected.note || "")) updates.note = editForm.note;
    if (editForm.client_name !== selected.client_name) updates.client_name = editForm.client_name;
    if (editForm.client_phone !== (selected.client_phone || "")) updates.client_phone = editForm.client_phone;
    if (editForm.client_email !== (selected.client_email || "")) updates.client_email = editForm.client_email;
    if (Object.keys(updates).length > 0) {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, ...updates, force: true }),
      });
      const data = await res.json();
      if (!data.error) {
        const updated = { ...selected, ...updates };
        setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, ...updates } as Booking : b));
        setSelected(updated as Booking);
      }
    }
    setEditing(false);
    setEditSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    if (status === "cancelled" && !confirm("Etes-vous sur de vouloir annuler ce rendez-vous ?")) return;
    await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);

    if (status === "completed") {
      const booking = bookings.find(b => b.id === id);
      if (booking?.client_email) {
        await fetch("/api/review-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: booking.client_name,
            client_email: booking.client_email,
            barber: booking.barber,
            service: booking.service,
          }),
        });
      }
    }
  }

  async function markNoShow(id: string) {
    if (!confirm("Marquer ce rendez-vous comme no-show ? Un SMS sera envoye au client.")) return;
    const res = await fetch("/api/bookings/no-show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "no_show" } : b));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: "no_show" } : null);
    }
  }

  const filtered = bookings.filter(b => {
    if (b.status === "cancelled") return false;
    if (filter !== "all" && b.barber !== filter) return false;
    return true;
  });

  function svcDuration(service: string): number {
    const s = service.toLowerCase();
    if (s.includes("premium") || s.includes("forfait")) return 75;
    if ((s.includes("barbe") || s.includes("rasage") || s.includes("lame")) && s.includes("coupe")) return 60;
    if (s.includes("coupe") || s.includes("lavage") || s.includes("enfant") || s.includes("étudiant") || s.includes("etudiant")) return 45;
    return 30;
  }

  // Liste + couleurs dynamiques : viennent de la table barbers (réactif en temps réel)
  const barberNames = barbers.map(b => b.name);
  const barberColor = (name: string) => {
    const idx = barbers.findIndex(b => b.name === name);
    return idx >= 0 ? BARBER_PALETTE[idx % BARBER_PALETTE.length] : "#D4AF37";
  };

  // Grille horaire collée aux vraies heures (min ouverture → max fermeture des barbiers),
  // élargie au besoin pour ne jamais cacher un RDV hors-heures. Marge de 30 min de chaque bord.
  const { gridMin, gridMax } = (() => {
    let minM = 24 * 60, maxM = 0;
    const consider = (hhmm?: string) => {
      if (!hhmm) return;
      const [h, m] = hhmm.split(":").map(Number);
      if (isNaN(h)) return;
      minM = Math.min(minM, h * 60 + (m || 0));
      maxM = Math.max(maxM, h * 60 + (m || 0));
    };
    barbers.forEach(b => Object.values(b.schedule || {}).forEach(d => { if (d) { consider(d.open); consider(d.close); } }));
    bookings.forEach(b => { if (b.status !== "cancelled") { consider(b.time); consider((b as Booking & { end_time?: string }).end_time); } });
    if (minM >= maxM) return { gridMin: "08:00:00", gridMax: "21:00:00" };
    minM = Math.max(0, minM - 30);
    maxM = Math.min(24 * 60, maxM + 30);
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
    return { gridMin: fmt(minM), gridMax: fmt(maxM) };
  })();

  const events = filtered.map(b => {
    const [h, m] = (b.time || "0:0").split(":").map(Number);
    const padded = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const start = new Date(`${b.date}T${padded}:00`);
    const end = new Date(start.getTime());
    const bWithEnd = b as Booking & { end_time?: string };
    if (bWithEnd.end_time) {
      const [eh, em] = bWithEnd.end_time.split(":").map(Number);
      end.setHours(eh, em, 0, 0);
    } else {
      end.setMinutes(end.getMinutes() + svcDuration(b.service));
    }

    const startStr = isNaN(start.getTime()) ? b.date : start.toISOString();
    const endStr = isNaN(end.getTime()) ? b.date : end.toISOString();

    return {
      id: b.id,
      title: `${b.source && b.source !== "direct" ? (b.source === "google" ? "🔍 " : b.source === "facebook" ? "📘 " : b.source === "instagram" ? "📸 " : "") : ""}${b.client_name}${visitCounts[b.client_email] ? ` (${visitCounts[b.client_email]}e)` : ""} — ${b.service} · ${b.barber}`,
      start: startStr,
      end: endStr,
      backgroundColor: b.status === "cancelled" ? "#333" : barberColor(b.barber),
      borderColor: b.status === "cancelled" ? "#555" : barberColor(b.barber),
      textColor: b.status === "cancelled" ? "#888" : "#080808",
      extendedProps: { booking: b },
      classNames: b.status === "cancelled" ? ["event-cancelled"] : b.status === "no_show" ? ["event-noshow"] : [],
    };
  });

  const blockEvents = blocks
    .filter(bl => filter === "all" || bl.barber.toLowerCase() === filter.toLowerCase())
    .map(bl => ({
      id: `block-${bl.id}`,
      title: `🚫 ${bl.reason || "Bloqué"} — ${bl.barber.charAt(0).toUpperCase() + bl.barber.slice(1)}`,
      start: `${bl.date}T${bl.start_time}:00`,
      end: `${bl.date}T${bl.end_time}:00`,
      backgroundColor: "rgba(238,85,85,0.85)",
      borderColor: "#c33",
      textColor: "#fff",
      extendedProps: { isBlock: true, block: bl },
    }));

  function getServiceDuration(service: string): number {
    const s = service.toLowerCase();
    if (s.includes("premium")) return 75;
    if (s.includes("barbe") && s.includes("coupe")) return 60;
    if (s.includes("coupe")) return 45;
    return 30;
  }

  function bookingEndMin(b: Booking & { end_time?: string }): number {
    const [bh, bm] = (b.time || "0:0").split(":").map(Number);
    const start = bh * 60 + bm;
    if (b.end_time) {
      const [eh, em] = b.end_time.split(":").map(Number);
      return eh * 60 + em;
    }
    return start + getServiceDuration(b.service);
  }

  // Conflict detection for new RDV form
  const occupiedSlots = useMemo(() => {
    if (!newRDV.barber || !newRDV.date) return new Set<string>();
    const barberBookings = (bookings as (Booking & { end_time?: string })[]).filter(
      b => b.barber === newRDV.barber && b.date === newRDV.date && b.status !== "cancelled"
    );
    const occupied = new Set<string>();
    for (const slot of TIME_SLOTS) {
      const [sh, sm] = slot.split(":").map(Number);
      const slotMin = sh * 60 + sm;
      for (const b of barberBookings) {
        const [bh, bm] = (b.time || "0:0").split(":").map(Number);
        const bookingStart = bh * 60 + bm;
        const bookingEnd = bookingEndMin(b);
        if (slotMin >= bookingStart && slotMin < bookingEnd) { occupied.add(slot); break; }
        if (slotMin + 30 > bookingStart && slotMin < bookingEnd) { occupied.add(slot); break; }
      }
    }
    return occupied;
  }, [bookings, newRDV.barber, newRDV.date]);

  const currentSlotConflict = useMemo(() => {
    if (!newRDV.barber || !newRDV.date || !newRDV.time) return null;
    const [sh, sm] = newRDV.time.split(":").map(Number);
    const slotMin = sh * 60 + sm;

    // 1. Vérifier que le barbier travaille selon son horaire ce jour
    const dayKeys = ["sun","mon","tue","wed","thu","fri","sat"];
    const dayKey = dayKeys[new Date(newRDV.date + "T12:00:00").getDay()];
    const selectedBarber = barbers.find(b => b.name === newRDV.barber);
    if (selectedBarber) {
      // Day override prend priorité
      const override = (overrides as { barber: string; date: string; open: string; close: string }[]).find(
        o => o.barber.toLowerCase() === newRDV.barber.toLowerCase() && o.date === newRDV.date
      );
      let openMin: number | null = null;
      let closeMin: number | null = null;
      if (override) {
        const [oh, om] = override.open.split(":").map(Number);
        const [ch, cm] = override.close.split(":").map(Number);
        openMin = oh * 60 + om;
        closeMin = ch * 60 + cm;
      } else if (selectedBarber.schedule && selectedBarber.schedule[dayKey]) {
        const sch = selectedBarber.schedule[dayKey] as { open: string; close: string };
        const [oh, om] = sch.open.split(":").map(Number);
        const [ch, cm] = sch.close.split(":").map(Number);
        openMin = oh * 60 + om;
        closeMin = ch * 60 + cm;
      } else {
        // Pas dispo ce jour
        return `${newRDV.barber} ne travaille pas le ${["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][new Date(newRDV.date + "T12:00:00").getDay()]}`;
      }
      if (openMin !== null && closeMin !== null && (slotMin < openMin || slotMin >= closeMin)) {
        return `${newRDV.barber} travaille de ${selectedBarber.schedule?.[dayKey] ? (selectedBarber.schedule[dayKey] as {open:string}).open : ""} à ${selectedBarber.schedule?.[dayKey] ? (selectedBarber.schedule[dayKey] as {close:string}).close : ""} ce jour-là`;
      }
    }

    // 2. Vérifier overlap avec RDV existants
    const barberBookings = (bookings as (Booking & { end_time?: string })[]).filter(
      b => b.barber === newRDV.barber && b.date === newRDV.date && b.status !== "cancelled"
    );
    for (const b of barberBookings) {
      const [bh, bm] = (b.time || "0:0").split(":").map(Number);
      const bookingStart = bh * 60 + bm;
      const bookingEnd = bookingEndMin(b);
      if (slotMin >= bookingStart && slotMin < bookingEnd) {
        return `${newRDV.barber} a déjà un RDV de ${b.time} à ${Math.floor(bookingEnd/60)}:${String(bookingEnd%60).padStart(2,"0")}`;
      }
    }
    return null;
  }, [bookings, newRDV.barber, newRDV.date, newRDV.time, barbers, overrides]);

  // Shared input style
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#1C2129",
    border: "1px solid rgba(212,175,55,0.2)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#F0F0F0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    color: "#8B949E",
    fontSize: "11px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div style={{ background: "#111318", minHeight: "100vh", display: "flex" }}>
      <AdminSidebar />

      <main style={{ marginLeft: isMobile ? 0 : "260px", flex: 1, padding: isMobile ? "16px 16px 88px" : "32px 40px" }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "24px",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "16px" : "0",
        }}>
          <div>
            <h1 style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 300, letterSpacing: "2px", color: "#F0F0F0", marginBottom: "6px" }}>
              Agenda
            </h1>
            <p style={{ color: "#8B949E", fontSize: "13px", letterSpacing: "1px" }}>
              {bookings.filter(b => b.status !== "cancelled").length} reservation{bookings.filter(b => b.status !== "cancelled").length > 1 ? "s" : ""} actives
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Filtres par barbier — pastille couleur = légende + nombre de RDV de chacun.
                Clique un barbier pour le voir seul (clair), ou "Tous" pour tout voir. */}
            {[
              { key: "all", label: "Tous", color: "#D4AF37" },
              ...barberNames.map(name => ({ key: name, label: name, color: barberColor(name) })),
            ].map(f => {
              const active = filter === f.key;
              const count = f.key === "all"
                ? bookings.filter(b => b.status !== "cancelled").length
                : bookings.filter(b => b.status !== "cancelled" && b.barber === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: "7px",
                    background: active ? f.color : "#1C2129",
                    border: `1px solid ${active ? f.color : "rgba(255,255,255,0.12)"}`,
                    color: active ? "#080808" : "#C9D1D9",
                    padding: isMobile ? "6px 12px" : "8px 16px",
                    fontSize: isMobile ? "10px" : "12px",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    borderRadius: "20px",
                    transition: "all 0.2s ease",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {f.key !== "all" && (
                    <span style={{
                      width: "10px", height: "10px", borderRadius: "50%",
                      background: f.color,
                      border: active ? "1px solid rgba(0,0,0,0.3)" : "none",
                      flexShrink: 0,
                    }} />
                  )}
                  <span>{f.label}</span>
                  <span style={{
                    fontSize: isMobile ? "9px" : "10px",
                    fontWeight: 700,
                    opacity: active ? 0.7 : 0.55,
                    background: active ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.06)",
                    borderRadius: "10px",
                    padding: "1px 6px",
                  }}>{count}</span>
                </button>
              );
            })}

            {/* New RDV button */}
            <button
              onClick={() => { resetNewRDVForm(); setShowNewRDV(true); }}
              style={{
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                border: "none",
                color: "#080808",
                padding: isMobile ? "6px 14px" : "8px 20px",
                fontSize: isMobile ? "10px" : "11px",
                letterSpacing: "1px",
                textTransform: "uppercase",
                cursor: "pointer",
                borderRadius: "20px",
                fontWeight: 700,
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
            >
              + Nouveau RDV
            </button>
            <button
              onClick={() => setShowBlock(true)}
              style={{
                background: "rgba(238,85,85,0.1)", border: "1px solid rgba(238,85,85,0.3)", color: "#e55",
                padding: isMobile ? "6px 14px" : "8px 20px", fontSize: isMobile ? "10px" : "11px",
                letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer", borderRadius: "20px",
                fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              🚫 Bloquer
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{
              width: "40px", height: "40px", border: "3px solid rgba(212,175,55,0.2)",
              borderTop: "3px solid #D4AF37", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "13px" }}>CHARGEMENT</p>
            {loadError && (
              <p style={{ color: "#e55", fontSize: "12px", marginTop: "8px" }}>Reconnexion en cours...</p>
            )}
          </div>
        ) : loadError ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <p style={{ color: "#e55", fontSize: "18px", marginBottom: "12px" }}>Connexion interrompue</p>
            <p style={{ color: "#888", fontSize: "13px", marginBottom: "24px", lineHeight: 1.6 }}>
              Le serveur ne répond pas. Vérifiez que Supabase est actif.
            </p>
            <button
              onClick={() => { retryRef.current = 0; fetchBookings(); }}
              style={{
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                color: "#080808", border: "none", padding: "14px 32px",
                borderRadius: "8px", cursor: "pointer", fontSize: "13px",
                fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase",
              }}
            >Réessayer</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "24px", flexDirection: isMobile ? "column" : "row" }}>
            {/* Calendar */}
            <div style={{
              flex: 1,
              background: "#161B22",
              border: "1px solid rgba(212,175,55,0.18)",
              borderRadius: "16px",
              padding: isMobile ? "12px" : "24px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              position: "relative",
              overflow: "hidden",
            }}>
              <style>{`
                @keyframes goldPulse {
                  0%, 100% { box-shadow: 0 0 8px rgba(212,175,55,0.1); }
                  50% { box-shadow: 0 0 20px rgba(212,175,55,0.25), 0 0 40px rgba(212,175,55,0.08); }
                }
                @keyframes goldGlow {
                  0%, 100% { opacity: 0.3; }
                  50% { opacity: 0.7; }
                }
                .fc {
                  --fc-border-color: rgba(212,175,55,0.15);
                  --fc-today-bg-color: rgba(212,175,55,0.08);
                  --fc-page-bg-color: #111318;
                  --fc-neutral-bg-color: #161B22;
                  --fc-list-event-hover-bg-color: rgba(212,175,55,0.12);
                  font-family: inherit;
                }
                .fc .fc-toolbar-title {
                  font-size: ${isMobile ? "14px" : "22px"} !important;
                  font-weight: 300 !important;
                  letter-spacing: ${isMobile ? "1px" : "4px"} !important;
                  color: #F0F0F0 !important;
                  text-transform: uppercase !important;
                  background: linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B) !important;
                  background-size: 200% auto !important;
                  -webkit-background-clip: text !important;
                  -webkit-text-fill-color: transparent !important;
                }
                .fc .fc-button {
                  background: #1C2129 !important;
                  border: 1px solid rgba(212,175,55,0.2) !important;
                  color: #999 !important;
                  font-size: ${isMobile ? "9px" : "11px"} !important;
                  letter-spacing: 1px !important;
                  text-transform: uppercase !important;
                  padding: ${isMobile ? "5px 8px" : "8px 18px"} !important;
                  border-radius: 6px !important;
                  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1) !important;
                }
                .fc .fc-button:hover {
                  background: rgba(212,175,55,0.1) !important;
                  color: #D4AF37 !important;
                  border-color: rgba(212,175,55,0.5) !important;
                  box-shadow: 0 0 20px rgba(212,175,55,0.15), 0 4px 12px rgba(212,175,55,0.1) !important;
                }
                .fc .fc-button-active {
                  background: linear-gradient(135deg, #D4AF37, #B8860B) !important;
                  color: #080808 !important;
                  border-color: #D4AF37 !important;
                  font-weight: 600 !important;
                  box-shadow: 0 0 25px rgba(212,175,55,0.3), 0 4px 16px rgba(212,175,55,0.2) !important;
                }
                .fc .fc-col-header-cell {
                  background: #1C2129 !important;
                  padding: ${isMobile ? "8px 0" : "14px 0"} !important;
                  border-bottom: 1px solid rgba(212,175,55,0.12) !important;
                }
                .fc .fc-col-header-cell-cushion {
                  color: #D4AF37 !important;
                  font-size: ${isMobile ? "10px" : "12px"} !important;
                  letter-spacing: ${isMobile ? "1px" : "3px"} !important;
                  text-transform: uppercase !important;
                  text-decoration: none !important;
                  font-weight: 500 !important;
                }
                .fc .fc-timegrid-slot {
                  height: ${isMobile ? "44px" : "56px"} !important;
                  border-color: rgba(212,175,55,0.10) !important;
                  transition: background 0.2s ease !important;
                }
                .fc .fc-timegrid-slot:hover {
                  background: rgba(212,175,55,0.03) !important;
                }
                .fc .fc-timegrid-slot-label-cushion {
                  color: #8B949E !important;
                  font-size: ${isMobile ? "10px" : "12px"} !important;
                  font-variant-numeric: tabular-nums !important;
                  font-weight: 400 !important;
                }
                .fc .fc-timegrid-event {
                  border-radius: 8px !important;
                  border-width: 0 0 0 4px !important;
                  padding: ${isMobile ? "4px 6px" : "6px 10px"} !important;
                  font-size: ${isMobile ? "11px" : "13px"} !important;
                  cursor: pointer !important;
                  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1) !important;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
                }
                .fc .fc-timegrid-event:hover {
                  transform: scale(1.03) !important;
                  box-shadow: 0 4px 20px rgba(212,175,55,0.25), 0 0 30px rgba(212,175,55,0.1) !important;
                  z-index: 10 !important;
                }
                .fc .fc-timegrid-event .fc-event-title {
                  font-weight: 600 !important;
                  font-size: ${isMobile ? "11px" : "13px"} !important;
                }
                .fc .fc-timegrid-event .fc-event-time {
                  font-size: ${isMobile ? "9px" : "11px"} !important;
                  opacity: 0.85 !important;
                  font-weight: 500 !important;
                }
                .fc .fc-daygrid-event {
                  border-radius: 6px !important;
                  padding: 4px 8px !important;
                  font-size: 12px !important;
                  cursor: pointer !important;
                  transition: all 0.3s ease !important;
                }
                .fc .fc-daygrid-event:hover {
                  box-shadow: 0 4px 16px rgba(212,175,55,0.2) !important;
                  transform: translateY(-1px) !important;
                }
                .fc .fc-scrollgrid {
                  border-color: rgba(212,175,55,0.15) !important;
                  border-radius: 12px !important;
                  overflow: hidden !important;
                }
                .fc td, .fc th {
                  border-color: rgba(212,175,55,0.12) !important;
                }
                .fc .fc-timegrid-now-indicator-line {
                  border-color: #D4AF37 !important;
                  border-width: 2px !important;
                  box-shadow: 0 0 12px rgba(212,175,55,0.5), 0 0 24px rgba(212,175,55,0.2) !important;
                }
                .fc .fc-timegrid-now-indicator-arrow {
                  border-color: #D4AF37 !important;
                  border-top-color: transparent !important;
                  border-bottom-color: transparent !important;
                }
                .fc .fc-day-today {
                  background: rgba(212,175,55,0.06) !important;
                }
                .fc .fc-day-today .fc-col-header-cell-cushion {
                  color: #F0F0F0 !important;
                  font-weight: 700 !important;
                  text-shadow: 0 0 10px rgba(212,175,55,0.5) !important;
                }
                .fc .fc-daygrid-day:hover {
                  background: rgba(212,175,55,0.05) !important;
                }
                .fc .fc-daygrid-day-number {
                  color: #8B949E !important;
                  transition: all 0.2s ease !important;
                }
                .fc .fc-daygrid-day:hover .fc-daygrid-day-number {
                  color: #D4AF37 !important;
                  text-shadow: 0 0 8px rgba(212,175,55,0.4) !important;
                }
                .event-cancelled .fc-event-title { text-decoration: line-through !important; opacity: 0.5 !important; }
                .event-noshow { background-color: rgba(255,153,0,0.28) !important; border-color: #f90 !important; border-left: 4px solid #f90 !important; opacity: 1 !important; }
                .event-noshow .fc-event-title { color: #ffb84d !important; font-weight: 700 !important; }
                ${isMobile ? `
                .fc .fc-toolbar {
                  flex-direction: column !important;
                  gap: 8px !important;
                }
                .fc .fc-toolbar-chunk {
                  display: flex !important;
                  justify-content: center !important;
                }
                ` : ""}
              `}</style>
              <FullCalendar
                ref={calendarRef}
                datesSet={(arg: { start: Date }) => {
                  // Si on navigue avant la fenêtre chargée, on l'étend vers le passé (+30j de marge) et on recharge.
                  const viewStart = localDateStr(arg.start);
                  if (viewStart < startRef.current) {
                    const d = new Date(arg.start); d.setDate(d.getDate() - 30);
                    startRef.current = localDateStr(d);
                    fetchBookings();
                  }
                }}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "timeGridDay,timeGridWeek,dayGridMonth",
                }}
                locale="fr"
                firstDay={1}
                slotMinTime={gridMin}
                slotMaxTime={gridMax}
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                allDaySlot={false}
                nowIndicator={true}
                height="auto"
                expandRows={true}
                editable={true}
                events={[...events, ...blockEvents]}
                eventClick={(info) => {
                  if (info.event.extendedProps.isBlock) return;
                  const b = info.event.extendedProps.booking as Booking;
                  setSelected(b);
                }}
                eventOverlap={true}
                eventDrop={async (info) => {
                  if (info.event.extendedProps.isBlock) {
                    const bl = info.event.extendedProps.block as Block;
                    const newDate = info.event.startStr.split("T")[0];
                    const newStartTime = info.event.startStr.split("T")[1]?.slice(0, 5);
                    const newEndStr = info.event.endStr;
                    const newEndTime = newEndStr ? newEndStr.split("T")[1]?.slice(0, 5) : bl.end_time;
                    if (!newStartTime) { info.revert(); return; }
                    const res = await fetch("/api/admin/blocks", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: bl.id, date: newDate, start_time: newStartTime, end_time: newEndTime }),
                    });
                    if (!res.ok) { info.revert(); return; }
                    setBlocks(prev => prev.map(x => x.id === bl.id ? { ...x, date: newDate, start_time: newStartTime, end_time: newEndTime || x.end_time } : x));
                    return;
                  }
                  const b = info.event.extendedProps.booking as Booking;
                  const newDate = info.event.startStr.split("T")[0];
                  const newTime = info.event.startStr.split("T")[1]?.slice(0, 5) || b.time;
                  if (!confirm(`Deplacer ce rendez-vous au ${newDate} a ${newTime} ?`)) { info.revert(); return; }
                  const res = await fetch("/api/bookings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: b.id, date: newDate, time: newTime, force: true }),
                  });
                  if (!res.ok) {
                    info.revert();
                    const errData = await res.json().catch(() => ({}));
                    alert(`Erreur: ${errData.error || "impossible de déplacer ce RDV"}`);
                    return;
                  }
                  setBookings(prev => prev.map(x => x.id === b.id ? { ...x, date: newDate, time: newTime } : x));
                  if (selected?.id === b.id) setSelected(s => s ? { ...s, date: newDate, time: newTime } : s);
                }}
                eventResize={async (info) => {
                  if (info.event.extendedProps.isBlock) {
                    const bl = info.event.extendedProps.block as Block;
                    const newEndStr = info.event.endStr;
                    if (!newEndStr) { info.revert(); return; }
                    const newEndTime = newEndStr.split("T")[1]?.slice(0, 5);
                    const newStartTime = info.event.startStr.split("T")[1]?.slice(0, 5);
                    if (!newEndTime) { info.revert(); return; }
                    const res = await fetch("/api/admin/blocks", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: bl.id, start_time: newStartTime || bl.start_time, end_time: newEndTime }),
                    });
                    if (!res.ok) { info.revert(); return; }
                    setBlocks(prev => prev.map(x => x.id === bl.id ? { ...x, start_time: newStartTime || x.start_time, end_time: newEndTime } : x));
                    return;
                  }
                  const b = info.event.extendedProps.booking as Booking;
                  const endStr = info.event.endStr;
                  if (!endStr) { info.revert(); return; }
                  const newEndTime = endStr.split("T")[1]?.slice(0, 5);
                  if (!newEndTime) { info.revert(); return; }
                  const res = await fetch("/api/bookings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: b.id, end_time: newEndTime }),
                  });
                  if (!res.ok) {
                    info.revert();
                    return;
                  }
                  setBookings(prev => prev.map(x => x.id === b.id ? { ...x, end_time: newEndTime } : x));
                  if (selected?.id === b.id) setSelected(s => s ? { ...s, end_time: newEndTime } : s);
                }}
                buttonText={{
                  today: "Aujourd'hui",
                  month: "Mois",
                  week: "Semaine",
                  day: "Jour",
                }}
              />
            </div>

            {/* Detail panel - desktop: sidebar, mobile: bottom sheet */}
            {selected && !isMobile && (
              <div style={{
                width: "320px",
                flexShrink: 0,
                background: "#161B22",
                border: "1px solid rgba(212,175,55,0.1)",
                borderRadius: "12px",
                padding: "28px 24px",
                alignSelf: "flex-start",
                position: "sticky",
                top: "32px",
              }}>
                {renderDetailContent()}
              </div>
            )}
          </div>
        )}

        {/* Mobile bottom sheet for detail */}
        {selected && isMobile && (
          <>
            <div
              onClick={() => setSelected(null)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 140,
              }}
            />
            <div style={{
              position: "fixed",
              bottom: "72px",
              left: 0,
              right: 0,
              height: "auto",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "#161B22",
              borderTop: "2px solid #D4AF37",
              zIndex: 150,
              padding: "24px",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
            }}>
              {renderDetailContent()}
            </div>
          </>
        )}

        {/* New RDV Modal / Bottom Sheet */}
        {showNewRDV && (
          <>
            <div
              onClick={() => setShowNewRDV(false)}
              style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200,
              }}
            />
            <div style={{
              position: "fixed",
              ...(isMobile
                ? { bottom: "72px", left: 0, right: 0, maxHeight: "85vh", borderRadius: "16px 16px 0 0", borderTop: "2px solid #D4AF37" }
                : { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "480px", maxHeight: "90vh", borderRadius: "16px", border: "1px solid rgba(212,175,55,0.2)" }
              ),
              overflowY: "auto",
              background: "#0D0D0D",
              zIndex: 210,
              padding: isMobile ? "24px 20px 32px" : "32px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 80px rgba(212,175,55,0.06)",
            }}>
              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ color: "#F0F0F0", fontSize: "18px", fontWeight: 300, letterSpacing: "2px" }}>
                  Nouveau RDV
                </h2>
                <button
                  onClick={() => setShowNewRDV(false)}
                  style={{ background: "none", border: "none", color: "#555", fontSize: "22px", cursor: "pointer", padding: "4px 8px" }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Client search */}
                <div ref={clientDropdownRef} style={{ position: "relative" }}>
                  <label style={labelStyle}>Recherche client</label>
                  <input
                    type="text"
                    placeholder="Nom ou telephone..."
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); }}
                    style={inputStyle}
                  />
                  {showClientDropdown && clientResults.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 220,
                      background: "#111", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "8px",
                      maxHeight: "200px", overflowY: "auto", marginTop: "4px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                    }}>
                      {clientResults.map(c => (
                        <div
                          key={c.id}
                          onClick={() => selectClient(c)}
                          style={{
                            padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,175,55,0.1)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ color: "#F0F0F0", fontSize: "14px" }}>{c.name}</div>
                          <div style={{ color: "#666", fontSize: "12px" }}>{c.phone}{c.email ? ` - ${c.email}` : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label style={labelStyle}>Nom *</label>
                  <input
                    type="text"
                    value={newRDV.client_name}
                    onChange={e => setNewRDV(p => ({ ...p, client_name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                {/* Phone + Email row */}
                <div style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Telephone</label>
                    <input
                      type="tel"
                      value={newRDV.client_phone}
                      onChange={e => setNewRDV(p => ({ ...p, client_phone: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Email (optionnel)</label>
                    <input
                      type="email"
                      value={newRDV.client_email}
                      onChange={e => setNewRDV(p => ({ ...p, client_email: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Barber + Service row */}
                <div style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Barbiere *</label>
                    <select
                      value={newRDV.barber}
                      onChange={e => setNewRDV(p => ({ ...p, barber: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
                    >
                      {barberNames.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Service *</label>
                    <select
                      value={newRDV.service}
                      onChange={e => {
                        const svc = SERVICES.find(s => s.label === e.target.value);
                        setNewRDV(p => ({ ...p, service: e.target.value, price: svc?.price || 0 }));
                      }}
                      style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
                    >
                      {SERVICES.map(s => (
                        <option key={s.label} value={s.label}>{s.label} ({s.price}$)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date + Time row */}
                <div style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" : "row" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Date *</label>
                    <input
                      type="date"
                      value={newRDV.date}
                      onChange={e => setNewRDV(p => ({ ...p, date: e.target.value }))}
                      style={{ ...inputStyle, colorScheme: "dark" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Heure *</label>
                    <select
                      value={newRDV.time}
                      onChange={e => setNewRDV(p => ({ ...p, time: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
                    >
                      {TIME_SLOTS.map(t => {
                        const isOccupied = occupiedSlots.has(t);
                        const now = new Date();
                        const isToday = newRDV.date === localDateStr(now);
                        const [tH, tM] = t.split(":").map(Number);
                        const isPast = isToday && (tH < now.getHours() || (tH === now.getHours() && tM <= now.getMinutes()));
                        const disabled = isPast; // admin peut choisir créneaux occupés (force=true)
                        return (
                          <option key={t} value={t} disabled={disabled} style={isOccupied ? { color: "#E67E22", fontWeight: "bold" } : disabled ? { color: "#666" } : undefined}>
                            {t}{isOccupied ? " ⚠ occupe" : isPast ? " (passe)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Conflict warning */}
                {currentSlotConflict && (
                  <div style={{
                    background: "rgba(200,50,50,0.1)",
                    border: "1px solid #e55",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#e55",
                    fontSize: "13px",
                  }}>
                    {currentSlotConflict}
                  </div>
                )}

                {/* Note */}
                <div>
                  <label style={labelStyle}>Note (optionnel)</label>
                  <textarea
                    value={newRDV.note}
                    onChange={e => setNewRDV(p => ({ ...p, note: e.target.value }))}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                {/* Récurrence */}
                <div style={{ border: "1px solid #1E2430", borderRadius: "8px", padding: "16px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newRDV.is_recurring}
                      onChange={e => setNewRDV(p => ({ ...p, is_recurring: e.target.checked }))}
                      style={{ width: "16px", height: "16px", accentColor: "#D4AF37", cursor: "pointer" }}
                    />
                    <span style={{ color: "#D4AF37", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 600 }}>
                      RDV récurrent
                    </span>
                  </label>
                  {newRDV.is_recurring && (
                    <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <label style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Fréquence</label>
                        <select
                          value={newRDV.recurrence_pattern}
                          onChange={e => setNewRDV(p => ({ ...p, recurrence_pattern: e.target.value }))}
                          style={{ background: "#1C2129", border: "1px solid #2A3140", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%" }}
                        >
                          <option value="weekly">Chaque semaine</option>
                          <option value="biweekly">Chaque 2 semaines</option>
                          <option value="monthly">Chaque mois</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Nombre de RDV à créer</label>
                        <select
                          value={newRDV.recurrence_count}
                          onChange={e => setNewRDV(p => ({ ...p, recurrence_count: Number(e.target.value) }))}
                          style={{ background: "#1C2129", border: "1px solid #2A3140", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%" }}
                        >
                          <option value={4}>4 RDV (~1 mois)</option>
                          <option value={8}>8 RDV (~2 mois)</option>
                          <option value={12}>12 RDV (~3 mois)</option>
                          <option value={24}>24 RDV (~6 mois)</option>
                        </select>
                      </div>
                      <div style={{ background: "rgba(212,175,55,0.06)", borderRadius: "6px", padding: "10px 12px", color: "#888", fontSize: "12px" }}>
                        {newRDV.recurrence_count} RDV seront créés automatiquement à partir du {newRDV.date}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price display */}
                <div style={{
                  background: "rgba(212,175,55,0.06)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span style={{ color: "#888", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>Prix</span>
                  <span style={{ color: "#D4AF37", fontSize: "18px", fontWeight: 600 }}>{newRDV.price}$</span>
                </div>

                {/* Submit — disable si client manquant ou conflit horaire (pas de force submit avec erreur visible) */}
                <button
                  onClick={submitNewRDV}
                  disabled={submitting || !newRDV.client_name.trim() || (currentSlotConflict !== null && !currentSlotConflict.includes("a déjà un RDV"))}
                  style={{
                    background: submitting || !newRDV.client_name.trim()
                      ? "#333"
                      : "linear-gradient(135deg, #D4AF37, #B8860B)",
                    border: "none",
                    color: submitting || !newRDV.client_name.trim() ? "#666" : "#080808",
                    padding: "14px 24px",
                    fontSize: "13px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    cursor: submitting || !newRDV.client_name.trim() ? "not-allowed" : "pointer",
                    borderRadius: "8px",
                    fontWeight: 700,
                    transition: "all 0.2s ease",
                    width: "100%",
                    marginTop: "8px",
                  }}
                >
                  {submitting ? "Enregistrement..." : newRDV.is_recurring ? `Créer ${newRDV.recurrence_count} RDV récurrents` : "Créer le rendez-vous"}
                </button>
                {submitError && (
                  <div style={{ background: "rgba(238,85,85,0.1)", border: "1px solid rgba(238,85,85,0.3)", borderRadius: "8px", padding: "12px 16px", color: "#e55", fontSize: "13px", marginTop: "8px" }}>
                    {submitError}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      {/* Modal Bloquer tranche horaire */}
      {showBlock && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: "20px" }}
          onClick={e => { if (e.target === e.currentTarget) setShowBlock(false); }}>
          <div style={{ background: "#111318", border: "1px solid rgba(238,85,85,0.3)", borderRadius: "16px", width: "100%", maxWidth: "440px", padding: "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
              <p style={{ color: "#e55", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>🚫 Bloquer une tranche</p>
              <button onClick={() => setShowBlock(false)} style={{ background: "none", border: "none", color: "#666", fontSize: "24px", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Barbière</p>
                <select value={blockForm.barber} onChange={e => setBlockForm(f => ({ ...f, barber: e.target.value }))}
                  style={{ background: "#1C2129", border: "1px solid rgba(238,85,85,0.2)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%" }}>
                  {barberNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Date</p>
                <input type="date" value={blockForm.date} onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                  style={{ background: "#1C2129", border: "1px solid rgba(238,85,85,0.2)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%", colorScheme: "dark" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Début</p>
                  <input type="time" value={blockForm.start_time} onChange={e => setBlockForm(f => ({ ...f, start_time: e.target.value }))}
                    style={{ background: "#1C2129", border: "1px solid rgba(238,85,85,0.2)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%", colorScheme: "dark" }} />
                </div>
                <div>
                  <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Fin</p>
                  <input type="time" value={blockForm.end_time} onChange={e => setBlockForm(f => ({ ...f, end_time: e.target.value }))}
                    style={{ background: "#1C2129", border: "1px solid rgba(238,85,85,0.2)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%", colorScheme: "dark" }} />
                </div>
              </div>
              <div>
                <p style={{ color: "#555", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>Raison (optionnel)</p>
                <input value={blockForm.reason} onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="ex: Réunion, Lunch, Personnel..." style={{ background: "#1C2129", border: "1px solid rgba(238,85,85,0.2)", color: "#F0F0F0", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", width: "100%" }} />
              </div>
              <button onClick={saveBlock} disabled={blockSaving || !blockForm.date}
                style={{ background: "rgba(238,85,85,0.15)", border: "1px solid rgba(238,85,85,0.4)", color: "#e55", padding: "14px", cursor: "pointer", borderRadius: "8px", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", marginTop: "4px" }}>
                {blockSaving ? "..." : "Bloquer cette tranche"}
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );

  // Extracted detail panel content (used in both desktop sidebar and mobile bottom sheet)
  function renderDetailContent() {
    if (!selected) return null;
    const editInputStyle: React.CSSProperties = {
      width: "100%", background: "#111", border: "1px solid rgba(212,175,55,0.2)",
      color: "#F0F0F0", padding: "8px 10px", borderRadius: "6px", fontSize: "13px", colorScheme: "dark",
    };
    const labelStyle: React.CSSProperties = {
      color: "#7D8590", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "4px",
    };

    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ color: "#F0F0F0", fontSize: "16px", fontWeight: 400, letterSpacing: "1px" }}>
            {editing ? "Modifier le RDV" : "Details du RDV"}
          </h3>
          <button
            onClick={() => { setSelected(null); setEditing(false); }}
            style={{
              background: "none", border: "none", color: "#555", fontSize: "18px",
              cursor: "pointer", padding: "4px 8px",
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={labelStyle}>Client</p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <p style={{ color: "#F0F0F0", fontSize: "15px" }}>{selected.client_name}</p>
              {selected.client_email && visitCounts[selected.client_email] ? (
                <span style={{
                  background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                  color: "#080808", fontSize: "10px", fontWeight: 700,
                  padding: "2px 8px", borderRadius: "10px", letterSpacing: "0.5px", whiteSpace: "nowrap",
                }}>
                  {visitCounts[selected.client_email]}e visite
                </span>
              ) : null}
            </div>
          </div>
          <div>
            <p style={labelStyle}>Telephone</p>
            <p style={{ color: "#F0F0F0", fontSize: "15px" }}>
              <a href={`tel:${selected.client_phone}`} style={{ color: "inherit", textDecoration: "none" }}>{selected.client_phone}</a>
            </p>
          </div>
          {selected.client_email && (
            <div>
              <p style={labelStyle}>Email</p>
              <p style={{ color: "#F0F0F0", fontSize: "14px" }}>{selected.client_email}</p>
            </div>
          )}
          {selected.source && selected.source !== "direct" && (
            <div>
              <p style={labelStyle}>Source</p>
              <span style={{
                fontSize: "12px", padding: "4px 12px", borderRadius: "12px", fontWeight: 600,
                background: selected.source === "google" ? "rgba(66,133,244,0.15)" : selected.source === "facebook" ? "rgba(24,119,242,0.15)" : selected.source === "instagram" ? "rgba(225,48,108,0.15)" : "rgba(212,175,55,0.1)",
                color: selected.source === "google" ? "#4285F4" : selected.source === "facebook" ? "#1877F2" : selected.source === "instagram" ? "#E1306C" : "#D4AF37",
                border: `1px solid ${selected.source === "google" ? "rgba(66,133,244,0.3)" : selected.source === "facebook" ? "rgba(24,119,242,0.3)" : selected.source === "instagram" ? "rgba(225,48,108,0.3)" : "rgba(212,175,55,0.2)"}`,
              }}>
                {selected.source === "google" ? "🔍 Google" : selected.source === "facebook" ? "📘 Facebook" : selected.source === "instagram" ? "📸 Instagram" : selected.source === "messenger" ? "💬 Messenger" : selected.source}
              </span>
            </div>
          )}

          {editing ? (
            <>
              <div>
                <p style={labelStyle}>Nom du client</p>
                <input value={editForm.client_name} onChange={e => setEditForm(f => ({ ...f, client_name: e.target.value }))}
                  placeholder="Nom du client" style={editInputStyle} />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Téléphone</p>
                  <input value={editForm.client_phone} onChange={e => setEditForm(f => ({ ...f, client_phone: e.target.value }))}
                    placeholder="ex: 4185551234" style={editInputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Email</p>
                  <input type="email" value={editForm.client_email} onChange={e => setEditForm(f => ({ ...f, client_email: e.target.value }))}
                    placeholder="email@exemple.com" style={editInputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Service</p>
                  <select value={editForm.service} onChange={e => {
                    const svc = SERVICES.find(s => s.label === e.target.value);
                    setEditForm(f => ({ ...f, service: e.target.value, price: svc ? svc.price : f.price }));
                  }} style={editInputStyle}>
                    {SERVICES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                    {!SERVICES.find(s => s.label === editForm.service) && (
                      <option value={editForm.service}>{editForm.service}</option>
                    )}
                  </select>
                </div>
                <div style={{ width: "80px" }}>
                  <p style={labelStyle}>Prix</p>
                  <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: Number(e.target.value) }))}
                    style={editInputStyle} />
                </div>
              </div>
              <div>
                <p style={labelStyle}>Barbiere</p>
                <select value={editForm.barber} onChange={e => setEditForm(f => ({ ...f, barber: e.target.value }))}
                  style={editInputStyle}>
                  {barberNames.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Date</p>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    style={editInputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Heure</p>
                  <select value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                    style={editInputStyle}>
                    {TIME_SLOTS.map(t => {
                      const now = new Date();
                      const isToday = editForm.date === localDateStr(now);
                      const [tH, tM] = t.split(":").map(Number);
                      const isPast = isToday && (tH < now.getHours() || (tH === now.getHours() && tM <= now.getMinutes()));
                      return (
                        <option key={t} value={t} disabled={isPast} style={isPast ? { color: "#666" } : undefined}>
                          {t}{isPast ? " (passe)" : ""}
                        </option>
                      );
                    })}
                    {!TIME_SLOTS.includes(editForm.time) && (
                      <option value={editForm.time}>{editForm.time}</option>
                    )}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Heure de fin</p>
                  <input type="time" value={editForm.end_time} onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))}
                    style={editInputStyle} />
                </div>
              </div>
              <div>
                <p style={labelStyle}>Note</p>
                <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Note (optionnel)" style={editInputStyle} />
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button onClick={() => setEditing(false)}
                  style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#666", padding: "10px", cursor: "pointer", borderRadius: "8px", fontSize: "12px" }}>
                  Annuler
                </button>
                <button onClick={saveEdit} disabled={editSaving}
                  style={{ flex: 1, background: "linear-gradient(135deg, #D4AF37, #B8860B)", color: "#080808", border: "none", padding: "10px", cursor: "pointer", borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}>
                  {editSaving ? "..." : "Sauvegarder"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: "20px" }}>
                <div>
                  <p style={labelStyle}>Service</p>
                  <p style={{ color: "#F0F0F0", fontSize: "15px" }}>{selected.service}</p>
                </div>
                <div>
                  <p style={labelStyle}>Prix</p>
                  <p style={{ color: "#D4AF37", fontSize: "15px", fontWeight: 500 }}>{selected.price}$</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "20px" }}>
                <div>
                  <p style={labelStyle}>Barbiere</p>
                  <p style={{ color: barberColor(selected.barber), fontSize: "15px" }}>{selected.barber}</p>
                </div>
                <div>
                  <p style={labelStyle}>Date & heure</p>
                  <p style={{ color: "#F0F0F0", fontSize: "15px" }}>
                    {new Date(selected.date + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} a {selected.time}
                  </p>
                </div>
              </div>
              {selected.note && (
                <div>
                  <p style={labelStyle}>Note</p>
                  <p style={{ color: "#999", fontSize: "13px", fontStyle: "italic" }}>{selected.note}</p>
                </div>
              )}

              {/* Status */}
              <div style={{
                background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ color: "#555", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>Statut</span>
                <span style={{
                  color: STATUS_COLORS[selected.status] || "#999", fontSize: "11px",
                  letterSpacing: "1px", textTransform: "uppercase", fontWeight: 500,
                }}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>

              {/* Edit button */}
              {selected.status !== "cancelled" && (
                <button
                  onClick={() => {
                    setEditForm({
                      service: selected.service, price: selected.price, barber: selected.barber,
                      date: selected.date, time: selected.time, end_time: (selected as Booking & { end_time?: string }).end_time || "", note: selected.note || "",
                      client_name: selected.client_name, client_phone: selected.client_phone || "", client_email: selected.client_email || "",
                    });
                    setEditing(true);
                  }}
                  style={{
                    background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.25)",
                    color: "#D4AF37", padding: "10px 16px", fontSize: "12px",
                    cursor: "pointer", borderRadius: "8px", letterSpacing: "0.5px", fontWeight: 500,
                  }}
                >
                  Modifier le RDV
                </button>
              )}

              {/* Actions */}
              {selected.status === "confirmed" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <button
                    onClick={async () => {
                      if (!confirm("Marquer comme complete ? Un courriel de demande d'avis sera envoye au client.")) return;
                      await fetch("/api/bookings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: selected.id, status: "completed", loyalty_counted: true }),
                      });
                      setBookings(prev => prev.map(b => b.id === selected.id ? { ...b, status: "completed" } : b));
                      setSelected(prev => prev ? { ...prev, status: "completed" } : null);
                      const booking = bookings.find(b => b.id === selected.id);
                      if (booking?.client_email) {
                        fetch("/api/review-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: booking.client_name, client_email: booking.client_email, barber: booking.barber, service: booking.service }) });
                      }
                    }}
                    style={{
                      background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,134,11,0.1))",
                      border: "1px solid rgba(212,175,55,0.4)", color: "#D4AF37",
                      padding: "10px 16px", fontSize: "12px", cursor: "pointer",
                      borderRadius: "8px", letterSpacing: "0.5px", fontWeight: 600,
                    }}
                  >
                    Client satisfait (+1 fidelite)
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm("Marquer comme complete ? Un courriel de demande d'avis sera envoye au client.")) return;
                      updateStatus(selected.id, "completed");
                    }}
                    style={{
                      background: "rgba(85,170,85,0.08)", border: "1px solid rgba(85,170,85,0.2)",
                      color: "#5a5", padding: "10px 16px", fontSize: "12px",
                      cursor: "pointer", borderRadius: "8px", letterSpacing: "0.5px",
                    }}
                  >
                    &#10003; Complete (sans fidelite)
                  </button>
                  <button
                    onClick={() => updateStatus(selected.id, "cancelled")}
                    style={{
                      background: "rgba(238,85,85,0.08)", border: "1px solid rgba(238,85,85,0.2)",
                      color: "#e55", padding: "10px 16px", fontSize: "12px",
                      cursor: "pointer", borderRadius: "8px", letterSpacing: "0.5px",
                    }}
                  >
                    &#10005; Annuler
                  </button>
                  <button
                    onClick={() => markNoShow(selected.id)}
                    style={{
                      background: "rgba(255,153,0,0.12)", border: "1px solid rgba(255,153,0,0.4)",
                      color: "#f90", padding: "10px 16px", fontSize: "12px",
                      cursor: "pointer", borderRadius: "8px", letterSpacing: "0.5px", fontWeight: 600,
                    }}
                  >
                    &#8709; No-show (client absent)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  }
}
