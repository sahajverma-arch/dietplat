-- Adds the recipe engine's dietitian-authored pairing data, from the CSV's
-- own "Must have category" / "Good to have Category" / "Must have recipe" /
-- "Good to have recipe" columns (previously parsed by nothing — real
-- accompaniment guidance like Tomato Soup -> good-to-have Paneer Tikka/
-- Grilled Chicken/etc, or Dahi Tadka -> must-have Pulao/Khichdi/Biryani —
-- was sitting unused in the source file). Values are stored verbatim as
-- Category strings or literal recipe names, matched case-insensitively at
-- use time (recipe-pairing.ts), never resolved to an id at ingestion.
-- Backfilled by re-running `npm run seed:recipes` after this migration.
alter table public.recipes add column if not exists must_have_categories text[] not null default '{}';
alter table public.recipes add column if not exists good_to_have_categories text[] not null default '{}';
alter table public.recipes add column if not exists must_have_recipe_names text[] not null default '{}';
alter table public.recipes add column if not exists good_to_have_recipe_names text[] not null default '{}';
