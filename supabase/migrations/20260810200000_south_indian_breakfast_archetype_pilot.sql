-- LEANR: pilot Meal Archetype data — South Indian breakfast. First real
-- data for the layer added in 20260810100000_meal_archetypes.sql, per the
-- design doc's rollout plan (pilot: one region, one slot, 4-6 archetypes).
--
-- Idli-Sambar and Dosa-Sambar are fully buildable from existing food data
-- with no changes beyond dish_family tagging — both foods and Sambar were
-- already correctly region/slot-tagged. Puttu-Kadala needs Kala chana's
-- meal_slots widened to include breakfast: Puttu with kadala (black
-- chickpea) curry is a genuine, iconic Kerala breakfast, and Kala chana
-- was only ever seeded for lunch/dinner — an omission being corrected, not
-- a new claim. Grated coconut's meal_slots is widened the same way — it's
-- the natural chutney-style breakfast condiment for Idli/Dosa, matching
-- the "widen rather than duplicate" technique already used elsewhere in
-- this food data (see table41_foods.json's _source note on Ghee/Bajra
-- bhakri). Appam-Stew is deliberately deferred: no existing south_indian
-- vegetable is genuinely a stew component without a bigger, more careful
-- data decision than this pilot warrants — forcing one would repeat
-- exactly the kind of unverified substitution this whole layer exists to
-- prevent.

update public.foods set meal_slots = array_append(meal_slots, 'breakfast')
  where name_en = 'Kala chana' and not (meal_slots @> array['breakfast']);

update public.foods set meal_slots = array_append(meal_slots, 'breakfast')
  where name_en = 'Grated coconut' and not (meal_slots @> array['breakfast']);

insert into public.dish_families (code, name, exchange_type, notes) values
  ('idli', 'Idli', 'cereal', 'Steamed fermented rice-urad batter cakes.'),
  ('dosa', 'Dosa', 'cereal', 'Fermented rice-urad batter crepe.'),
  ('puttu', 'Puttu', 'cereal', 'Steamed rice-flour and coconut cylinders.'),
  ('sambar', 'Sambar', 'pulse', 'Toor dal, tamarind and vegetable curry — pairs with idli, dosa and rice alike.'),
  ('kadala_curry', 'Kadala curry', 'pulse', 'Black chickpea (kadala) curry — the traditional accompaniment to Puttu.'),
  ('coconut_condiment', 'Coconut condiment', 'fat', 'Coconut oil or grated coconut used as the breakfast fat/condiment share.')
on conflict (code) do nothing;

update public.foods set dish_family_id = (select id from public.dish_families where code = 'idli') where name_en = 'Idli';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'dosa') where name_en = 'Dosa';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'puttu') where name_en = 'Puttu';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'sambar') where name_en = 'Sambar';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'kadala_curry') where name_en = 'Kala chana';
update public.foods set dish_family_id = (select id from public.dish_families where code = 'coconut_condiment') where name_en in ('Coconut oil', 'Grated coconut');

-- Diet types on each archetype are the intersection of its REQUIRED
-- components' own diet_types (Sambar is not jain-eligible, so neither
-- Idli-Sambar nor Dosa-Sambar are; Puttu and Kala chana both are, so
-- Puttu-Kadala is) — an archetype should never claim eligibility for a
-- diet type its own required foods can't actually serve.
insert into public.meal_archetypes (code, name, region, slot, diet_types, authenticity_score, notes) values
  ('south_indian_idli_sambar', 'Idli with Sambar', 'south_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 1.0,
    'The single most iconic South Indian breakfast pairing.'),
  ('south_indian_dosa_sambar', 'Dosa with Sambar', 'south_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan'], 0.85,
    'As common as Idli-Sambar in real households; shares the same sambar dish family.'),
  ('south_indian_puttu_kadala', 'Puttu with Kadala Curry', 'south_indian', 'breakfast',
    array['vegetarian','eggetarian','non_vegetarian','vegan','jain'], 0.75,
    'Classic Kerala breakfast pairing — kadala (black chickpea) curry alongside steamed Puttu.')
on conflict (code) do nothing;

insert into public.archetype_components (archetype_id, component_role, dish_family_ids, exchange_type, component_order, is_required)
select id, 'steamed_batter_cereal', array[(select id from public.dish_families where code = 'idli')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_idli_sambar'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'sambar')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_idli_sambar'
union all
select id, 'condiment_fat', array[(select id from public.dish_families where code = 'coconut_condiment')], 'fat', 3, false
from public.meal_archetypes where code = 'south_indian_idli_sambar'
union all
select id, 'fermented_crepe_cereal', array[(select id from public.dish_families where code = 'dosa')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_dosa_sambar'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'sambar')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_dosa_sambar'
union all
select id, 'condiment_fat', array[(select id from public.dish_families where code = 'coconut_condiment')], 'fat', 3, false
from public.meal_archetypes where code = 'south_indian_dosa_sambar'
union all
select id, 'steamed_cereal', array[(select id from public.dish_families where code = 'puttu')], 'cereal', 1, true
from public.meal_archetypes where code = 'south_indian_puttu_kadala'
union all
select id, 'lentil_curry', array[(select id from public.dish_families where code = 'kadala_curry')], 'pulse', 2, true
from public.meal_archetypes where code = 'south_indian_puttu_kadala'
on conflict (archetype_id, component_role) do nothing;
