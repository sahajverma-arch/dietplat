-- Adds the recipe engine's "Consistency" signal (Liquid | Solid, from the
-- source CSV's own Consistency column), used by
-- recipe-plausibility-validate.ts to stop a liquid dish (soup/tea/shake)
-- from anchoring lunch or dinner. Nullable — blank/unrecognized source
-- values map to null at ingestion (recipe-consistency-normalize.ts), never
-- thrown on, since this is a soft plausibility signal, not a value the
-- platform's arithmetic depends on. Backfilled by re-running
-- `npm run seed:recipes` after this migration.
alter table public.recipes add column if not exists consistency text;
