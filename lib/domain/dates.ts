// Local-time ISO date helpers (yyyy-mm-dd). Everything date-shaped in the app is
// a local calendar day, never a UTC timestamp — a session belongs to the day the
// user trained on, wherever they are. Kept here so plan layout, the calendar and
// the profile all agree rather than each re-deriving it.

import type { Weekday } from "./types";

// 0 = Sunday … 6 = Saturday, matching Date.getDay().
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export const WEEKDAY_LONG: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

// Display order starts on Monday — how people read a training week.
export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function weekdayOf(iso: string): Weekday {
  return parseISODate(iso).getDay() as Weekday;
}

export function daysBetween(startISO: string, endISO: string): number {
  const a = parseISODate(startISO).getTime();
  const b = parseISODate(endISO).getTime();
  return Math.round((b - a) / 86_400_000);
}

// The first date on or after `fromISO` that falls on `weekday`.
export function nextWeekdayOnOrAfter(fromISO: string, weekday: Weekday): string {
  const delta = (weekday - weekdayOf(fromISO) + 7) % 7;
  return addDays(fromISO, delta);
}

// Lay a set of preferred weekdays out across `weeks` calendar weeks, starting from
// the week that contains `startISO` but never scheduling a day in the past.
// Week 0 may therefore be short if the block starts mid-week — that's correct: the
// user shouldn't get a "planned" day they already missed.
export function planDates(
  startISO: string,
  weekdays: Weekday[],
  weeks: number,
): { weekIndex: number; weekday: Weekday; date: string }[] {
  if (weekdays.length === 0) return [];
  // Monday of the week containing startISO.
  const startDow = weekdayOf(startISO);
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const week0Monday = addDays(startISO, mondayOffset);

  const ordered = WEEKDAY_ORDER.filter((d) => weekdays.includes(d));
  const out: { weekIndex: number; weekday: Weekday; date: string }[] = [];

  for (let w = 0; w < weeks; w++) {
    const monday = addDays(week0Monday, w * 7);
    for (const dow of ordered) {
      // Offset from Monday, with Sunday last.
      const offset = dow === 0 ? 6 : dow - 1;
      const date = addDays(monday, offset);
      if (date < startISO) continue; // don't schedule days already gone
      out.push({ weekIndex: w, weekday: dow, date });
    }
  }
  return out;
}

export function fmtWeekdayDate(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
