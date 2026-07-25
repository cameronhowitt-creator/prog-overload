// Seed exercise library (PRD §6.5, §7).
//
// The PRD's cited source files (Emma_Trainerize_Workout_Knowledge.md, the PDF) are
// not present, so this starter library is derived from the PRD's own descriptions +
// the movements in workout_app_mockup.html, organized by movement pattern so every
// primary/secondary lift has >=2-3 valid same-pattern alternatives to swap to.
// Real Trainerize data can replace/augment this later (PRD §7 data-quality note).

import type { Exercise } from "../domain/types";

export const SEED_EXERCISES: Exercise[] = [
  // ── Squat pattern — quads/glutes ────────────────────────────────────────────
  {
    id: "barbell-back-squat",
    name: "Barbell back squat",
    muscleGroups: ["quads", "glutes"],
    category: "primary",
    equipment: "barbell",
    isCoreLift: true,
    defaultCues: [
      "Brace before descending",
      "Knees track over toes",
      "Drive through mid-foot",
    ],
  },
  {
    id: "goblet-squat",
    name: "Goblet squat",
    muscleGroups: ["quads", "glutes"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: ["Elbows inside knees", "Chest tall", "Sit between the hips"],
  },
  {
    id: "bulgarian-split-squat",
    name: "Bulgarian split squat",
    muscleGroups: ["quads", "glutes"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: [
      "Weight through front heel",
      "Vertical front shin at the bottom",
      "Square hips forward",
    ],
  },
  {
    id: "angled-leg-press",
    name: "Angled machine leg press",
    muscleGroups: ["quads", "glutes"],
    category: "secondary",
    equipment: "machine",
    defaultCues: ["Feet shoulder width", "Don't lock the knees", "Control the negative"],
  },
  {
    id: "hack-squat",
    name: "Hack squat",
    muscleGroups: ["quads", "glutes"],
    category: "secondary",
    equipment: "machine",
    defaultCues: ["Full depth", "Heels planted", "Brace the core"],
  },

  // ── Hinge pattern — posterior chain ─────────────────────────────────────────
  {
    id: "trap-bar-deadlift",
    name: "Trap bar deadlift",
    muscleGroups: ["hamstrings", "glutes", "back"],
    category: "primary",
    equipment: "trap-bar",
    isCoreLift: true,
    defaultCues: [
      "Push the ground away",
      "Brace before the pull",
      "Chest up through lockout",
    ],
  },
  {
    id: "barbell-sumo-deadlift",
    name: "Barbell sumo deadlift",
    muscleGroups: ["hamstrings", "glutes", "back"],
    category: "primary",
    equipment: "barbell",
    isCoreLift: true,
    defaultCues: ["Spread the floor", "Lats tight to the bar", "Hips and chest rise together"],
  },
  {
    id: "romanian-deadlift",
    name: "Romanian deadlift",
    muscleGroups: ["hamstrings", "glutes"],
    category: "secondary",
    equipment: "barbell",
    defaultCues: ["Soft knees", "Push hips back", "Bar stays close to the legs"],
  },
  {
    id: "db-romanian-deadlift",
    name: "Dumbbell Romanian deadlift",
    muscleGroups: ["hamstrings", "glutes"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: ["Hinge at the hips", "Flat back", "Feel the hamstring stretch"],
  },
  {
    id: "back-extension",
    name: "Back extension",
    muscleGroups: ["hamstrings", "glutes", "lower-back"],
    category: "accessory",
    equipment: "bodyweight",
    defaultCues: ["Round then extend under control", "Squeeze glutes at the top", "No hyperextension"],
  },

  // ── Lunge — unilateral quads/glutes ─────────────────────────────────────────
  {
    id: "barbell-reverse-lunge",
    name: "Barbell reverse lunge",
    muscleGroups: ["quads", "glutes"],
    category: "secondary",
    equipment: "barbell",
    defaultCues: ["Step back under control", "Torso upright", "Push through the front heel"],
  },
  {
    id: "walking-lunge",
    name: "Dumbbell walking lunge",
    muscleGroups: ["quads", "glutes"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: ["Long steps", "Knee tracks the toe", "Stay tall"],
  },
  {
    id: "db-step-up",
    name: "Dumbbell step-up",
    muscleGroups: ["quads", "glutes"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: ["Full foot on the box", "Drive through the heel", "Control the way down"],
  },

  // ── Horizontal push — chest ─────────────────────────────────────────────────
  {
    id: "barbell-bench-press",
    name: "Barbell bench press",
    muscleGroups: ["chest", "triceps", "shoulders"],
    category: "primary",
    equipment: "barbell",
    isCoreLift: true,
    defaultCues: ["Shoulder blades pinned", "Bar to lower chest", "Drive feet into the floor"],
  },
  {
    id: "db-bench-press",
    name: "Dumbbell bench press",
    muscleGroups: ["chest", "triceps", "shoulders"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: ["Wrists stacked over elbows", "Control the stretch", "Press slightly inward"],
  },
  {
    id: "machine-chest-press",
    name: "Machine chest press",
    muscleGroups: ["chest", "triceps", "shoulders"],
    category: "secondary",
    equipment: "machine",
    defaultCues: ["Handles at mid-chest", "Don't flare the elbows", "Full lockout, no slam"],
  },

  // ── Vertical push — shoulders ───────────────────────────────────────────────
  {
    id: "barbell-overhead-press",
    name: "Barbell overhead press",
    muscleGroups: ["shoulders", "triceps"],
    category: "primary",
    equipment: "barbell",
    isCoreLift: true,
    defaultCues: ["Squeeze glutes, ribs down", "Bar path past the chin", "Shrug at lockout"],
  },
  {
    id: "db-shoulder-press",
    name: "Dumbbell shoulder press",
    muscleGroups: ["shoulders", "triceps"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: ["Neutral or slight arc", "Ribs down", "Full lockout overhead"],
  },
  {
    id: "machine-shoulder-press",
    name: "Machine shoulder press",
    muscleGroups: ["shoulders", "triceps"],
    category: "secondary",
    equipment: "machine",
    defaultCues: ["Seat height at shoulder", "Controlled negative", "Don't lean back"],
  },

  // ── Horizontal pull — back (chest-supported row is EXCLUDED for Emma) ────────
  {
    id: "seated-cable-row",
    name: "Seated cable row",
    muscleGroups: ["back", "biceps"],
    category: "secondary",
    equipment: "cable",
    defaultCues: ["Lead with the elbows", "Squeeze the shoulder blades", "Don't rock the torso"],
  },
  {
    id: "single-arm-db-row",
    name: "Single-arm dumbbell row",
    muscleGroups: ["back", "biceps"],
    category: "secondary",
    equipment: "dumbbell",
    defaultCues: ["Flat back", "Row to the hip", "Full stretch at the bottom"],
  },
  {
    id: "inverted-row",
    name: "Inverted row",
    muscleGroups: ["back", "biceps"],
    category: "accessory",
    equipment: "bodyweight",
    defaultCues: ["Body in a straight line", "Pull chest to the bar", "Squeeze at the top"],
  },

  // ── Vertical pull — back/lats ───────────────────────────────────────────────
  {
    id: "pull-up",
    name: "Pull-up",
    muscleGroups: ["back", "biceps"],
    category: "primary",
    equipment: "bodyweight",
    isCoreLift: true,
    defaultCues: ["Start from a dead hang", "Drive elbows down", "Chest to the bar"],
  },
  {
    id: "lat-pulldown",
    name: "Close neutral grip lat pulldown",
    muscleGroups: ["back", "biceps"],
    category: "secondary",
    equipment: "machine",
    defaultCues: ["Bar to the collarbone", "Elbows down and in", "Control the way up"],
  },
  {
    id: "wide-lat-pulldown",
    name: "Wide grip lat pulldown",
    muscleGroups: ["back", "biceps"],
    category: "secondary",
    equipment: "machine",
    defaultCues: ["Slight lean back", "Lead with the elbows", "Full stretch overhead"],
  },
  {
    id: "assisted-pull-up",
    name: "Assisted pull-up",
    muscleGroups: ["back", "biceps"],
    category: "secondary",
    equipment: "machine",
    defaultCues: ["Full range each rep", "Drive elbows to the ribs", "Control the descent"],
  },

  // ── Arms — accessory/isolation ──────────────────────────────────────────────
  {
    id: "db-bicep-curl",
    name: "Dumbbell bicep curl",
    muscleGroups: ["biceps"],
    category: "accessory",
    equipment: "dumbbell",
    defaultCues: ["Elbows pinned to the sides", "No swinging", "Full squeeze at the top"],
  },
  {
    id: "barbell-curl",
    name: "Barbell curl",
    muscleGroups: ["biceps"],
    category: "accessory",
    equipment: "barbell",
    defaultCues: ["Keep elbows still", "Control the negative", "Don't lean back"],
  },
  {
    id: "hammer-curl",
    name: "Hammer curl",
    muscleGroups: ["biceps", "forearms"],
    category: "accessory",
    equipment: "dumbbell",
    defaultCues: ["Neutral grip", "Elbows fixed", "Slow eccentric"],
  },
  {
    id: "cable-curl",
    name: "Cable curl",
    muscleGroups: ["biceps"],
    category: "accessory",
    equipment: "cable",
    defaultCues: ["Constant tension", "Elbows at the sides", "Full range"],
  },
  {
    id: "tricep-pushdown",
    name: "Tricep pushdown",
    muscleGroups: ["triceps"],
    category: "accessory",
    equipment: "cable",
    defaultCues: ["Elbows pinned", "Full lockout", "Control back to the top"],
  },
  {
    id: "overhead-tricep-extension",
    name: "Overhead dumbbell tricep extension",
    muscleGroups: ["triceps"],
    category: "accessory",
    equipment: "dumbbell",
    defaultCues: ["Elbows point forward", "Full stretch behind the head", "Lock out overhead"],
  },
  {
    id: "lateral-raise",
    name: "Dumbbell lateral raise",
    muscleGroups: ["shoulders"],
    category: "accessory",
    equipment: "dumbbell",
    defaultCues: ["Lead with the elbows", "Slight forward lean", "No shrugging"],
  },

  // ── Legs — accessory/isolation ──────────────────────────────────────────────
  {
    id: "leg-curl",
    name: "Seated leg curl",
    muscleGroups: ["hamstrings"],
    category: "accessory",
    equipment: "machine",
    defaultCues: ["Full range", "Squeeze at the bottom", "Slow return"],
  },
  {
    id: "leg-extension",
    name: "Leg extension",
    muscleGroups: ["quads"],
    category: "accessory",
    equipment: "machine",
    defaultCues: ["Pause at the top", "Control the negative", "Toes neutral"],
  },
  {
    id: "calf-raise",
    name: "Standing calf raise",
    muscleGroups: ["calves"],
    category: "accessory",
    equipment: "machine",
    defaultCues: ["Full stretch at the bottom", "Pause at the top", "No bouncing"],
  },

  // ── Core (stable trackable core work) ───────────────────────────────────────
  {
    id: "pallof-press",
    name: "Anti-rotation core hold",
    muscleGroups: ["core"],
    category: "core",
    equipment: "cable",
    defaultCues: ["Resist the rotation", "Ribs down", "Breathe behind the brace"],
  },
  {
    id: "plank",
    name: "Plank",
    muscleGroups: ["core"],
    category: "core",
    equipment: "bodyweight",
    defaultCues: ["Straight line head to heels", "Squeeze glutes", "Don't let the hips sag"],
  },
  {
    id: "hanging-leg-raise",
    name: "Hanging leg raise",
    muscleGroups: ["core"],
    category: "core",
    equipment: "bodyweight",
    defaultCues: ["Control the swing", "Curl the pelvis up", "Lower slowly"],
  },

  // ── Correctives — rotated pool for anterior pelvic tilt (apt) ────────────────
  {
    id: "dead-bug",
    name: "Dead bug",
    muscleGroups: ["core"],
    category: "mobility",
    equipment: "bodyweight",
    correctiveGoal: "apt",
    defaultCues: ["Low back pressed to the floor", "Slow opposite arm/leg", "Exhale on the reach"],
  },
  {
    id: "glute-bridge",
    name: "Glute bridge",
    muscleGroups: ["glutes", "core"],
    category: "mobility",
    equipment: "bodyweight",
    correctiveGoal: "apt",
    defaultCues: ["Posterior tilt first", "Drive through the heels", "Squeeze at the top"],
  },
  {
    id: "hip-lift-90-90",
    name: "90/90 hip lift",
    muscleGroups: ["glutes", "core"],
    category: "mobility",
    equipment: "bodyweight",
    correctiveGoal: "apt",
    defaultCues: ["Reach the tailbone up", "Ribs down to the pelvis", "Feel the hamstrings"],
  },
  {
    id: "hip-flexor-stretch",
    name: "Half-kneeling hip flexor stretch",
    muscleGroups: ["hip-flexors"],
    category: "mobility",
    equipment: "bodyweight",
    correctiveGoal: "apt",
    defaultCues: ["Tuck the pelvis under", "Squeeze the back glute", "Tall through the torso"],
  },
];

// The single seeded standing exclusion at launch (PRD §6.1, §11.2).
export const SEED_EXCLUSION = {
  exerciseId: "chest-supported-row",
  exerciseName: "Chest-supported row machine",
  reason: "Ergonomic fit — doesn't suit my height/build",
};
