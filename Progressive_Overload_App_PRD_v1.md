# Progressive Overload Workout App — Product Requirements Document (v1 Draft)

**Status:** Draft for prototype scoping
**Owner:** Cameron / Emma
**Source material:** Emma & Cameron transcript (product ideation conversation), Emma_Trainerize_Workout_Knowledge.md, Progressive_Overload_Training_AI_Resource.pdf, DESIGN-apple.md (UI design system)

---

## 1. Vision

Replace Emma's current CustomGPT-based workout planner and Trainerize with a single, purpose-built mobile web app that plans progressive-overload strength training programs, remembers Emma's constraints and history *reliably*, and is used live, on her phone, during workouts to log sets and guide the session. Built for Emma first, with the data model and architecture kept clean enough to support other users later (this may become a small shared product).

## 2. Problem Statement

Emma's current CustomGPT-based system has three recurring failure modes, all rooted in the same underlying issue — it has no durable memory, only a recycling working context:

- **Forgotten constraints:** One-off corrections (e.g., "no chest-supported row — doesn't fit my height/build") don't persist; she has to re-correct the same issue in later sessions.
- **Stale context stickiness:** Temporary situational changes (e.g., "I'm at a hotel gym this Wednesday") get treated as permanent, so the planner keeps programming for the hotel setup after she's back at her normal gym — the opposite failure of the first problem.
- **No real use of logged history:** Even though her recent workout data exists, the planner doesn't reliably reference it, so it prompts generic guidance ("pick a weight that feels like X") instead of using what she actually lifted last time.

This app's core value proposition is fixing this: **persistent, structured memory of constraints, equipment context, and logged performance, actually used to drive next-session programming.**

## 3. Goals (V1)

1. Give Emma one place to (a) get an AI-generated, progressive-overload-aware workout for the day, (b) log it live during the session, and (c) see history/PRs.
2. Make constraint and preference corrections **stick** permanently until explicitly changed.
3. Make the AI **show its work** — briefly explain why it chose a given weight/rep target based on prior performance.
4. Keep sessions to a fixed default of **60 minutes end to end**, inclusive of warm-up and all lifts.
5. Lay a data foundation (user-scoped schema) that doesn't need to be rebuilt if this becomes multi-user later.
6. Give Emma a way to swap out any prescribed exercise mid-workout — for machine/space availability or ad-hoc preference — using a structured exercise library, without having to leave the workout flow or re-ask the AI from scratch.

## 4. Non-Goals (V1 — explicitly deferred to Phase 2+)

- YouTube demo-video link-out per exercise
- In-app rest timers (Emma currently uses her watch; app-recommended rest duration is a nice-to-have, not core)
- Calendar integration for auto-detecting travel/hotel gym context
- Video/media embedding of any kind

These are captured in Section 9 (Backlog) so they aren't lost, but are out of scope for the first working prototype.

## 5. Target User & Use Context

- **Primary user (v1):** Emma. Experienced lifter, trains ~4–5x/week. Sessions are programmed to a fixed 60-minute default, end to end, including a 7–10 min dynamic warm-up and load ramp-up on primary lifts.
- **Use context:** Live, in-gym, on an iPhone, mid-workout. Interface must be usable one-handed, glanceable, with minimal typing — she needs to log weight/reps between sets quickly, not fill out forms.
- **Secondary consideration:** Data model should be user-scoped (not hardcoded to a single global user) so additional users can be onboarded later without a schema rewrite.

## 6. Core V1 Feature Requirements

### 6.1 Persistent User Profile & Constraints
- Editable profile storing: available workout time (default ~60–65 min), primary training goals, equipment/gym context (default = normal fully-equipped gym), and a durable list of **exercise exclusions/substitution rules** with the reason (e.g., "no chest-supported row — ergonomic fit").
- Exclusions and corrections made by Emma must persist indefinitely until she changes them — this is a hard requirement given it's the #1 stated failure of the current system.
- Exclusions can be added **in-flow**, at the moment a workout is generated (e.g., an "exclude this / don't program this again" action directly on a proposed exercise), not only through a separate settings screen — the action writes immediately to the persistent exclusion list. Seed exclusion at launch: no chest-supported row machine (ergonomic fit).
- Location/equipment context (e.g., "hotel gym this week") must be settable as a **temporary, dated override** that automatically expires/reverts rather than persisting indefinitely (the inverse problem from exclusions — this one should *not* stick by default).

