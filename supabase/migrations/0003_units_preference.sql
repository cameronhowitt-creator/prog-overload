-- Units preference (PRD §6.6 units step). Apply after 0002_profiles_and_onboarding.
--
-- Nullable with NO default: the user must actively choose imperial or metric as the
-- first onboarding step. Storage stays canonical metric (weight_kg / height_cm and
-- logged_sets.weight in kg); this only governs input/display conversion.

alter table profiles add column if not exists units_preference text
  check (units_preference in ('imperial', 'metric'));
