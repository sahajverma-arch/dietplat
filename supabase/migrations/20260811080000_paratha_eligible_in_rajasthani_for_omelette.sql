-- LEANR: correction to 20260811070000 — a direct, repeated user
-- instruction clarified that "with Omelette always add plain Paratha"
-- means literally the food Paratha, every time, not a per-region
-- "designated plain cereal" substitute. 20260811070000's Bajra-bhakri-for-
-- rajasthani generalization was a reasonable-looking but wrong guess at
-- intent; reverted here.
--
-- The real reason plain Paratha never appeared in a generated Rajasthani
-- plan has nothing to do with the pairing rule itself — it's that Paratha
-- was never ELIGIBLE for rajasthani at all, on two independent layers:
--
-- 1. `foods.regions` for Paratha is `{north_indian}` only — the per-food
--    eligibility filter in eligible-foods.ts rejects it for any other
--    region before the pairing rule ever runs.
-- 2. Even with #1 fixed, rajasthani has its own two breakfast archetypes
--    (rajasthani_bajra_bhakri_meal, rajasthani_pyaaz_kachori_meal), and
--    NEITHER declares the `plain_paratha` dish family in its cereal role.
--    The Meal Archetype layer's weekly dish-family union (route.ts) would
--    still narrow rajasthani's breakfast cereal pool to {bhakri,
--    pyaaz_kachori} only, excluding Paratha regardless of #1 — the exact
--    same class of bug already fixed once for north_indian's own
--    archetypes in 20260811060000, just never carried over to rajasthani.
--
-- Fixed both, mirroring the north_indian fix exactly: widen Paratha's
-- `regions` to add rajasthani, and widen both rajasthani breakfast
-- archetypes' cereal-role dish_family_ids to also accept plain_paratha
-- (dish_family_ids is a SET per role specifically to allow this — see
-- Roti Dal Meal's own dal_curry role accepting 4 dal families). Widened
-- BOTH archetypes rather than just one, on the same reasoning as
-- 20260811060000: relying on only one archetype being selected some
-- particular week is exactly the kind of coincidence-dependent behavior
-- that caused this whole investigation in the first place.
--
-- Once eligible, Paratha also becomes a normal (non-Omelette-gated)
-- rotation option for rajasthani breakfast, same as it already was for
-- north_indian — the pairing rule only ever FORCES Paratha when Omelette
-- is present, it never excludes Paratha the rest of the time. This is the
-- same one-directional behavior already accepted for north_indian, not a
-- new side effect introduced here.
--
-- omelette_pairing_cereal stays a real tag (still on Paratha only, now the
-- ONLY food carrying it — see the revert below), rather than being
-- collapsed back to a hardcoded name match: a tag is still the right
-- mechanism even though the intended meaning turned out to be "the literal
-- food Paratha, in whichever regions it's eligible" rather than "each
-- region's own plain analog".

update public.foods set regions = array_append(regions, 'rajasthani')
  where name_en = 'Paratha' and not ('rajasthani' = any(regions));

update public.foods set tags = array_remove(tags, 'omelette_pairing_cereal')
  where name_en = 'Bajra bhakri';

update public.archetype_components
set dish_family_ids = array_append(dish_family_ids, (select id from public.dish_families where code = 'plain_paratha'))
where exchange_type = 'cereal'
  and archetype_id in (
    select id from public.meal_archetypes where code in (
      'rajasthani_bajra_bhakri_meal',
      'rajasthani_pyaaz_kachori_meal'
    )
  )
  and not (dish_family_ids @> array[(select id from public.dish_families where code = 'plain_paratha')]);
