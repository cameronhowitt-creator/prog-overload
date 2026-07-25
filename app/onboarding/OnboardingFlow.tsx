"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  ApproxDate,
  OnboardingLiftEntry,
  Profile,
  UnitsPreference,
} from "@/lib/domain/types";
import {
  displayHeight,
  displayWeightNumber,
  heightToCanonicalCm,
  resolveUnits,
  toCanonicalWeightKg,
  weightUnit,
} from "@/lib/domain/units";
import {
  completeOnboardingAction,
  saveActiveLiftsAction,
  saveBaselinesAction,
  saveProfileStepAction,
} from "./actions";

export type OnboardingLift = {
  id: string;
  name: string;
  muscleGroups: string[];
  equipment: string;
};
type Group = { label: string; lifts: OnboardingLift[] };
type BaselineDraft = { weight: string; reps: string; approxDate: ApproxDate };

// Ordered steps. `data` steps persist on advance; welcome/confirm don't. Units is
// the FIRST data step so weight/height inputs downstream are in the right unit.
const STEPS = [
  "welcome",
  "units",
  "basic",
  "goals",
  "logistics",
  "select",
  "baselines",
  "health",
  "cycle",
  "recovery",
  "extras",
  "confirm",
] as const;
type Step = (typeof STEPS)[number];

const EQUIP_LABEL: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  bands: "Bands",
  "trap-bar": "Trap bar",
};
const APPROX: { key: ApproxDate; label: string }[] = [
  { key: "this_week", label: "This week" },
  { key: "few_weeks_ago", label: "A few weeks" },
  { key: "over_a_month_ago", label: "1 month+" },
];
const INJURY_TAGS = ["Knee", "Lower back", "Shoulder", "Hip", "Wrist", "Elbow", "Ankle", "Neck"];
const MOBILITY_TAGS = ["Ankles", "Hips", "Thoracic spine", "Shoulders", "Hamstrings"];

