-- Adds a natural serving-unit display ("2 rotis", "1 cup") for the recipe
-- engine, replacing the raw gram figure a real dietitian correctly flagged
-- as unrealistic to plate against ("Roti 105 g"). Derived at ingestion from
-- `Quantity per serving` + `Wt.of Measured Amt.` (recipe-unit-label.ts) —
-- null for genuinely gram-measured recipes (real weight-based portions like
-- grilled chicken), where a gram figure is already the honest display.

alter table public.recipes
  add column unit_label text,
  add column per_unit_grams numeric;
