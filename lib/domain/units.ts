// Units preference + conversion (PRD §6.6 units step).
//
// CANONICAL STORAGE is metric everywhere: weights in kg, heights in cm. The user's
// units_preference only affects the input and display EDGES — stored values are
// never re-scaled when the preference changes, so a lift logged at 130 lb (stored
// 58.97 kg) always shows 130 lb for imperial, ~59 kg for metric.

export type UnitsPreference = "imperial" | "metric";

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

// Legacy/unset fallback for display — the app + seed data are lb-oriented, so an
// unset preference renders imperial. Onboarded users always have an explicit value.
export function resolveUnits(pref: UnitsPreference | undefined | null): UnitsPreference {
  return pref ?? "imperial";
}

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;

function round(n: number, toNearest = 0.5): number {
  return Math.round(n / toNearest) * toNearest;
}
function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export function weightUnit(units: UnitsPreference): string {
  return units === "imperial" ? "lb" : "kg";
}

// Canonical kg → the number shown in the user's unit (rounded to a clean plate step).
export function displayWeightNumber(kg: number, units: UnitsPreference): number {
  return round(units === "imperial" ? kgToLb(kg) : kg, 0.5);
}

// Canonical kg → "130 lb" / "59 kg".
export function formatWeight(kg: number | null | undefined, units: UnitsPreference): string {
  if (kg == null) return "BW";
  return `${trim(displayWeightNumber(kg, units))} ${weightUnit(units)}`;
}

// A value the user typed in their unit → canonical kg.
export function toCanonicalWeightKg(value: number, units: UnitsPreference): number {
  return units === "imperial" ? lbToKg(value) : value;
}

// The clean load step in the user's unit: +5 lb (imperial) / +2.5 kg (metric),
// returned as the resulting CANONICAL kg for a given last weight (kg).
export function nextTargetKg(lastKg: number, units: UnitsPreference): number {
  const step = units === "imperial" ? 5 : 2.5;
  const lastDisplay = displayWeightNumber(lastKg, units);
  const targetDisplay = round(lastDisplay + step, 0.5);
  return toCanonicalWeightKg(targetDisplay, units);
}

// ── height ──────────────────────────────────────────────────────────────────
export type HeightInput = { cm?: number; feet?: number; inches?: number };

export function heightToCanonicalCm(units: UnitsPreference, h: HeightInput): number | undefined {
  if (units === "imperial") {
    const totalIn = (h.feet ?? 0) * 12 + (h.inches ?? 0);
    return totalIn > 0 ? totalIn * CM_PER_IN : undefined;
  }
  return h.cm && h.cm > 0 ? h.cm : undefined;
}

// Canonical cm → { feet, inches } (imperial) or { cm } (metric), for display/inputs.
export function displayHeight(cm: number, units: UnitsPreference): { feet: number; inches: number } | { cm: number } {
  if (units === "imperial") {
    const totalIn = Math.round(cm / CM_PER_IN);
    return { feet: Math.floor(totalIn / 12), inches: totalIn % 12 };
  }
  return { cm: Math.round(cm) };
}

export function formatHeight(cm: number | null | undefined, units: UnitsPreference): string {
  if (cm == null) return "—";
  const h = displayHeight(cm, units);
  return "cm" in h ? `${h.cm} cm` : `${h.feet}'${h.inches}"`;
}

export const heightUnitLabel = (units: UnitsPreference) => (units === "imperial" ? "ft / in" : "cm");
