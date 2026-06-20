"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { isPushSupported, subscribeAndSave } from "@/lib/push-notifications";
import { supabase } from "@/lib/supabase";

// Type d'un service tel qu'utilisé partout dans le booking (price/duration en string pour l'affichage)
type Service = { id: string; name: string; price: string; duration: string; desc: string; icon: string };

// FALLBACK (= données actuelles) : utilisé si /api/services échoue, pour que la page marche TOUJOURS.
const FALLBACK_SERVICES: Service[] = [
  { id: "wash-cut", name: "Coupe + Lavage", price: "35$", duration: "45 min", desc: "Coupe classique avec shampoing", icon: "✂️" },
  { id: "wash-cut-shave", name: "Coupe + Barbe à la lame", price: "50$", duration: "60 min", desc: "Coupe, rasage lame & serviette chaude", icon: "🪒" },
  { id: "cut-beard-shaver", name: "Coupe + Barbe Shaver", price: "45$", duration: "45 min", desc: "Coupe, barbe & rasage à la tondeuse (shaver)", icon: "🧔" },
  { id: "premium", name: "Service Premium", price: "75$", duration: "75 min", desc: "Coupe, rasage, serviette chaude & exfoliant", icon: "👑" },
  { id: "shave", name: "Rasage / Barbe", price: "25$", duration: "30 min", desc: "Rasage lame, barbe & tondeuse", icon: "🧔" },
  { id: "child", name: "Enfant (12 ans et moins)", price: "30$", duration: "30 min", desc: "Coupe pour enfant de 12 ans et moins (preuve d'âge)", icon: "👦" },
];

// Slug stable à partir du nom (sans accents) — sert d'id quand l'API ne renvoie pas d'id local connu
function slugify(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mappe une ligne de l'API ({name, price (nombre), duration_min (nombre), description, icon})
// vers la forme attendue par le code (price "35$", duration "45 min", desc, id slug).
function mapApiService(row: { name: string; price: number; duration_min: number; description?: string; icon?: string }): Service {
  return {
    id: slugify(row.name),
    name: row.name,
    price: `${row.price}$`,
    duration: `${row.duration_min} min`,
    desc: row.description || "",
    icon: row.icon || "✂️",
  };
}

// Normalise un nom de barbier : minuscules + sans accents (règle "stephanie" vs "stéphanie")
const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Image par barbier : Melynda a sa photo, les autres le fauteuil générique
function barberImage(name: string): string {
  const n = norm(name);
  if (n.includes("melynda")) return "/images/melynda.jpg";
  if (n.includes("stephanie")) return "/images/stephanie.jpg";
  return "/images/chair-barbier.jpg"; // Barbier dispo / autres
}

// Horaires selon le jour : 0=dim, 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven, 6=sam
const CLOSED_DAYS = [0, 1]; // Dimanche et Lundi fermés

// Melynda
const TIMES_SHORT = ["8:30","8:45","9:00","9:15","9:30","9:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45","13:00","13:15","13:30","13:45","14:00","14:15","14:30","14:45","15:00","15:15","15:30","15:45","16:00","16:15"]; // mar/mer/sam
const TIMES_LONG  = ["8:30","8:45","9:00","9:15","9:30","9:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45","13:00","13:15","13:30","13:45","14:00","14:15","14:30","14:45","15:00","15:15","15:30","15:45","16:00","16:15","16:30","16:45","17:00","17:15","17:30","17:45","18:00","18:15","18:30","18:45","19:00","19:15","19:30","19:45","20:00","20:15"]; // jeu/ven


// Tolérance : on accepte qu'un RDV finisse jusqu'à 15 min après la fermeture (Luca: "s'il reste que ça, ok").
const CLOSING_GRACE = 15;

// Génère les créneaux d'un barbier.
//  - `step` = granularité des heures de départ (15 min → flexibilité, on ne perd aucun départ)
//  - `fitMinutes` = durée réelle du RDV : le RDV doit finir au plus 15 min après la fermeture
function generateTimesFromRange(open: string, close: string, step = 15, fitMinutes = step): string[] {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const times: string[] = [];
  let cur = oh * 60 + om;
  const end = ch * 60 + cm - fitMinutes + CLOSING_GRACE; // RDV fini ≤ 15 min après la fermeture
  const inc = step > 0 ? step : 15;
  while (cur <= end) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    times.push(`${h}:${String(m).padStart(2, "0")}`);
    cur += inc;
  }
  return times;
}