### 6.2 AI-Generated Program (Claude API)
- Each session's workout is generated by a live Claude API call, not a static template.
- The prompt/context sent to Claude includes: current profile & active constraints, any active temporary location override, recent logged history (see 6.4), and the seeded programming knowledge base (see Section 7).
- Program structure follows the observed pattern from Emma's historical data: 1 primary compound lift → 2–4 secondary compound/accessory movements → accessory/isolation + core/corrective work, sized to fit within the fixed 60-minute session (warm-up + all lifts).
- Rep-range/rest logic should default to the heuristics derived from her historical Trainerize data (see Section 7) unless her profile specifies otherwise.
- **Reasoning transparency:** for each prescribed weight/rep target, the app shows a short, plain-language rationale referencing her last logged performance on that lift (e.g., "Last time: 3x8 @ 115 lb, all reps clean → suggesting 120 lb today").
- **Last-time & PR context (always visible, not just on request):** every lift in the program displays, alongside the prescription, (a) the weight/reps she logged **last time** she did that lift, and (b) her current **PR** for the relevant rep-range bucket (weight, rep range, and date achieved). This is separate from and in addition to the reasoning rationale above — it's persistent reference context Emma can glance at mid-set, not just an explanation of the AI's choice.
- **Cues:** each lift in the program includes two to three short, persistent form cues for Emma to focus on, chosen to (a) reduce injury risk and (b) support the intended muscle growth/target of that lift (e.g., trap bar deadlift → "push the ground away," "brace before the pull," "chest up through lockout"). Cues should be stable across sessions for a given lift/goal rather than regenerated randomly each time, but editable by Emma.
- **Corrective/core work variety:** the app should rotate corrective exercises addressing a standing goal (e.g., anterior pelvic tilt work) from a small pool rather than repeating the same one every session, to avoid staleness, while keeping designated "core" lifts (squat, bench, pull-ups, etc.) stable over time for trackable progression.

### 6.3 Live Workout Logging (Trainerize replacement)
- Once a program is generated, Emma logs actual weight/reps per set during the workout, replacing Trainerize entirely as the system of record.
- Logging UI optimized for speed/one-handed mobile use between sets (not a full form per set).
- Logged data becomes the history that feeds 6.2 and 6.4.

### 6.4 History & PR Tracking
- Per-exercise history view: selectable lift → chart of logged weight/reps over time.
- Each PR record stores, per lift and per rep-range bucket (e.g., 1–5, 6–10, 11–15): **date achieved**, **weight**, and **rep range**. A new logged set only overwrites the existing PR for its bucket if it beats it; older PRs are retained as history, not just overwritten silently.
- This history is what the AI program generator (6.2) must reference — the whole point is eliminating the "choose a weight that feels like this" generic fallback Emma currently experiences.

### 6.5 Exercise Library & Mid-Workout Swap
- The app maintains a structured **exercise library**, organized by muscle group/movement pattern and by category: strength lifts (primary/secondary/accessory, per the taxonomy in Section 7), core work, and mobility work.
- Each library entry tags: target muscle group(s), movement category (primary/secondary/accessory/core/mobility), and equipment required — this equipment tag is what enables swap suggestions to respect current gym/machine availability.
- **During an active workout**, any prescribed exercise can be swapped for an alternative from the library that targets the same muscle group/movement pattern, without leaving the workout screen or triggering a new AI generation call. Swap reasons include: machine/equipment unavailable, space constraints, or simple day-of preference — no justification required from Emma.
- Swap suggestions default to 2–3 relevant alternatives; Emma can also browse the full filtered library rather than being limited to the suggested set.
- A swap performed mid-workout applies **only to that session** by default — it does not silently become a new standing exclusion. Immediately after confirming a swap, the app asks Emma whether the original exercise should be **excluded going forward**; if she says yes, she's prompted for a short reason, and both the exclusion and the reason are written to the persistent exclusion list from Section 6.1. If she declines, the swap stays session-only and the original exercise can appear again in future programs.
- This keeps the swap feature separate from, and non-conflicting with, the persistent-constraints requirement in Section 6.1 — swap is the trigger point, but the exclusion itself always lives in the profile's exclusion list, with a reason attached, consistent with how the chest-supported-row exclusion is recorded.
- The library is seeded initially from Emma's own historical movement catalog (Section 7) and expanded with additional muscle-group/mobility coverage as needed to ensure every primary/secondary lift has at least 2–3 valid same-pattern alternatives.

