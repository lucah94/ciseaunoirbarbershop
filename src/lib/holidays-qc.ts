/**
 * Jours fériés du Québec — calculés dynamiquement pour toute année
 */

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  emoji: string;
}

function easterDate(year: number): Date {
  // Algorithme de Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nthMonday(year: number, month: number, n: number): Date {
  // n-ième lundi du mois (1 = premier, 2 = deuxième, etc.)
  const d = new Date(year, month - 1, 1);
  const dayOfWeek = d.getDay(); // 0=dim
  const firstMonday = dayOfWeek <= 1 ? 1 + (1 - dayOfWeek) : 1 + (8 - dayOfWeek);
  return new Date(year, month - 1, firstMonday + (n - 1) * 7);
}

function lastMondayBefore(year: number, month: number, day: number): Date {
  // Dernier lundi avant une date donnée
  const target = new Date(year, month - 1, day);
  const dow = target.getDay();
  const daysBack = dow === 1 ? 7 : dow === 0 ? 6 : dow - 1;
  return new Date(year, month - 1, day - daysBack);
}

export function getQcHolidays(year: number): Holiday[] {
  const easter = easterDate(year);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  const patriotes = lastMondayBefore(year, 5, 25); // Lundi avant le 25 mai
  const labourDay = nthMonday(year, 9, 1);          // 1er lundi septembre
  const thanksgiving = nthMonday(year, 10, 2);       // 2e lundi octobre

  return [
    { date: `${year}-01-01`, name: "Jour de l'An", emoji: "🎆" },
    { date: fmt(goodFriday),   name: "Vendredi saint", emoji: "✝️" },
    { date: fmt(easterMonday), name: "Lundi de Pâques", emoji: "🐣" },
    { date: fmt(patriotes),    name: "Journée nationale des Patriotes", emoji: "🍁" },
    { date: `${year}-06-24`,   name: "Fête nationale du Québec", emoji: "🔵⚪" },
    { date: `${year}-07-01`,   name: "Fête du Canada", emoji: "🇨🇦" },
    { date: fmt(labourDay),    name: "Fête du Travail", emoji: "👷" },
    { date: fmt(thanksgiving), name: "Action de Grâces", emoji: "🦃" },
    { date: `${year}-12-25`,   name: "Noël", emoji: "🎄" },
    { date: `${year}-12-26`,   name: "Lendemain de Noël", emoji: "🎁" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** Prochains jours fériés dans les N jours */
export function getUpcomingHolidays(days = 14): Holiday[] {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const limit = new Date(today);
  limit.setDate(today.getDate() + days);
  const limitStr = limit.toISOString().slice(0, 10);

  const thisYear = getQcHolidays(today.getFullYear());
  const nextYear = getQcHolidays(today.getFullYear() + 1);

  return [...thisYear, ...nextYear].filter(h => h.date >= todayStr && h.date <= limitStr);
}

/** Est-ce que c'est un jour férié? */
export function isHoliday(dateStr: string): Holiday | null {
  const year = parseInt(dateStr.slice(0, 4));
  return getQcHolidays(year).find(h => h.date === dateStr) ?? null;
}
