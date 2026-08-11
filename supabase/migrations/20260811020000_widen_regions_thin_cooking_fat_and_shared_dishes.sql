-- LEANR: "wide research on gujarati diet plan and meals... for all seven
-- regions" — a research pass across all 8 regions, each checked against
-- real regional home-cooking, found this exact same shape of gap in 4
-- separate places: a cooking-fat food that's already correctly modeled and
-- macro-verified in the database, but tagged to only 1-2 regions when it's
-- genuinely also the everyday cooking oil in another region we serve. This
-- is the SAME root cause that caused "the same fat at both lunch and
-- dinner every day" for gujarati (see 20260810990000 and the conversation
-- around it) — those 4 regions each had exactly ONE cooking-fat food
-- system-wide, so no same-day exclusion logic could ever help. Fixed here
-- at the source: widen each food's regions[], not duplicate it — the same
-- technique already used throughout this project's food data (Ghee/Bajra
-- bhakri/Mustard oil/Groundnut oil/Brinjal/Drumstick per
-- table41_foods.json's own _source note, and Kala chana/Grated coconut/
-- Muri/Khakhra's meal_slots widenings in later migrations).
--
-- Groundnut oil -> gujarati: Gujarat is one of India's largest
-- groundnut-producing states (Saurashtra especially); groundnut oil is the
-- traditional daily cooking oil there, more so than Sesame oil (which
-- research confirms is real but more occasion/Uttarayan-specific).
-- Groundnut oil -> bengali: real Bengali households keep a second, neutral
-- everyday oil alongside mustard oil (reserved for fish/greens/specific
-- preparations) — groundnut oil is the best-sourced candidate for that
-- second oil.
-- Mustard oil -> rajasthani: well-documented in everyday Rajasthani/Marwari
-- cooking, both for pickles (Kair Sangri achar) and for tempering/cooking
-- curries.
-- Sesame oil -> hyderabadi: "Nuvvula Nune" is a foundational Telugu-cuisine
-- cooking fat across Andhra and Telangana — and this food already exists
-- in our data, it was just never linked to this region.
--
-- Bhindi -> punjabi: Bhindi (okra) is already seeded and macro-verified,
-- tagged north_indian, but missing punjabi — unlike its siblings Lauki/
-- Tinda/Tori/Methi, which all already carry both regions. Bhindi Masala/
-- Bhindi Fry is an extremely common everyday Punjabi vegetable dish;
-- research read this as a tagging oversight, not a deliberate exclusion.
--
-- Chicken curry / Egg curry / Egg bhurji / Tandoori chicken / Tandoori
-- fish -> north_indian: these were seeded punjabi-only, but checked
-- against the actual dish content (onion-tomato gravy chicken curry, egg
-- curry, egg bhurji, tandoori-style grilling) — these are the same
-- everyday preparations a Delhi/UP/Haryana household calls by the same
-- names, not a Punjab-exclusive style. Widening is more honest than
-- inventing parallel, differently-named north_indian dishes that don't
-- culinarily exist as a separate thing — the same reasoning already
-- applied to Lauki/Tinda/Methi/Ghee/Mustard oil, which already span both
-- regions in this data.

update public.foods set regions = array_append(regions, 'gujarati')
  where name_en = 'Groundnut oil' and not (regions @> array['gujarati']);

update public.foods set regions = array_append(regions, 'bengali')
  where name_en = 'Groundnut oil' and not (regions @> array['bengali']);

update public.foods set regions = array_append(regions, 'rajasthani')
  where name_en = 'Mustard oil' and not (regions @> array['rajasthani']);

update public.foods set regions = array_append(regions, 'hyderabadi')
  where name_en = 'Sesame oil' and not (regions @> array['hyderabadi']);

update public.foods set regions = array_append(regions, 'punjabi')
  where name_en = 'Bhindi' and not (regions @> array['punjabi']);

update public.foods set regions = array_append(regions, 'north_indian')
  where name_en in ('Chicken curry', 'Egg curry', 'Egg bhurji', 'Tandoori chicken', 'Tandoori fish')
    and not (regions @> array['north_indian']);