## 7. Seed Programming Knowledge Base

The AI's context should be seeded from the patterns already extracted from Emma's Trainerize history (37 analyzed sessions), rather than starting from generic training knowledge alone:

- **Rep-phase heuristic:**
  - Endurance phase: prescribed max reps ≥ 13
  - Hypertrophy/mid-rep phase: max reps 8–12
  - Strength phase: max reps ≤ 6, and/or explicit "to failure"
- **Rest defaults (per Emma's stated mental model, overriding logged Trainerize values):** **2–3 minutes** for primary and secondary compound lifts; **90 seconds–2 minutes** for accessory/isolation work. The historical Trainerize logs show shorter rest (mostly 30–60s), but that reflects app/session logging behavior rather than Emma's intended target — the seed knowledge base uses her stated preference, not the logged figures.
- **Session structure:** 1 primary compound → 2–4 secondary compounds/accessories → accessory/isolation + core, occasionally closing with a short circuit/finisher.
- **Movement library:** primary/secondary/accessory movement lists with typical set/rep prescriptions and logged weight ranges, as cataloged in the knowledge file, to serve as Emma's personal exercise history baseline (not a generic exercise database).
- **Data quality note:** the source data was extracted via OCR from screen recordings and contains known digit-drop errors (e.g., "135" misread as "13"). Historical weight values should be treated as directional, and the app's own logging (6.3) should become the authoritative data source going forward rather than relying on the OCR-derived history long-term.

## 8. Platform & Technical Requirements

- **Deployment target:** mobile-optimized web app (responsive/PWA-style), used directly on Emma's iPhone via the browser (added to home screen) — not a native app for v1.
- **AI:** Claude API calls for program generation; context assembled from a persistent backend store (profile, constraints, history), not from chat "working memory" that recycles — this directly addresses the root cause identified in Section 2.
- **Data architecture:** user-scoped schema from day one (even with a single real user) so multi-user support later doesn't require a rebuild.
- Specific stack/hosting choices (e.g., GitHub + Vercel, as informally discussed) are left to implementation — not a hard product requirement.

## 9. UI Design System (Locked)

The visual system is locked to the Apple-derived design language documented in **DESIGN-apple.md**. That reference was extracted from Apple's marketing/store pages, so it's a token and component *grammar* to build from — not a literal template, since this app is a live utility tool used mid-set, not a photography-led marketing site. The mapping below is how the source system applies here.

### Adopted as-is
- **Color:** single accent — Action Blue `#0066cc` (light surfaces) / Sky Link Blue `#2997ff` (dark surfaces) — for every interactive element (buttons, links, focus states, selected chips). No second accent color, ever.
- **Typography ladder:** SF Pro Display for headlines (600 weight, negative letter-spacing), SF Pro Text for body (17px/400/1.47 line-height — not 16px). Weight ladder is strictly 300/400/600; 500 is never used.
- **Radii grammar:** `rounded.sm` (8px) for compact utility elements, `rounded.lg` (18px) for cards, `rounded.pill` for anything that reads as an action (primary buttons, chips, search), nothing in between except the rare Pearl Button `rounded.md` (11px).
- **Shadow discipline:** no shadows on cards, buttons, or chrome — shadow is reserved exclusively for imagery (not heavily used in this app, since it's data/utility-first rather than photography-first).
- **Touch targets:** 44×44px minimum everywhere, critical given this is used one-handed mid-workout.
- **Press state:** `transform: scale(0.95)` as the universal active-state micro-interaction on every tappable element.
- **Dark/light alternation** as the primary way to separate sections, instead of adding borders/shadows for hierarchy.

### Adapted for this app's use case
- **`configurator-option-chip` / `-selected`** → maps directly to the **exercise swap picker** (§6.5): pill-shaped cells with a small thumbnail, exercise name, and equipment tag; selected state gets the 2px `primary-focus` border.
- **`store-utility-card`** → maps to **exercise library cards** and the **history/PR list view** (§6.4): white card, hairline border, `rounded.lg`, product-style image slot replaced with an exercise thumbnail, `body-strong` name + `body` metadata (last weight/PR) + `text-link` action.
- **`floating-sticky-bar`** → maps to the **in-workout logging bar**: persistent bottom bar (parchment, blurred background) showing the current exercise/set and a primary "Log Set" CTA, always accessible without scrolling — this is the single most important UI pattern in the app given the live-logging use case (§6.3).
- **`search-input`** → used for searching the exercise library during a swap.
- **`button-primary`** → "Log Set," "Start Workout," "Confirm Swap," and other core actions.
- **`button-icon-circular`** → in-workout icon actions (e.g., open history, open cues) where a labeled button would be too heavy.

### Explicitly not used
- Full-bleed **product tiles**, **hero marketing sections**, and the **environment-quote-card** pattern — these are marketing-page constructs with no equivalent in a utility app used mid-set. No hero photography, no edge-to-edge alternating light/dark marketing bands.
- The **frosted sub-nav** and store-specific chrome (bag icon, language selector) — not applicable outside a storefront.

### Gaps to resolve before high-fidelity design
- The source system documents no error/validation states and no dark-mode counterparts for utility cards — this app will need both defined (form validation for profile/logging inputs; a dark mode is likely desirable for gym use, given lighting conditions vary).
- Chart/graph styling (for the weight/rep history view in §6.4) isn't covered by the source system at all and will need to be designed fresh, using the locked color and typography tokens as constraints.

## 10. Phase 2+ Backlog (explicitly deferred)

- **YouTube demo link-out:** button next to each exercise that opens a YouTube search for that exercise name (no embedded media).
- **Rest timers:** in-app rest timer recommendations by lift type, with the caveat that Emma currently prefers her watch — this should be optional/dismissible, not forced.
- **Calendar/travel-aware context:** integration to detect travel (e.g., trip/vacation calendar events, or events referencing a different city) and **propose** a temporary location/equipment override for Emma to confirm — not auto-apply.
- **Profile-driven behavior heuristics:** expand the profile page with additional adaptive settings as they're identified.

## 11. Open Questions (Resolved)

1. **Rest time target — RESOLVED:** use Emma's stated mental model, not the historical Trainerize logged values. Rest defaults are now: **2–3 min for primary/secondary compound lifts, 90s–2 min for accessory/isolation work.** (Supersedes the 30/45/60s figures pulled from logged Trainerize data — see updated Section 7.)
2. **Standing exclusions — RESOLVED:** seed the initial profile with a single exclusion (no chest-supported row machine, ergonomic fit). The profile must support Emma adding further exclusions **at the point a workout is generated**, not only via a separate settings screen — i.e., an in-flow "exclude this / don't program this" action available when she's looking at a proposed workout, which writes back to the persistent exclusion list per Section 6.1.
3. **PR tracking — RESOLVED:** track by **rep-range bucket** (e.g., 1–5, 6–10, 11–15), not exact rep count, per lift.
4. **Session length — RESOLVED:** fixed default of **60 minutes, end to end**, inclusive of warm-up and all lifts (not 60–65 min as previously drafted; not editable per day for v1 unless later requested).

## 12. Success Criteria for V1 Prototype

- Emma can complete a full real workout session using only this app (no Trainerize).
- A constraint corrected once does not resurface in a later session without being re-triggered.
- A temporary equipment/location override auto-reverts without Emma having to manually undo it.
- Each prescribed weight is accompanied by a rationale referencing an actual prior logged set, not generic language.
- Every lift on screen shows last-time performance and current PR (weight, rep range, date) without Emma having to dig for it.
- Session fits within the fixed 60-minute window as planned, end to end.
- Mid-workout, Emma can swap any prescribed exercise for a same-muscle-group alternative in a couple taps, without breaking her flow or needing to re-generate the whole session.
- After confirming a swap, Emma is asked whether to exclude the original exercise going forward; if yes, the reason she gives is saved with the exclusion and the exclusion sticks in future programs without her having to repeat herself.