export default function OnboardingFlow({
  groups,
  prefillActive,
  prefill,
  returning,
}: {
  groups: Group[];
  prefillActive: string[];
  prefill: Profile;
  returning: boolean;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const step: Step = STEPS[stepIdx];
  const [pending, startTransition] = useTransition();

  // Prefill height/weight in the user's stored unit (or blank for a new user).
  const initUnits = resolveUnits(prefill.unitsPreference);
  const hd = prefill.heightCm != null ? displayHeight(prefill.heightCm, initUnits) : null;

  // Profile form fields (numbers kept as strings for inputs; weight/height are in
  // DISPLAY units and converted to canonical kg/cm on save).
  const [f, setF] = useState({
    unitsPreference: (prefill.unitsPreference ?? "") as UnitsPreference | "",
    name: prefill.name ?? "",
    age: prefill.age?.toString() ?? "",
    heightCm: hd && "cm" in hd ? String(hd.cm) : "",
    heightFt: hd && "feet" in hd ? String(hd.feet) : "",
    heightIn: hd && "inches" in hd ? String(hd.inches) : "",
    weight:
      prefill.weightKg != null ? String(displayWeightNumber(prefill.weightKg, initUnits)) : "",
    primaryGoal: prefill.primaryGoal ?? "",
    experienceLevel: prefill.experienceLevel ?? "",
    daysPerWeek: prefill.daysPerWeek?.toString() ?? "",
    sessionDurationMinutes: prefill.sessionDurationMinutes?.toString() ?? "60",
    equipmentAccess: prefill.equipmentAccess ?? "full_gym",
    injuryFlags: prefill.injuryFlags ?? [],
    mobilityFlags: prefill.mobilityFlags ?? [],
    medicalClearanceStatus: prefill.medicalClearanceStatus ?? "",
    pregnancyPostpartumStatus: prefill.pregnancyPostpartumStatus ?? "",
    cycleTrackingOptIn: prefill.cycleTrackingOptIn ?? false,
    cycleLengthDays: prefill.cycleLengthDays?.toString() ?? "28",
    typicalSleepHours: prefill.typicalSleepHours?.toString() ?? "",
    stressLevel: prefill.stressLevel ?? "",
    activityOutsideGym: prefill.activityOutsideGym ?? "",
    creatineStatus: prefill.creatineStatus ?? "",
    dislikedExercises: (prefill.dislikedExercises ?? []).join(", "),
  });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const [selected, setSelected] = useState<Set<string>>(new Set(prefillActive));
  const [baselines, setBaselines] = useState<Record<string, BaselineDraft>>({});

  const allLifts = useMemo(
    () => new Map(groups.flatMap((g) => g.lifts).map((l) => [l.id, l])),
    [groups],
  );
  const selectedLifts = useMemo(
    () => [...selected].map((id) => allLifts.get(id)!).filter(Boolean),
    [selected, allLifts],
  );

  const num = (s: string) => (s.trim() ? Number(s) : undefined);

  const units = resolveUnits(f.unitsPreference || undefined);

  // The profile patch for a given step (only that step's fields). Height/weight are
  // in display units and converted to canonical cm/kg here (PRD §6.6).
  function patchForStep(s: Step): Partial<Omit<Profile, "id">> {
    switch (s) {
      case "units":
        return { unitsPreference: (f.unitsPreference || undefined) as Profile["unitsPreference"] };
      case "basic": {
        const heightCm = heightToCanonicalCm(
          units,
          units === "imperial"
            ? { feet: num(f.heightFt), inches: num(f.heightIn) }
            : { cm: num(f.heightCm) },
        );
        const weightKg = f.weight ? toCanonicalWeightKg(Number(f.weight), units) : undefined;
        return { name: f.name || undefined, age: num(f.age), heightCm, weightKg };
      }
      case "goals":
        return {
          primaryGoal: f.primaryGoal || undefined,
          experienceLevel: (f.experienceLevel || undefined) as Profile["experienceLevel"],
        };
      case "logistics":
        return {
          daysPerWeek: num(f.daysPerWeek),
          sessionDurationMinutes: num(f.sessionDurationMinutes),
          equipmentAccess: f.equipmentAccess as Profile["equipmentAccess"],
        };
      case "health":
        return {
          injuryFlags: f.injuryFlags,
          mobilityFlags: f.mobilityFlags,
          medicalClearanceStatus: f.medicalClearanceStatus || undefined,
          pregnancyPostpartumStatus: f.pregnancyPostpartumStatus || undefined,
        };
      case "cycle":
        return {
          cycleTrackingOptIn: f.cycleTrackingOptIn,
          cycleLengthDays: f.cycleTrackingOptIn ? num(f.cycleLengthDays) : undefined,
        };
      case "recovery":
        return {
          typicalSleepHours: num(f.typicalSleepHours),
          stressLevel: (f.stressLevel || undefined) as Profile["stressLevel"],
          activityOutsideGym: (f.activityOutsideGym || undefined) as Profile["activityOutsideGym"],
        };
      case "extras":
        return {
          creatineStatus: (f.creatineStatus || undefined) as Profile["creatineStatus"],
          dislikedExercises: f.dislikedExercises
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        };
      default:
        return {};
    }
  }

  function next() {
    const s = step;
    startTransition(async () => {
      if (s === "select") {
        await saveActiveLiftsAction([...selected]);
      } else if (s === "baselines") {
        const entries: OnboardingLiftEntry[] = selectedLifts.map((l) => {
          const d = baselines[l.id];
          return {
            exerciseId: l.id,
            // baseline weight is entered in display units → store canonical kg.
            weight: d?.weight ? toCanonicalWeightKg(Number(d.weight), units) : undefined,
            reps: d?.reps ? Number(d.reps) : undefined,
            approxDate: d?.approxDate ?? "few_weeks_ago",
            source: "onboarding",
          };
        });
        await saveBaselinesAction(entries);
      } else {
        const patch = patchForStep(s);
        if (Object.keys(patch).length) await saveProfileStepAction(patch);
      }
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    });
  }
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));
  const goto = (s: Step) => setStepIdx(STEPS.indexOf(s));

  function finish() {
    startTransition(async () => {
      await completeOnboardingAction(); // redirects to /today
    });
  }

  const baselineCount = selectedLifts.filter((l) => baselines[l.id]?.weight && baselines[l.id]?.reps).length;

  return (
    <div className="app-shell">
      <div className="scroll-area" style={{ paddingBottom: 24 }}>
        <div className="ob-progress">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= stepIdx ? "on" : ""} />
          ))}
        </div>

        {/* WELCOME */}
        {step === "welcome" && (
          <div className="ob-step">
            <h1 className="ob-title">
              {returning ? "Update your setup" : "Let's build your training profile"}
            </h1>
            <p className="ob-lead">
              A few quick questions so we can program for your body, goals,
              equipment, and where you left each lift — then pick up your
              progression instead of starting from scratch. Everything is editable
              later.
            </p>
            <button className="btn-primary" onClick={next} disabled={pending}>
              {pending ? "…" : "Get started"}
            </button>
          </div>
        )}

        {/* UNITS — first data step, no default (PRD §6.6) */}
        {step === "units" && (
          <StepShell
            title="Pounds or kilograms?"
            lead="Choose how you'd like to enter and see weights and height. You can change this anytime — it only affects display, never your saved numbers."
            onBack={back}
            onNext={next}
            pending={pending}
            nextDisabled={!f.unitsPreference}
          >
            <div className="chip-grid">
              {([
                { key: "imperial", label: "Imperial", sub: "lb · ft / in" },
                { key: "metric", label: "Metric", sub: "kg · cm" },
              ] as const).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`chip${f.unitsPreference === o.key ? " selected" : ""}`}
                  style={{ width: "calc(50% - 5px)" }}
                  onClick={() => set({ unitsPreference: o.key })}
                >
                  <div className="thumb">{f.unitsPreference === o.key ? "✓" : o.label.charAt(0)}</div>
                  <div className="txt">
                    <div className="n">{o.label}</div>
                    <div className="e">{o.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {/* BASIC INFO */}
        {step === "basic" && (
          <StepShell title="About you" lead="The basics we use to scale loads and volume." onBack={back} onNext={next} pending={pending}>
            <Text label="Name" value={f.name} onChange={(v) => set({ name: v })} placeholder="First name" />
            <Row>
              <NumField label="Age" value={f.age} onChange={(v) => set({ age: v })} />
              {units === "imperial" ? (
                <>
                  <NumField label="Height (ft)" value={f.heightFt} onChange={(v) => set({ heightFt: v })} />
                  <NumField label="(in)" value={f.heightIn} onChange={(v) => set({ heightIn: v })} />
                </>
              ) : (
                <NumField label="Height (cm)" value={f.heightCm} onChange={(v) => set({ heightCm: v })} />
              )}
            </Row>
            <NumField label={`Bodyweight (${weightUnit(units)})`} value={f.weight} onChange={(v) => set({ weight: v })} />
          </StepShell>
        )}

        {/* GOALS & EXPERIENCE */}
        {step === "goals" && (
          <StepShell title="Goals & experience" lead="What are you training for, and how long have you lifted?" onBack={back} onNext={next} pending={pending}>
            <Text label="Primary goal" value={f.primaryGoal} onChange={(v) => set({ primaryGoal: v })} placeholder="e.g. build strength, add muscle" />
            <Seg
              label="Experience"
              value={f.experienceLevel}
              onChange={(v) => set({ experienceLevel: v as typeof f.experienceLevel })}
              options={[
                { key: "new", label: "New" },
                { key: "under_1yr", label: "<1 yr" },
                { key: "1_3yr", label: "1–3 yr" },
                { key: "3yr_plus", label: "3+ yr" },
              ]}
            />
          </StepShell>
        )}

        {/* LOGISTICS */}
        {step === "logistics" && (
          <StepShell title="Training logistics" lead="How your week and gym look." onBack={back} onNext={next} pending={pending}>
            <Row>
              <NumField label="Days / week" value={f.daysPerWeek} onChange={(v) => set({ daysPerWeek: v })} />
              <NumField label="Session (min)" value={f.sessionDurationMinutes} onChange={(v) => set({ sessionDurationMinutes: v })} />
            </Row>
            <Seg
              label="Equipment access"
              value={f.equipmentAccess}
              onChange={(v) => set({ equipmentAccess: v as typeof f.equipmentAccess })}
              options={[
                { key: "full_gym", label: "Full gym" },
                { key: "home_gym", label: "Home gym" },
                { key: "limited_dumbbells", label: "Dumbbells" },
                { key: "bodyweight", label: "Bodyweight" },
              ]}
            />
          </StepShell>
        )}

        {/* LIFT SELECTION (2a) */}
        {step === "select" && (
          <StepShell
            title="Which lifts do you train?"
            lead="Pick the lifts you currently do — these become your working set. We program core and mobility around them."
            onBack={back}
            onNext={next}
            pending={pending}
            nextLabel={`Continue (${selected.size})`}
            nextDisabled={selected.size === 0}
          >
            {groups.map((g) => (
              <div key={g.label}>
                <div className="section-label" style={{ paddingLeft: 0 }}>{g.label}</div>
                <div className="chip-grid">
                  {g.lifts.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`chip${selected.has(l.id) ? " selected" : ""}`}
                      onClick={() =>
                        setSelected((prev) => {
                          const n = new Set(prev);
                          n.has(l.id) ? n.delete(l.id) : n.add(l.id);
                          return n;
                        })
                      }
                    >
                      <div className="thumb">{selected.has(l.id) ? "✓" : l.name.charAt(0)}</div>
                      <div className="txt">
                        <div className="n">{l.name}</div>
                        <div className="e">{EQUIP_LABEL[l.equipment] ?? l.equipment}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </StepShell>
        )}

        {/* BASELINES (2b) */}
        {step === "baselines" && (
          <StepShell title="Where did you leave each lift?" lead="Your last solid working set. All optional — skip any and we'll set a first-time target." onBack={back} onNext={next} pending={pending}>
            {selectedLifts.map((l) => {
              const d = baselines[l.id] ?? { weight: "", reps: "", approxDate: "few_weeks_ago" as ApproxDate };
              const upd = (patch: Partial<BaselineDraft>) =>
                setBaselines((prev) => ({ ...prev, [l.id]: { ...d, ...patch } }));
              return (
                <div className="ob-row" key={l.id}>
                  <div className="ob-row-name">{l.name}</div>
                  <div className="ob-row-fields">
                    <div className="log-field">
                      <input type="number" inputMode="decimal" placeholder={weightUnit(units)} aria-label={`${l.name} weight`} value={d.weight} onChange={(e) => upd({ weight: e.target.value })} />
                      <span>{weightUnit(units)}</span>
                    </div>
                    <div className="log-times">×</div>
                    <div className="log-field">
                      <input type="number" inputMode="numeric" placeholder="reps" aria-label={`${l.name} reps`} value={d.reps} onChange={(e) => upd({ reps: e.target.value })} />
                      <span>reps</span>
                    </div>
                  </div>
                  <div className="seg">
                    {APPROX.map((a) => (
                      <button key={a.key} type="button" className={d.approxDate === a.key ? "active" : ""} onClick={() => upd({ approxDate: a.key })}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </StepShell>
        )}

        {/* HEALTH & SAFETY */}
        {step === "health" && (
          <StepShell title="Health & safety" lead="So we can avoid loading anything that bothers you and add the right technique cues." onBack={back} onNext={next} pending={pending}>
            <p className="ob-privacy">
              🔒 Health details are private to your account, used only to tailor your
              programming, and never shared.
            </p>
            <Tags label="Current injuries / niggles" presets={INJURY_TAGS} value={f.injuryFlags} onChange={(v) => set({ injuryFlags: v })} />
            <Tags label="Mobility limitations" presets={MOBILITY_TAGS} value={f.mobilityFlags} onChange={(v) => set({ mobilityFlags: v })} />
            <Sel label="Medical clearance" value={f.medicalClearanceStatus} onChange={(v) => set({ medicalClearanceStatus: v })} options={[["", "—"], ["not_needed", "Not needed"], ["cleared", "Cleared by a doctor"], ["pending", "Awaiting clearance"], ["condition", "Have a condition to note"]]} />
            <Sel label="Pregnancy / postpartum" value={f.pregnancyPostpartumStatus} onChange={(v) => set({ pregnancyPostpartumStatus: v })} options={[["", "—"], ["na", "N/A"], ["pregnant", "Pregnant"], ["postpartum", "Postpartum"], ["prefer_not", "Prefer not to say"]]} />
          </StepShell>
        )}

        {/* CYCLE OPT-IN */}
        {step === "cycle" && (
          <StepShell title="Menstrual cycle tracking" lead="Optional. If you opt in, we can phase your load and volume across your cycle. Off by default." onBack={back} onNext={next} pending={pending}>
            <label className="ob-toggle">
              <input type="checkbox" checked={f.cycleTrackingOptIn} onChange={(e) => set({ cycleTrackingOptIn: e.target.checked })} />
              <span>Enable cycle-aware programming</span>
            </label>
            {f.cycleTrackingOptIn && (
              <NumField label="Typical cycle length (days)" value={f.cycleLengthDays} onChange={(v) => set({ cycleLengthDays: v })} />
            )}
          </StepShell>
        )}

        {/* RECOVERY */}
        {step === "recovery" && (
          <StepShell title="Recovery & lifestyle" lead="Your baseline, so we can back off when recovery looks compromised." onBack={back} onNext={next} pending={pending}>
            <NumField label="Typical sleep (hours)" value={f.typicalSleepHours} onChange={(v) => set({ typicalSleepHours: v })} />
            <Seg label="Stress level" value={f.stressLevel} onChange={(v) => set({ stressLevel: v as typeof f.stressLevel })} options={[["low", "Low"], ["moderate", "Moderate"], ["high", "High"]].map(([k, l]) => ({ key: k, label: l }))} />
            <Seg label="Activity outside the gym" value={f.activityOutsideGym} onChange={(v) => set({ activityOutsideGym: v as typeof f.activityOutsideGym })} options={[{ key: "sedentary", label: "Sedentary" }, { key: "active_job", label: "Active job" }, { key: "other_sport", label: "Another sport" }]} />
          </StepShell>
        )}

        {/* EXTRAS */}
        {step === "extras" && (
          <StepShell title="A couple of extras" lead="Optional." onBack={back} onNext={next} pending={pending}>
            <Seg label="Creatine" value={f.creatineStatus} onChange={(v) => set({ creatineStatus: v as typeof f.creatineStatus })} options={[{ key: "yes", label: "Taking it" }, { key: "no", label: "Not taking it" }, { key: "considering", label: "Considering" }]} />
            <Text label="Exercises you dislike (comma-separated)" value={f.dislikedExercises} onChange={(v) => set({ dislikedExercises: v })} placeholder="e.g. burpees, leg press" />
          </StepShell>
        )}

        {/* CONFIRM */}
        {step === "confirm" && (
          <div className="ob-step">
            <h1 className="ob-title">You&apos;re set</h1>
            <p className="ob-lead">
              <b>{selected.size}</b> {selected.size === 1 ? "lift" : "lifts"} ·{" "}
              <b>{baselineCount}</b> with a starting point. Review and start.
            </p>
            <div className="ob-summary">
              <SummaryRow label="Goal" value={f.primaryGoal || "—"} onEdit={() => goto("goals")} />
              <SummaryRow label="Experience" value={f.experienceLevel || "—"} onEdit={() => goto("goals")} />
              <SummaryRow label="Days / session" value={`${f.daysPerWeek || "?"}× · ${f.sessionDurationMinutes || 60} min`} onEdit={() => goto("logistics")} />
              <SummaryRow label="Equipment" value={f.equipmentAccess} onEdit={() => goto("logistics")} />
              <SummaryRow label="Lifts" value={`${selected.size} selected`} onEdit={() => goto("select")} />
              <SummaryRow label="Baselines" value={`${baselineCount} entered`} onEdit={() => goto("baselines")} />
              <SummaryRow label="Injuries" value={f.injuryFlags.length ? f.injuryFlags.join(", ") : "none"} onEdit={() => goto("health")} />
              <SummaryRow label="Cycle tracking" value={f.cycleTrackingOptIn ? "on" : "off"} onEdit={() => goto("cycle")} />
            </div>
            <div className="ob-actions">
              <button className="btn-ghost" onClick={back} disabled={pending}>Back</button>
              <button className="btn-primary" onClick={finish} disabled={pending}>
                {pending ? "Building your session…" : "Start training"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── small building blocks ─────────────────────────────────────────────────── */

function StepShell({
  title, lead, children, onBack, onNext, pending, nextLabel = "Continue", nextDisabled = false,
}: {
  title: string; lead: string; children: React.ReactNode; onBack: () => void; onNext: () => void;
  pending: boolean; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="ob-step">
      <h1 className="ob-title">{title}</h1>
      <p className="ob-lead">{lead}</p>
      {children}
      <div className="ob-actions">
        <button className="btn-ghost" onClick={onBack} disabled={pending}>Back</button>
        <button className="btn-primary" onClick={onNext} disabled={pending || nextDisabled}>
          {pending ? "…" : nextLabel}
        </button>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}
function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field" style={{ flex: 1 }}>
      <label>{label}</label>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
      </select>
    </div>
  );
}
function Seg({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { key: string; label: string }[] }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="seg">
        {options.map((o) => (
          <button key={o.key} type="button" className={value === o.key ? "active" : ""} onClick={() => onChange(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
function Tags({ label, presets, value, onChange }: { label: string; presets: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const addCustom = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom("");
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div className="cues" style={{ marginTop: 0 }}>
        {[...new Set([...presets, ...value])].map((t) => (
          <button key={t} type="button" className={`cue-pill${value.includes(t) ? " on" : ""}`} onClick={() => toggle(t)} style={value.includes(t) ? { background: "var(--primary)", color: "#fff" } : undefined}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input type="text" placeholder="Add your own…" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())} />
        <button type="button" className="btn-ghost" style={{ width: "auto", padding: "0 16px" }} onClick={addCustom}>Add</button>
      </div>
    </div>
  );
}
function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="ob-summary-row">
      <span>
        <span style={{ color: "var(--ink-muted-48)", marginRight: 8 }}>{label}</span>
        {value}
      </span>
      <button type="button" className="text-link" style={{ fontSize: 13 }} onClick={onEdit}>Edit</button>
    </div>
  );
}
