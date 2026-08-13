-- LEANR: dietitian/user feedback on a real generated Rajasthani plan —
-- lunch only ever showed "Rajma curry" or "Gatte sabzi", every single
-- week, no other pulse option.
--
-- Root cause: rajasthani has exactly two active lunch archetypes,
-- rajasthani_rajma_chawal_meal and rajasthani_gatte_rice_meal, and each
-- narrows its `pulse` role to a single dish family (rajma, gatte
-- respectively). The Meal Archetype layer's weekly dish-family union
-- (route.ts) is built only from these two archetypes' declared families,
-- so lunch's pulse pool is capped at exactly {rajma, gatte} every week,
-- regardless of which combination gets picked which day — even though
-- the `foods` table already has 5 more generic pulses eligible at lunch
-- for this region (Chana dal, Toor dal, Masoor dal, Moong dal, Kala
-- chana, all `regions: ['generic']`), none of them ever pass the
-- narrowing filter.
--
-- Exact same shape as the Omelette/plain-Paratha and Oats/Ghee bugs
-- already fixed this session — a food can be fully eligible by every
-- other check (region, diet type, season, meal slot) and still never
-- appear because no archetype actually assigned that week declared its
-- dish family. Same fix pattern too: widen the `pulse` role's
-- dish_family_ids array (a SET per role for exactly this reason). Direct
-- precedent already exists in this exact dataset —
-- north_indian_roti_dal_meal's own dal_curry role already accepts 4 dal
-- families (chana_dal, masoor_dal, moong_dal, toor_dal), not 1.
--
-- Widened rajasthani_rajma_chawal_meal specifically (not
-- rajasthani_gatte_rice_meal): Gatte ki Sabzi is Rajasthan's own uniquely
-- named specialty dish (steamed gram-flour dumplings in a yogurt curry),
-- not a generic legume preparation — diluting its own archetype with
-- unrelated dals would be the same "don't dilute a real named dish"
-- mistake already rejected once this session for vegetable dish naming
-- and for Oats. Rajma Chawal Meal, by contrast, is already the generic
-- "rice + legume" lunch archetype; extending it to the other everyday
-- dals is a natural fit, not a fabricated claim — these dals are already
-- tagged `generic`, meaning they're presumed acceptable in every region's
-- rotation, not a region-specific claim being invented here.
--
-- Sprouts (also lunch-eligible, `generic`) is NOT included: it has no
-- dish_family_id in this dataset at all, and eligible-foods.ts's narrowing
-- filter (`f.dishFamilyId !== null && dishFamilyIds.includes(...)`)
-- unconditionally excludes any food with a null family the moment ANY
-- narrowing constraint exists for that (slot, exchangeType) — giving it a
-- family is a separate, unrelated fix, out of scope here.

update public.archetype_components
set dish_family_ids = dish_family_ids
  || array(
    select df.id from public.dish_families df
    where df.code in ('chana_dal', 'masoor_dal', 'moong_dal', 'toor_dal', 'kadala_curry')
      and not (df.id = any(archetype_components.dish_family_ids))
  )
where exchange_type = 'pulse'
  and archetype_id = (select id from public.meal_archetypes where code = 'rajasthani_rajma_chawal_meal');
