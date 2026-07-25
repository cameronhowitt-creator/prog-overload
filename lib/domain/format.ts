// Pure display formatters — safe to import from client components.

import type { LastTime, PRReference } from "./types";

export function fmtWeight(w: number | null): string {
  return w === null ? "BW" : `${w}`;
}

export function fmtReps(low: number, high: number): string {
  return low === high ? `${low}` : `${low}–${high}`;
}

export function fmtRest(low: number, high: number): string {
  const unit = (s: number) => (s % 60 === 0 ? `${s / 60}` : `${s}s`);
  const lo = low % 60 === 0 ? `${low / 60}` : `${low}s`;
  const hi = high % 60 === 0 ? `${high / 60} min` : `${high}s`;
  // e.g. 120/180 -> "2–3 min"; 90/120 -> "90s–2 min"
  return `${lo}–${hi.replace(" min", "")} min`.replace("ss", "s");
}

export function fmtLastTime(lt: LastTime | null): string {
  if (!lt) return "—";
  const load = lt.weight ? `${lt.weight} lb` : "BW";
  return `${load} × ${lt.sets}×${lt.reps}`;
}

export function fmtPR(pr: PRReference | null): string {
  if (!pr) return "—";
  const load = pr.weight ? `${pr.weight} lb` : "BW";
  return `${load}`;
}

export function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const CATEGORY_LABEL: Record<string, string> = {
  primary: "Primary lift",
  secondary: "Secondary",
  accessory: "Accessory",
  core: "Core",
  mobility: "Corrective",
};