// Nombre RÉEL de rendez-vous (de durée `durationMin`) qui rentrent dans une liste de
// créneaux libres aux 15 min — en empilant sans chevauchement. Donne la vraie capacité.
function realCapacity(freeSlots: string[], durationMin: number): number {
  let count = 0;
  let lastEnd = -1;
  for (const t of freeSlots) {
    const [h, m] = t.split(":").map(Number);
    const start = h * 60 + m;
    if (start >= lastEnd) { count++; lastEnd = start + durationMin; }
  }
  return count;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
type DaySchedule = Record<string, { open: string; close: string } | null>;

// Toutes les infos de dispo d'UN barbier (chaque barbier est indépendant)
type BarberData = {
  name: string;
  schedule: DaySchedule;
  color: string;
  role: string;
  blockedDates: string[];
  blockedRanges: { date: string; start_time: string; end_time: string }[];
  overrides: { date: string; open: string; close: string }[];
};

function getTimesForBarberAndDate(
  barberId: string,
  dateStr: string,
  overrides?: { date: string; open: string; close: string }[],
  schedule?: DaySchedule,
  step = 15,
  fitMinutes = step
): string[] {
  if (!dateStr) return [];
  const ov = overrides?.find(o => o.date === dateStr);
  if (ov) return generateTimesFromRange(ov.open, ov.close, step, fitMinutes);
  if (schedule) {
    const day = new Date(dateStr + "T12:00:00").getDay();
    const daySchedule = schedule[DAY_KEYS[day]];
    if (!daySchedule) return [];
    return generateTimesFromRange(daySchedule.open, daySchedule.close, step, fitMinutes);
  }
  // Fallback hardcoded (Melynda schedule)
  const day = new Date(dateStr + "T12:00:00").getDay();
  if (day === 4 || day === 5) return TIMES_LONG;
  return TIMES_SHORT;
}

function isDateAvailableForBarber(
  barberId: string,
  dateStr: string,
  blockedDates: string[],
  overrideDates: string[],
  schedule?: DaySchedule
): boolean {
  if (blockedDates.includes(dateStr)) return false;
  // Override: explicitly unlocked day
  if (overrideDates.includes(dateStr)) return true;
  if (schedule) {
    const day = new Date(dateStr + "T12:00:00").getDay();
    return !!schedule[DAY_KEYS[day]];
  }
  // Fallback hardcoded
  const day = new Date(dateStr + "T12:00:00").getDay();
  if (CLOSED_DAYS.includes(day)) return false;
  return true;
}

// Durée estimée d'un RDV existant à partir de son nom de service (utilisé pour les RDV déjà en DB).
// Pour un NOUVEAU RDV, on prend plutôt la durée exacte du champ `duration` de SERVICES.
function getServiceDuration(service: string): number {
  const s = service.toLowerCase();
  if (s.includes("premium") || s.includes("forfait")) return 75;
  if (s.includes("shaver") && s.includes("coupe")) return 45; // Coupe + Barbe Shaver = 45 min
  if ((s.includes("barbe") || s.includes("rasage") || s.includes("lame")) && s.includes("coupe")) return 60;
  if (s.includes("enfant")) return 30; // enfant = 30 min (vérifié avant étudiant)
  if (s.includes("coupe") || s.includes("lavage") || s.includes("étudiant") || s.includes("etudiant") || s.includes("student")) return 45;
  return 30;
}

// Durée EXACTE du service sélectionné (depuis sa fiche) — le bon chiffre pour le bon service.
function selectedServiceDuration(serviceId: string, services: Service[]): number {
  const svc = services.find(s => s.id === serviceId);
  return svc ? (parseInt(svc.duration) || 30) : 30;
}

function isSlotOccupied(
  slot: string,
  bookedSlots: { time: string; service: string; end_time?: string }[],
  blockedRanges?: { date: string; start_time: string; end_time: string }[],
  date?: string,
  newDuration?: number
): boolean {
  const [sh, sm] = slot.split(":").map(Number);
  const slotMin = sh * 60 + sm;
  const dur = newDuration ?? 30;
  for (const b of bookedSlots) {
    const [bh, bm] = (b.time || "0:0").split(":").map(Number);
    const bookingStart = bh * 60 + bm;
    const bookingEnd = b.end_time
      ? (() => { const [eh, em] = b.end_time!.split(":").map(Number); return eh * 60 + em; })()
      : bookingStart + getServiceDuration(b.service);
    if (slotMin < bookingEnd && slotMin + dur > bookingStart) return true;
  }
  if (blockedRanges && date) {
    for (const r of blockedRanges) {
      if (r.date !== date) continue;
      const [rh, rm] = r.start_time.split(":").map(Number);
      const [eh, em] = r.end_time.split(":").map(Number);
      const blockStart = rh * 60 + rm;
      const blockEnd = eh * 60 + em;
      if (slotMin < blockEnd && slotMin + dur > blockStart) return true;
    }
  }
  return false;
}

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

function CalendarPicker({ today, selected, onSelect, barberId, blockedDates, overrideDates, barberSchedule, isAvailableFn }: { today: string; selected: string; onSelect: (d: string) => void; barberId: string; blockedDates: string[]; overrideDates: string[]; barberSchedule?: DaySchedule; isAvailableFn?: (d: string) => boolean }) {
  const todayDate = new Date(today + "T12:00:00");
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function toStr(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div style={{
      background: "#0D0D0D",
      border: "1px solid rgba(212,175,55,0.15)",
      borderRadius: "20px",
      padding: "36px 40px",
      maxWidth: "600px",
      margin: "0 auto",
    }}>
      {/* Header mois */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <button
          onClick={prevMonth}
          aria-label="Mois précédent"
          className="cal-nav"
          style={{
            background: "rgba(212,175,55,0.08)",
            border: "1px solid rgba(212,175,55,0.2)",
            color: "#D4AF37",
            fontSize: "22px",
            cursor: "pointer",
            padding: "10px 18px",
            borderRadius: "10px",
            transition: "all 0.25s ease",
          }}
        >
          ‹
        </button>
        <span style={{
          color: "#F0F0F0",
          fontSize: "20px",
          letterSpacing: "4px",
          textTransform: "uppercase",
          fontWeight: 400,
        }}>
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Mois suivant"
          className="cal-nav"
          style={{
            background: "rgba(212,175,55,0.08)",
            border: "1px solid rgba(212,175,55,0.2)",
            color: "#D4AF37",
            fontSize: "22px",
            cursor: "pointer",
            padding: "10px 18px",
            borderRadius: "10px",
            transition: "all 0.25s ease",
          }}
        >
          ›
        </button>
      </div>

      {/* Jours de la semaine */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "12px" }}>
        {DAYS_FR.map(d => (
          <div key={d} style={{
            textAlign: "center",
            color: "#888",
            fontSize: "13px",
            letterSpacing: "2px",
            padding: "10px 0",
            fontWeight: 500,
            textTransform: "uppercase",
          }}>{d}</div>
        ))}
      </div>

      {/* Hover styles */}
      <style>{`
        .cal-day:not(:disabled):hover {
          background: rgba(212,175,55,0.12) !important;
          border-color: rgba(212,175,55,0.5) !important;
          color: #D4AF37 !important;
          box-shadow: 0 0 20px rgba(212,175,55,0.2), 0 0 40px rgba(212,175,55,0.08) !important;
          transform: scale(1.08);
        }
        .cal-day.cal-selected {
          animation: calPulse 2s ease-in-out infinite;
        }
        @keyframes calPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(212,175,55,0.25), inset 0 0 10px rgba(212,175,55,0.1); }
          50% { box-shadow: 0 0 30px rgba(212,175,55,0.4), inset 0 0 15px rgba(212,175,55,0.15); }
        }
        .time-btn:not(:disabled):hover {
          background: rgba(212,175,55,0.15) !important;
          border-color: #D4AF37 !important;
          color: #D4AF37 !important;
          box-shadow: 0 0 20px rgba(212,175,55,0.25), 0 0 40px rgba(212,175,55,0.1) !important;
          transform: scale(1.05);
        }
        .time-btn.time-selected {
          animation: timePulse 2s ease-in-out infinite;
        }
        @keyframes timePulse {
          0%, 100% { box-shadow: 0 0 20px rgba(212,175,55,0.3), inset 0 0 10px rgba(212,175,55,0.1); }
          50% { box-shadow: 0 0 35px rgba(212,175,55,0.5), inset 0 0 15px rgba(212,175,55,0.2); }
        }
        .cal-nav:hover {
          background: rgba(212,175,55,0.2) !important;
          box-shadow: 0 0 15px rgba(212,175,55,0.3) !important;
          transform: scale(1.1);
        }
      `}</style>

      {/* Jours */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = toStr(viewYear, viewMonth, day);
          const isPast = dateStr < today;
          const isAvailable = isAvailableFn ? isAvailableFn(dateStr) : isDateAvailableForBarber(barberId, dateStr, blockedDates, overrideDates, barberSchedule);
          const isClosed = !isAvailable;
          const isSelected = dateStr === selected;
          const isToday = dateStr === today;
          const disabled = isPast || isClosed;

          return (
            <button
              key={dateStr}
              onClick={() => !disabled && onSelect(dateStr)}
              disabled={disabled}
              className={`cal-day${isSelected ? " cal-selected" : ""}`}
              aria-label={`${day} ${MONTHS_FR[viewMonth]} ${viewYear}${isClosed ? (blockedDates.includes(dateStr) ? " — bloqué" : " — non disponible") : ""}`}
              aria-pressed={isSelected}
              style={{
                padding: "16px 0",
                fontSize: "18px",
                textAlign: "center",
                border: isSelected
                  ? "2px solid #D4AF37"
                  : isToday
                    ? "1px solid rgba(212,175,55,0.3)"
                    : "1px solid rgba(255,255,255,0.04)",
                background: isSelected
                  ? "rgba(184,134,11,0.25)"
                  : disabled
                    ? "transparent"
                    : "rgba(255,255,255,0.02)",
                color: disabled
                  ? "#2A2A2A"
                  : isSelected
                    ? "#E8C84A"
                    : isClosed
                      ? "#333"
                      : "#E5E5E5",
                cursor: disabled ? "default" : "pointer",
                fontWeight: isSelected ? 700 : 400,
                borderRadius: "12px",
                transition: "all 0.25s ease",
                boxShadow: isSelected ? "0 0 24px rgba(212,175,55,0.25), inset 0 0 12px rgba(212,175,55,0.1)" : "none",
                minHeight: "52px",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selected && (isAvailableFn ? isAvailableFn(selected) : isDateAvailableForBarber(barberId, selected, blockedDates, overrideDates, barberSchedule)) && (
        <p style={{
          color: "#D4AF37",
          fontSize: "15px",
          marginTop: "24px",
          textAlign: "center",
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}>
          {new Date(selected + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}
    </div>
  );
}

const stepLabels = ["Service", "Date & Heure", "Coordonnées"];

function StepIndicator({ step }: { step: number }) {
  return (
    <nav aria-label="Étapes de réservation">
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0", marginBottom: "56px", padding: "0 20px" }}>
        {stepLabels.map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <motion.div
                aria-current={step === i + 1 ? "step" : undefined}
                animate={{
                  scale: step === i + 1 ? 1.1 : 1,
                  boxShadow: step === i + 1
                    ? "0 0 25px rgba(212,175,55,0.5), 0 0 50px rgba(212,175,55,0.2)"
                    : step > i + 1
                      ? "0 0 15px rgba(212,175,55,0.3)"
                      : "none",
                }}
                transition={{ duration: 0.4 }}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: step > i + 1
                    ? "linear-gradient(135deg, #D4AF37, #B8860B)"
                    : step === i + 1
                      ? "linear-gradient(135deg, #D4AF37, #B8860B)"
                      : "transparent",
                  border: step >= i + 1
                    ? "2px solid #D4AF37"
                    : "2px solid #333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  color: step >= i + 1 ? "#080808" : "#555",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {step > i + 1 ? "✓" : i + 1}
              </motion.div>
              <span style={{
                fontSize: "10px",
                color: step >= i + 1 ? "#D4AF37" : "#444",
                letterSpacing: "1px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }} className="hidden-mobile">
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{
                width: "40px",
                height: "2px",
                background: step > i + 1
                  ? "linear-gradient(90deg, #D4AF37, #B8860B)"
                  : "rgba(255,255,255,0.08)",
                margin: "0 8px",
                marginBottom: "24px",
                borderRadius: "1px",
                transition: "all 0.4s",
              }} className="hidden-mobile" />
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

function BookingContent() {
  const params = useSearchParams();
  const preBarber = params.get("barber") || "";
  const preServiceName = params.get("service") || "";
  // Résolution initiale sur le FALLBACK (synchronisé avec les noms DB) → le deep-link marche tout de suite,
  // même avant que /api/services réponde.
  const preService = FALLBACK_SERVICES.find(s => s.name === preServiceName);
  const initialStep = preService ? 2 : 1;
  const [step, setStep] = useState(initialStep);
  const [selected, setSelected] = useState({
    service: preService?.id || "",
    barber: preBarber,
    date: "",
    time: "",
    name: "",
    phone: "",
    email: "",
    note: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<{ time: string; service: string; end_time?: string; barber?: string }[]>([]);
  const [barbersData, setBarbersData] = useState<BarberData[]>([]);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [waitlistModal, setWaitlistModal] = useState<{time: string} | null>(null);
  const [waitlistForm, setWaitlistForm] = useState({ name: "", phone: "", email: "" });
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [pushPrompt, setPushPrompt] = useState<"idle" | "asking" | "subscribed" | "declined">("idle");
  const [loyalty, setLoyalty] = useState<{ visits: number; progress: number; nextFree: boolean; isFree: boolean } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const retryCountRef = useRef(0);
  // Liste des services : démarre sur le FALLBACK, puis remplacée par /api/services si dispo.
  const [services, setServices] = useState<Service[]>(FALLBACK_SERVICES);

  // Capture source on page load so it's not lost during navigation
  const [detectedSource] = useState(() => {
    if (typeof window === "undefined") return "direct";
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    if (utm) return utm;
    const ref = document.referrer.toLowerCase();
    if (ref.includes("google")) return "google";
    if (ref.includes("facebook") || ref.includes("fb.com")) return "facebook";
    if (ref.includes("instagram")) return "instagram";
    if (ref.includes("messenger")) return "messenger";
    if (window.location.search.includes("fbclid")) return "facebook";
    if (window.location.search.includes("gclid")) return "google";
    return "direct";
  });

  const service = services.find((s) => s.id === selected.service);

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;

  // Charge les services depuis l'API (gérés par Melynda). Filet de sécurité : en cas d'échec,
  // on garde FALLBACK_SERVICES (état initial) pour que le booking marche TOUJOURS.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/services")
      .then(r => { if (!r.ok) throw new Error("services"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const rows: { name: string; price: number; duration_min: number; description?: string; icon?: string }[] =
          Array.isArray(data) ? data : (Array.isArray(data?.services) ? data.services : []);
        const mapped = rows.filter(r => r && r.name).map(mapApiService);
        if (mapped.length === 0) return; // garde le fallback si réponse vide
        setServices(mapped);
        // Re-mappe le service présélectionné (deep-link) sur l'id réel de l'API, via son nom.
        setSelected(prev => {
          if (!preServiceName) return prev;
          const match = mapped.find(s => s.name === preServiceName);
          return match && match.id !== prev.service ? { ...prev, service: match.id } : prev;
        });
      })
      .catch(() => { /* garde FALLBACK_SERVICES */ });
    return () => { cancelled = true; };
  }, [preServiceName]);

  const refreshAvailability = useCallback(() => {
    // Un seul appel pour tout charger en parallèle côté serveur
    fetch("/api/booking/init")
      .then(r => r.json())
      .then((data: {
        barbers: {
          name: string; schedule: DaySchedule; color?: string; role?: string;
          blocks?: { date: string; start_time: string | null; end_time: string | null }[];
          overrides?: { date: string; open: string; close: string }[];
        }[];
      }) => {
        if (Array.isArray(data.barbers)) {
          const parsed: BarberData[] = data.barbers.map(b => {
            const blocks = b.blocks ?? [];
            return {
              name: b.name,
              schedule: b.schedule ?? {},
              color: b.color || "#D4AF37",
              role: b.role || "",
              blockedDates: blocks.filter(x => !x.start_time).map(x => x.date),
              blockedRanges: blocks.filter(x => x.start_time && x.end_time)
                .map(x => ({ date: x.date, start_time: x.start_time!, end_time: x.end_time! })),
              overrides: b.overrides ?? [],
            };
          });
          setBarbersData(parsed);
        }
        setAvailabilityReady(true);
      })
      .catch(() => {});
  }, []);

  // Load on mount + Supabase Realtime (block instantané quand Melynda en crée un)
  useEffect(() => {
    refreshAvailability();
    const channel = supabase
      .channel("booking-client-blocks")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "barber_blocks" },
        () => refreshAvailability()
      )
      .subscribe();
    const interval = setInterval(refreshAvailability, 300000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [refreshAvailability]);

  const refreshBookedSlots = useCallback((date: string) => {
    setSlotsLoading(true);
    setSlotsError(false);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    // Fetch l'occupation de la date (sans PII) via /api/availability — on séparera côté client
    fetch(`/api/availability?date=${date}&_=${Date.now()}`, { signal: ctrl.signal, cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((allData) => {
      clearTimeout(timeout);
      if (Array.isArray(allData)) {
        // bookedSlots = global (compat existant) mais on garde aussi par barbier
        const allActive = allData.filter((b: { status: string }) => b.status !== "cancelled");
        setBookedSlots(allActive.map((b: { time: string; service: string; end_time?: string; barber: string }) => ({ time: b.time, service: b.service || "", end_time: b.end_time, barber: b.barber })));
      }
      setSlotsLoading(false);
      setSlotsError(false);
      retryCountRef.current = 0;
    }).catch(() => {
      clearTimeout(timeout);
      setSlotsLoading(false);
      setSlotsError(true);
      // Auto-retry up to 3 times with increasing delay
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        const delay = retryCountRef.current * 3000;
        // eslint-disable-next-line react-hooks/immutability
        setTimeout(() => refreshBookedSlots(date), delay);
      }
    });
  }, []);

  // Push live: si un autre client réserve sur la même date, les créneaux se mettent à jour instantanément
  useEffect(() => {
    if (!selected.date) return;
    refreshBookedSlots(selected.date);
    const channel = supabase
      .channel(`booking-slots-${selected.date}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `date=eq.${selected.date}` },
        () => refreshBookedSlots(selected.date)
      )
      .subscribe();
    const interval = setInterval(() => refreshBookedSlots(selected.date), 300000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selected.date, refreshBookedSlots]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setBookingError(null);
    const service = services.find((s) => s.id === selected.service);
    const price = service ? parseInt(service.price) : 0;
    try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: selected.name,
        client_phone: selected.phone,
        client_email: selected.email,
        barber: selected.barber,
        service: service?.name || "",
        price,
        date: selected.date,
        time: selected.time,
        note: selected.note,
        status: "confirmed",
        source: detectedSource,
      }),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) {
      refreshBookedSlots(selected.date);
      setSelected(s => ({ ...s, time: "" }));
      setBookingError(res.status === 409
        ? "Ce créneau vient d'être pris par quelqu'un d'autre. Choisis un autre horaire."
        : (resData?.error || "Une erreur est survenue. Réessaie."));
      return;
    }
    if (resData?.id) setBookingId(resData.id);
    setSubmitted(true);

    // Tracking conversion Google Ads (via GA4) + Meta Pixel — fire-and-forget
    try {
      const w = window as unknown as { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void };
      if (typeof w.gtag === "function") {
        w.gtag("event", "purchase", {
          transaction_id: resData?.id,
          value: price,
          currency: "CAD",
          items: [{
            item_id: service?.id,
            item_name: service?.name || "Service",
            item_category: "barbershop",
            price,
            quantity: 1,
          }],
        });
      }
      if (typeof w.fbq === "function") {
        w.fbq("track", "Schedule", { value: price, currency: "CAD", content_name: service?.name });
        w.fbq("track", "Purchase", { value: price, currency: "CAD", content_name: service?.name });
      }
    } catch {}

    // Fetch loyalty data after booking
    if (selected.email) {
      fetch(`/api/loyalty?email=${encodeURIComponent(selected.email)}`)
        .then(r => r.json())
        .then(data => { if (data && typeof data.visits === "number") setLoyalty(data); })
        .catch(() => {});
    }
    } catch {
      setBookingError("Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <style>{`
          @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
          @keyframes checkPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        `}</style>
        <Navbar />
        <main style={{ minHeight: "100vh", background: "#080808", paddingTop: "120px", paddingBottom: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{ textAlign: "center", padding: "0 20px" }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 28px",
                fontSize: "36px",
                color: "#080808",
                boxShadow: "0 0 40px rgba(212,175,55,0.4)",
              }}
            >
              ✓
            </motion.div>
            <p style={{ color: "#D4AF37", letterSpacing: "4px", fontSize: "12px", textTransform: "uppercase", marginBottom: "16px" }}>Réservation confirmée</p>
            <h1 style={{
              fontSize: "36px",
              fontWeight: 300,
              letterSpacing: "4px",
              marginBottom: "32px",
              background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 3s linear infinite",
            }}>Merci, {selected.name} !</h1>
            <div style={{
              background: "#0D0D0D",
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: "16px",
              padding: "36px",
              maxWidth: "420px",
              margin: "0 auto 40px",
              textAlign: "left",
            }}>
              <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "20px" }}>Votre rendez-vous</p>
              <p style={{ color: "#F0F0F0", marginBottom: "10px", fontSize: "16px" }}>{service?.name} — <span style={{ color: "#E8C84A" }}>{service?.price}</span></p>
              <p style={{ color: "#999", fontSize: "14px", marginBottom: "10px" }}>avec {selected.barber}</p>
              <p style={{ color: "#999", fontSize: "14px", marginBottom: "10px" }}>{selected.date} à {selected.time}</p>
              <div style={{ height: "1px", background: "rgba(212,175,55,0.15)", margin: "16px 0" }} />
              <p style={{ color: "#666", fontSize: "13px" }}>375 Boul. des Chutes, Québec</p>
            </div>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "24px" }}>Un rappel vous sera envoyé 24h avant votre rendez-vous.</p>

            {/* Bouton ajouter à l'agenda */}
            {bookingId && (
              <motion.a
                href={`/api/calendar/booking/${bookingId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "rgba(212,175,55,0.1)",
                  border: "1px solid rgba(212,175,55,0.4)",
                  color: "#D4AF37",
                  borderRadius: "12px",
                  padding: "14px 28px",
                  fontSize: "14px",
                  letterSpacing: "1px",
                  textDecoration: "none",
                  marginBottom: "32px",
                  cursor: "pointer",
                }}
              >
                📆 Ajouter à mon agenda
              </motion.a>
            )}

            {/* Loyalty program */}
            {loyalty && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{
                  background: "#0D0D0D",
                  border: "1px solid rgba(212,175,55,0.2)",
                  borderRadius: "16px",
                  padding: "28px 32px",
                  maxWidth: "420px",
                  margin: "0 auto 32px",
                  textAlign: "left",
                }}
              >
                <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>
                  Programme Fidélité
                </p>
                <p style={{ color: "#F0F0F0", fontSize: "18px", fontWeight: 400, letterSpacing: "1px", marginBottom: "16px" }}>
                  Visite #{loyalty.visits}
                </p>
                {/* Progress bar */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "#999", fontSize: "12px" }}>{loyalty.progress}/10</span>
                    <span style={{ color: "#999", fontSize: "12px" }}>10e coupe gratuite</span>
                  </div>
                  <div style={{
                    width: "100%",
                    height: "8px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(loyalty.progress / 10) * 100}%` }}
                      transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                      style={{
                        height: "100%",
                        background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                </div>
                {loyalty.isFree ? (
                  <p style={{
                    color: "#D4AF37",
                    fontSize: "15px",
                    fontWeight: 500,
                    textAlign: "center",
                    padding: "12px",
                    background: "rgba(212,175,55,0.08)",
                    borderRadius: "8px",
                    border: "1px solid rgba(212,175,55,0.2)",
                  }}>
                    Cette visite est GRATUITE ! Merci pour votre fidélité !
                  </p>
                ) : (
                  <p style={{ color: "#999", fontSize: "13px" }}>
                    Plus que {10 - loyalty.progress} visite{10 - loyalty.progress > 1 ? "s" : ""} avant votre coupe gratuite !
                  </p>
                )}
              </motion.div>
            )}

            {/* Push notification opt-in prompt */}
            {isPushSupported() && pushPrompt === "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{
                  background: "#0D0D0D",
                  border: "1px solid rgba(212,175,55,0.2)",
                  borderRadius: "12px",
                  padding: "24px",
                  maxWidth: "420px",
                  margin: "0 auto 32px",
                }}
              >
                <p style={{ color: "#F0F0F0", fontSize: "14px", marginBottom: "16px" }}>
                  Activer les notifications pour recevoir vos rappels de rendez-vous ?
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button
                    onClick={async () => {
                      setPushPrompt("asking");
                      const ok = await subscribeAndSave(selected.email || undefined);
                      setPushPrompt(ok ? "subscribed" : "declined");
                    }}
                    style={{
                      background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                      color: "#080808",
                      border: "none",
                      padding: "10px 24px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Activer
                  </button>
                  <button
                    onClick={() => setPushPrompt("declined")}
                    style={{
                      background: "transparent",
                      color: "#666",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "10px 24px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Non merci
                  </button>
                </div>
              </motion.div>
            )}
            {pushPrompt === "asking" && (
              <p style={{ color: "#D4AF37", fontSize: "13px", marginBottom: "32px" }}>Activation en cours...</p>
            )}
            {pushPrompt === "subscribed" && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ color: "#D4AF37", fontSize: "13px", marginBottom: "32px" }}
              >
                Notifications activées !
              </motion.p>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/" style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                color: "#080808",
                fontSize: "12px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "14px 36px",
                borderRadius: "4px",
                textDecoration: "none",
                transition: "all 0.4s",
              }}>Retour à l'accueil</Link>
            </div>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes shimmerBtn {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .booking-service-card {
          background: #0D0D0D;
          border: 1px solid rgba(212,175,55,0.12);
          border-radius: 14px;
          padding: 24px 28px;
          cursor: pointer;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          width: 100%;
        }
        .booking-service-card:hover {
          border-color: rgba(212,175,55,0.5);
          box-shadow: 0 10px 40px rgba(212,175,55,0.12);
          transform: translateY(-4px);
        }
        .booking-barber-card {
          background: #0D0D0D;
          border: 1px solid rgba(212,175,55,0.12);
          border-radius: 16px;
          padding: 40px 36px;
          cursor: pointer;
          text-align: center;
          flex: 1;
          min-width: 200px;
          max-width: 280px;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .booking-barber-card:hover {
          border-color: rgba(212,175,55,0.6);
          box-shadow: 0 20px 60px rgba(212,175,55,0.2), 0 0 0 1px rgba(212,175,55,0.1);
          transform: translateY(-8px) scale(1.02);
        }
        .time-slot {
          border-radius: 8px;
          transition: all 0.25s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .time-slot:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .booking-input {
          background: #0D0D0D;
          border: 1px solid rgba(255,255,255,0.1);
          color: #F0F0F0;
          padding: 16px 18px;
          font-size: 15px;
          width: 100%;
          outline: none;
          border-radius: 10px;
          transition: all 0.3s;
        }
        .booking-input:focus {
          border-color: rgba(212,175,55,0.6);
          box-shadow: 0 0 20px rgba(212,175,55,0.15), 0 0 0 1px rgba(212,175,55,0.2);
        }
        .booking-input::placeholder { color: #444; }
        .cta-btn-gold {
          display: inline-block;
          background: linear-gradient(135deg, #D4AF37, #B8860B, #D4AF37);
          background-size: 200% auto;
          color: #080808;
          font-size: 12px;
          letter-spacing: 3px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 14px 36px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .cta-btn-gold:hover {
          animation: shimmerBtn 2s linear infinite;
          box-shadow: 0 10px 40px rgba(212,175,55,0.3);
          transform: translateY(-2px);
        }
        .cta-btn-gold:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .cta-btn-gold:disabled:hover {
          animation: none;
          box-shadow: none;
          transform: none;
        }
      `}</style>
      <Navbar />
      <main style={{ minHeight: "100vh", background: "#080808", paddingTop: "100px", paddingBottom: "80px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", padding: "40px 20px 60px" }}>
          <p style={{ color: "#D4AF37", letterSpacing: "6px", fontSize: "11px", textTransform: "uppercase", marginBottom: "16px", fontWeight: 500 }}>Ciseau Noir</p>
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 300,
            letterSpacing: "8px",
            textTransform: "uppercase",
            background: "linear-gradient(90deg, #B8860B, #D4AF37, #E8C84A, #D4AF37, #B8860B)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s linear infinite",
          }}>Réservation</h1>
          <div style={{
            width: "80px",
            height: "2px",
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "20px auto 0",
          }} />
        </div>

        {/* Steps indicator */}
        <StepIndicator step={step} />

        <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 20px" }}>
          <AnimatePresence mode="wait">

            {/* STEP 1 - Service */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <h2 style={{
                  fontSize: "20px",
                  letterSpacing: "3px",
                  color: "#F0F0F0",
                  textTransform: "uppercase",
                  marginBottom: "32px",
                  textAlign: "center",
                  fontWeight: 400,
                }}>Choisissez votre service</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {services.map((s, index) => (
                    <motion.button
                      key={s.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      onClick={() => { setSelected({ ...selected, service: s.id }); setStep(2); }}
                      aria-pressed={selected.service === s.id}
                      className="booking-service-card"
                      style={{
                        borderColor: selected.service === s.id ? "rgba(212,175,55,0.6)" : undefined,
                        background: selected.service === s.id ? "rgba(184,134,11,0.08)" : undefined,
                        boxShadow: selected.service === s.id ? "0 0 30px rgba(212,175,55,0.15), inset 0 0 20px rgba(212,175,55,0.05)" : undefined,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "10px",
                          background: "rgba(212,175,55,0.06)",
                          border: "1px solid rgba(212,175,55,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "20px",
                          flexShrink: 0,
                        }}>
                          {s.icon}
                        </div>
                        <div>
                          <p style={{ color: "#F0F0F0", fontSize: "15px", letterSpacing: "1px", marginBottom: "4px", fontWeight: 400 }}>{s.name}</p>
                          <p style={{ color: "#666", fontSize: "13px" }}>{s.desc} · {s.duration}</p>
                        </div>
                      </div>
                      <span style={{
                        fontSize: "24px",
                        fontWeight: 300,
                        flexShrink: 0,
                        marginLeft: "16px",
                        background: "linear-gradient(135deg, #E8C84A, #D4AF37)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}>{s.price}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2 - Date & Heure */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <style>{`
                  .slot-melynda:not(:disabled):hover {
                    background: rgba(212,175,55,0.15) !important;
                    border-color: #D4AF37 !important;
                    color: #D4AF37 !important;
                    transform: translateY(-2px);
                  }
                  .barbers-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                    gap: 12px;
                    max-width: 720px;
                    margin: 0 auto;
                  }
                  @media (min-width: 640px) {
                    .barbers-grid { gap: 20px; }
                  }
                `}</style>
                <h2 style={{
                  fontSize: "20px",
                  letterSpacing: "3px",
                  color: "#F0F0F0",
                  textTransform: "uppercase",
                  marginBottom: "32px",
                  textAlign: "center",
                  fontWeight: 400,
                }}>Choisissez la date et l'heure</h2>

                {/* Calendar — dispo si au moins un barbier travaille ce jour */}
                <div style={{ marginBottom: "32px" }}>
                  <label style={{
                    display: "block",
                    color: "#D4AF37",
                    fontSize: "11px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    marginBottom: "16px",
                    fontWeight: 500,
                  }}>Date</label>
                  <CalendarPicker
                    today={today}
                    selected={selected.date}
                    onSelect={(val) => setSelected({ ...selected, date: val, time: "", barber: "" })}
                    barberId=""
                    blockedDates={[]}
                    overrideDates={[]}
                    isAvailableFn={(dateStr) =>
                      barbersData.length === 0
                        ? isDateAvailableForBarber("", dateStr, [], [], undefined)
                        : barbersData.some(b =>
                            isDateAvailableForBarber(b.name, dateStr, b.blockedDates, b.overrides.map(o => o.date), b.schedule)
                          )
                    }
                  />
                </div>

                {/* 2 colonnes de créneaux */}
                {selected.date && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p style={{ color: "#D4AF37", fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", textAlign: "center", marginBottom: "24px", fontWeight: 500 }}>
                      Choisissez un créneau
                    </p>

                    {/* Loading state */}
                    {slotsLoading && (
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{
                          width: "40px", height: "40px", border: "3px solid rgba(212,175,55,0.2)",
                          borderTop: "3px solid #D4AF37", borderRadius: "50%",
                          animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
                        }} />
                        <p style={{ color: "#888", fontSize: "13px" }}>Chargement des disponibilités...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </div>
                    )}

                    {/* Error state — NEVER show slots as available if API failed */}
                    {!slotsLoading && slotsError && (
                      <div style={{
                        textAlign: "center", padding: "40px 20px",
                        background: "rgba(238,85,85,0.05)",
                        border: "1px solid rgba(238,85,85,0.2)",
                        borderRadius: "16px",
                      }}>
                        <p style={{ color: "#e55", fontSize: "16px", marginBottom: "8px", fontWeight: 500 }}>Connexion temporairement interrompue</p>
                        <p style={{ color: "#888", fontSize: "13px", marginBottom: "20px", lineHeight: 1.6 }}>
                          Impossible de vérifier les disponibilités. Réessai automatique en cours...
                        </p>
                        <button
                          onClick={() => { retryCountRef.current = 0; refreshBookedSlots(selected.date); }}
                          style={{
                            background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                            color: "#080808", border: "none", padding: "12px 28px",
                            borderRadius: "8px", cursor: "pointer", fontSize: "13px",
                            fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase",
                          }}
                        >Réessayer maintenant</button>
                        <p style={{ color: "#555", fontSize: "11px", marginTop: "16px" }}>
                          Vous pouvez aussi nous appeler : <a href="tel:+14186655703" style={{ color: "#D4AF37" }}>418-665-5703</a>
                        </p>
                      </div>
                    )}

                    {/* Slots — only show when data loaded successfully */}
                    {!slotsLoading && !slotsError && <div className="barbers-grid">

                      {/* Une colonne par barbier disponible ce jour-là (dynamique, illimité) */}
                      {barbersData
                        .filter(b => isDateAvailableForBarber(b.name, selected.date, b.blockedDates, b.overrides.map(o => o.date), b.schedule))
                        .map(b => {
                          const isMelynda = norm(b.name).includes("melynda");
                          // Durée EXACTE du service choisi → bon chiffre de places, bon ajustement des créneaux
                          const serviceDur = selectedServiceDuration(selected.service, services);
                          // Garder QUE les RDV de CE barbier (comparaison sans accent).
                          // Les RDV sans barbier sont comptés sur Melynda (barbière principale) — évite un double-booking.
                          const barberBooked = bookedSlots.filter(x => norm(x.barber || "") === norm(b.name) || (isMelynda && !x.barber));
                          // Départs aux 15 min (flexibilité), mais chaque créneau laisse le temps complet du service.
                          const slots = getTimesForBarberAndDate(b.name, selected.date, b.overrides, b.schedule, 15, serviceDur).filter(t => {
                            const now = new Date();
                            const [tH, tM] = t.split(":").map(Number);
                            if (selected.date === today && (tH < now.getHours() || (tH === now.getHours() && tM <= now.getMinutes()))) return false;
                            return !isSlotOccupied(t, barberBooked, b.blockedRanges, selected.date, serviceDur);
                          });
                          // Vraie capacité : combien de RDV de ce service rentrent encore (sans chevauchement)
                          const capacity = realCapacity(slots, serviceDur);
                          return (
                            <div key={b.name}>
                              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                                <div style={{
                                  width: "64px", height: "64px", borderRadius: "50%",
                                  border: "2px solid rgba(212,175,55,0.5)",
                                  margin: "0 auto 10px", overflow: "hidden",
                                  boxShadow: "0 0 16px rgba(212,175,55,0.2)",
                                }}>
                                  <Image src={barberImage(b.name)} alt={b.name} width={80} height={80} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 10%" }} />
                                </div>
                                <p style={{ color: "#D4AF37", fontSize: "13px", letterSpacing: "3px", textTransform: "uppercase", fontWeight: 600 }}>{b.name}</p>
                                {capacity > 0 && (
                                  <p style={{ color: "#7A8A5A", fontSize: "11px", letterSpacing: "1px", marginTop: "4px" }}>
                                    {capacity} place{capacity > 1 ? "s" : ""} dispo
                                  </p>
                                )}
                              </div>
                              {slots.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {slots.map(t => (
                                    <button
                                      key={t}
                                      onClick={() => { setSelected({ ...selected, barber: b.name, time: t }); setStep(3); }}
                                      className={isMelynda ? "slot-melynda" : undefined}
                                      style={{
                                        background: isMelynda ? "#0D0D0D" : "transparent",
                                        border: "1px solid rgba(212,175,55,0.25)",
                                        color: isMelynda ? "#D4AF37" : "#F0F0F0",
                                        padding: "12px 8px",
                                        cursor: "pointer",
                                        fontSize: "15px",
                                        fontWeight: 500,
                                        borderRadius: "10px",
                                        transition: "all 0.25s ease",
                                        letterSpacing: "1px",
                                        width: "100%",
                                      }}
                                    >{t}</button>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ color: "#444", fontSize: "12px", textAlign: "center", padding: "20px 0", lineHeight: 1.6 }}>Complet ce jour</p>
                              )}
                            </div>
                          );
                        })}

                    </div>}
                  </motion.div>
                )}

                <div style={{ textAlign: "center", marginTop: "36px" }}>
                  <button onClick={() => setStep(1)} style={{
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "13px",
                    letterSpacing: "1px",
                    padding: "10px 24px",
                    borderRadius: "6px",
                    transition: "all 0.3s",
                  }}>← Retour</button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 - Contact info */}
            {step === 3 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <h2 style={{
                  fontSize: "20px",
                  letterSpacing: "3px",
                  color: "#F0F0F0",
                  textTransform: "uppercase",
                  marginBottom: "32px",
                  textAlign: "center",
                  fontWeight: 400,
                }}>Vos coordonnées</h2>

                {/* Summary */}
                <div style={{
                  background: "#0D0D0D",
                  border: "1px solid rgba(212,175,55,0.15)",
                  borderRadius: "14px",
                  padding: "24px 28px",
                  marginBottom: "32px",
                  display: "flex",
                  gap: "32px",
                  flexWrap: "wrap",
                }}>
                  <div>
                    <p style={{ color: "#666", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" }}>Service</p>
                    <p style={{ color: "#F0F0F0", fontSize: "14px" }}>{service?.name} — <span style={{ color: "#E8C84A" }}>{service?.price}</span></p>
                  </div>
                  <div>
                    <p style={{ color: "#666", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" }}>Barbier</p>
                    <p style={{ color: "#F0F0F0", fontSize: "14px" }}>{selected.barber}</p>
                  </div>
                  <div>
                    <p style={{ color: "#666", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" }}>Date & Heure</p>
                    <p style={{ color: "#F0F0F0", fontSize: "14px" }}>{selected.date} à {selected.time}</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    { label: "Nom complet", key: "name", type: "text", placeholder: "Jean Tremblay" },
                    { label: "Téléphone", key: "phone", type: "tel", placeholder: "418-555-0000" },
                    { label: "Courriel", key: "email", type: "email", placeholder: "jean@exemple.com" },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label htmlFor={`field-${key}`} style={{
                        display: "block",
                        color: "#D4AF37",
                        fontSize: "11px",
                        letterSpacing: "3px",
                        textTransform: "uppercase",
                        marginBottom: "10px",
                        fontWeight: 500,
                      }}>{label}</label>
                      <input
                        id={`field-${key}`}
                        type={type}
                        placeholder={placeholder}
                        value={selected[key as keyof typeof selected]}
                        onChange={(e) => setSelected({ ...selected, [key]: e.target.value })}
                        className="booking-input"
                      />
                    </div>
                  ))}
                  <div>
                    <label htmlFor="field-note" style={{
                      display: "block",
                      color: "#D4AF37",
                      fontSize: "11px",
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      marginBottom: "10px",
                      fontWeight: 500,
                    }}>Note (optionnel)</label>
                    <textarea
                      id="field-note"
                      placeholder="Demande spéciale..."
                      value={selected.note}
                      onChange={(e) => setSelected({ ...selected, note: e.target.value })}
                      rows={3}
                      className="booking-input"
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </div>

                <p style={{ color: "#555", fontSize: "12px", marginTop: "20px", lineHeight: 1.6 }}>
                  Politique d'annulation : minimum 1 heure avant le rendez-vous.
                </p>

                {bookingError && (
                  <div style={{ background: "rgba(238,85,85,0.1)", border: "1px solid rgba(238,85,85,0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", color: "#e55", fontSize: "13px" }}>
                    {bookingError}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px" }}>
                  <button onClick={() => setStep(2)} style={{
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: "13px",
                    letterSpacing: "1px",
                    padding: "10px 24px",
                    borderRadius: "6px",
                    transition: "all 0.3s",
                  }}>← Retour</button>
                  <button
                    onClick={handleSubmit}
                    disabled={!selected.name || !selected.phone || submitting}
                    className="cta-btn-gold"
                  >
                    {submitting ? "Envoi en cours..." : "Confirmer le rendez-vous"}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Waitlist Modal - Glassmorphism */}
      <AnimatePresence>
        {waitlistModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              style={{
                background: "rgba(13,13,13,0.95)",
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: "20px",
                padding: "44px",
                maxWidth: "480px",
                width: "100%",
                boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 40px rgba(212,175,55,0.1)",
              }}
            >
              {!waitlistSent ? (
                <>
                  <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px", fontWeight: 500 }}>Liste d'attente</p>
                  <h3 style={{
                    color: "#F0F0F0",
                    fontSize: "22px",
                    fontWeight: 300,
                    letterSpacing: "2px",
                    marginBottom: "8px",
                  }}>
                    {waitlistModal.time} — {selected.barber}
                  </h3>
                  <p style={{ color: "#666", fontSize: "13px", marginBottom: "32px", lineHeight: 1.7 }}>
                    Inscrivez-vous et vous serez contacté automatiquement si ce créneau se libère.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
                    {[
                      { label: "Nom complet", key: "name", type: "text", placeholder: "Jean Tremblay" },
                      { label: "Téléphone", key: "phone", type: "tel", placeholder: "418-555-0000" },
                      { label: "Courriel (optionnel)", key: "email", type: "email", placeholder: "jean@exemple.com" },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key}>
                        <label style={{
                          display: "block",
                          color: "#888",
                          fontSize: "11px",
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          marginBottom: "8px",
                        }}>{label}</label>
                        <input
                          type={type}
                          placeholder={placeholder}
                          value={waitlistForm[key as keyof typeof waitlistForm]}
                          onChange={e => setWaitlistForm(f => ({ ...f, [key]: e.target.value }))}
                          className="booking-input"
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => { setWaitlistModal(null); setWaitlistForm({ name: "", phone: "", email: "" }); }}
                      style={{
                        flex: 1,
                        background: "none",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#666",
                        padding: "14px",
                        cursor: "pointer",
                        fontSize: "13px",
                        borderRadius: "8px",
                        transition: "all 0.3s",
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={async () => {
                        const barberName = selected.barber;
                        const serviceName = services.find(s => s.id === selected.service)?.name || "";
                        await fetch("/api/waitlist", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            date: selected.date,
                            time: waitlistModal.time,
                            barber: barberName,
                            service: serviceName,
                            client_name: waitlistForm.name,
                            client_phone: waitlistForm.phone,
                            client_email: waitlistForm.email,
                          }),
                        });
                        setWaitlistSent(true);
                      }}
                      disabled={!waitlistForm.name || !waitlistForm.phone}
                      className="cta-btn-gold"
                      style={{ flex: 2 }}
                    >
                      S'inscrire
                    </button>
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ textAlign: "center", padding: "20px 0" }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #D4AF37, #B8860B)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 20px",
                      fontSize: "28px",
                      color: "#080808",
                      boxShadow: "0 0 30px rgba(212,175,55,0.4)",
                    }}
                  >
                    ✓
                  </motion.div>
                  <p style={{ color: "#D4AF37", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Inscrit !</p>
                  <p style={{ color: "#999", fontSize: "14px", marginBottom: "32px" }}>Vous recevrez un SMS dès qu'un créneau se libère.</p>
                  <button
                    onClick={() => { setWaitlistModal(null); setWaitlistSent(false); setWaitlistForm({ name: "", phone: "", email: "" }); }}
                    style={{
                      background: "none",
                      border: "1px solid rgba(212,175,55,0.2)",
                      color: "#999",
                      padding: "12px 28px",
                      cursor: "pointer",
                      fontSize: "13px",
                      borderRadius: "8px",
                      transition: "all 0.3s",
                    }}
                  >
                    Fermer
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </>
  );
}

export default function BookingClient() {
  return (
    <Suspense fallback={<><Navbar /><main style={{ minHeight: "100vh", background: "#080808" }} aria-busy="true" /><Footer /></>}>
      <BookingContent />
    </Suspense>
  );
}
