// Pure display formatters — safe to import from client components. Weight values
// are canonical kg; formatters take the user's units preference (PRD §6.6).

import type { LastTime, PRReference } from "./types";
import {
  displayWeightNumber,
  formatWeight,
  type UnitsPreference,
} from "./units";

// Canonical kg → the plain number in the user's unit (for the prescription line).
export function fmtWeight(kg: number | null, units: UnitsPreference): string {
  return kg === null ? "BW" : `${displayWeightNumber(kg, units)}`;
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

export function fmtLastTime(lt: LastTime | null, units: UnitsPreference): string {
  if (!lt) return "—";
  const load = lt.weight ? formatWeight(lt.weight, units) : "BW";
  return `${load} × ${lt.sets}×${lt.reps}`;
}

export function fmtPR(pr: PRReference | null, units: UnitsPreference): string {
  if (!pr) return "—";
  return pr.weight ? formatWeight(pr.weight, units) : "BW";
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
