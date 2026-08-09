-- LEANR: fixes a real modelling mistake in
-- 20260810200000_south_indian_breakfast_archetype_pilot.sql, caught by
-- live end-to-end verification, not left in place — no region's
-- breakfast meal_templates row has ever allocated a pulse exchange
-- (allowed_exchange_types is 'cereal','milk_cow','milk_skim','meat',
-- 'fruit','fat','sugar' for every region, unchanged since
-- 20260808200000_classic_table41_exchange_system.sql). The pilot's
-- "lentil_curry" pulse components on the 3 breakfast archetypes were
-- therefore structurally unreachable: the solver never allocates a pulse
-- exchange to breakfast, so distributeMeals() never puts a pulse entry in
-- the breakfast skeleton, so eligibleFoodsForSkeleton() never even builds
-- a breakfast.pulse bucket, so the component's dish_family_ids narrowed
-- nothing and could never be satisfied — checkArchetypeAdherence() would
-- have permanently reported "partial" for these archetypes no matter what
-- was actually selected, a false quality signal.
--
-- Fixing forward per this project's forward-only migration convention,
-- not editing the already-applied file. The dish_families rows
-- ('sambar', 'kadala_curry') are left in place — they're still valid,
-- reusable reference data for a future lunch/dinner archetype where pulse
-- genuinely is exchange-represented (e.g. Sambar Rice at lunch).

delete from public.archetype_components
where component_role = 'lentil_curry'
  and archetype_id in (
    select id from public.meal_archetypes
    where code in ('south_indian_idli_sambar', 'south_indian_dosa_sambar', 'south_indian_puttu_kadala')
  );

update public.meal_archetypes set notes =
  'The single most iconic South Indian breakfast pairing. Sambar is the real-world accompaniment this ' ||
  'name refers to, but breakfast''s meal_templates row does not allocate a pulse exchange in this system ' ||
  '(no region''s does), so only the cereal (required) and coconut fat (optional) components are actually ' ||
  'exchange-represented here — narrowing correctly still excludes Corn Flakes/Chapati/Roti from the ' ||
  'breakfast cereal slot, which is this archetype''s real, working effect.'
where code = 'south_indian_idli_sambar';

update public.meal_archetypes set notes =
  'As common as Idli-Sambar in real households; shares the same cereal-narrowing rationale. Sambar is the ' ||
  'real-world accompaniment, not an exchange-represented component — see south_indian_idli_sambar''s notes.'
where code = 'south_indian_dosa_sambar';

update public.meal_archetypes set notes =
  'Classic Kerala breakfast pairing. Kadala (black chickpea) curry is the real-world accompaniment; only ' ||
  'the cereal component is exchange-represented — see south_indian_idli_sambar''s notes for why.'
where code = 'south_indian_puttu_kadala';
