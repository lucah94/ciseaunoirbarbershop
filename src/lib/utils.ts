import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Retourne la date locale (YYYY-MM-DD) sans décalage UTC. */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Heure de Montréal — fiable côté SERVEUR (Vercel tourne en UTC) ──────────────
// À utiliser dans les crons/routes au lieu de new Date().toISOString()/toTimeString()
// qui donnent l'heure UTC et décalent "aujourd'hui" le soir.
const MTL_TZ = "America/Montreal";

/** Date (YYYY-MM-DD) en heure de Montréal, peu importe le fuseau du serveur. */
export function montrealDateStr(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: MTL_TZ }); // "YYYY-MM-DD"
}

/** Heure (HH:MM) en heure de Montréal, peu importe le fuseau du serveur. */
export function montrealTimeStr(d: Date = new Date()): string {
  return d.toLocaleTimeString("fr-CA", { timeZone: MTL_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Composantes de date en heure de Montréal (weekday: 0=dimanche … 6=samedi). */
export function montrealParts(d: Date = new Date()): {
  year: number; month: number; day: number; weekday: number; dateStr: string; timeStr: string;
} {
  const dateStr = montrealDateStr(d);
  const [year, month, day] = dateStr.split("-").map(Number);
  const wd = d.toLocaleDateString("en-US", { timeZone: MTL_TZ, weekday: "short" });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year, month, day, weekday: map[wd] ?? 0, dateStr, timeStr: montrealTimeStr(d) };
}
