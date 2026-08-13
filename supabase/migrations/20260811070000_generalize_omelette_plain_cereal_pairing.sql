-- LEANR: generalize the Omelette-pairs-with-plain-cereal rule
-- (20260811060000) beyond north_indian.
--
-- That migration matched the cereal side by literal food name ("Paratha")
-- rather than a tag, reasoning that only one plain-Paratha food existed in
-- this dataset. That broke the moment a real Rajasthani non-vegetarian
-- plan was generated and inspected: Rajasthani's breakfast cereal pool has
-- no food named "Paratha" at all (Bajra bhakri and Pyaaz Kachori instead),
-- so the name-match filter always came up empty there and silently fell
-- through to the fully unrestricted cereal pool. An Omelette day and a
-- Bajra bhakri day only APPEARED correlated in that generated plan by
-- coincidence — both the meat pool (Egg/Omelette) and the cereal pool
-- (Pyaaz Kachori/Bajra bhakri) happened to have exactly 2 members and use
-- the same day-indexed rotation formula in food-selector-fallback.ts, not
-- because the pairing rule was actually doing anything for this region.
--
-- Fixed by introducing a second tag, `omelette_pairing_cereal`, applied
-- explicitly per region to whichever food is that region's plain/unstuffed
-- cereal choice, and switching food-selector-fallback.ts's cereal branch
-- to match on this tag instead of the food name. Deliberately an
-- INCLUSION tag naming the correct food, not an EXCLUSION tag on the
-- stuffed/fried ones (Aloo/Gobi/Methi/Paneer/Mooli Paratha, Pyaaz Kachori)
-- — an exclusion approach would have also let Dalia or Oats win the
-- rotation for a north_indian Omelette day (both breakfast-eligible there,
-- neither stuffed), contradicting the dietitian's specific "plain Paratha,
-- not ... Oats" instruction from the original directive.
--
-- Paratha (north_indian) is tagged here for the first time — it was
-- previously matched by name only, so this migration is what actually
-- makes 20260811060000's rule keep working for north_indian, not just a
-- no-op. Bajra bhakri (rajasthani) is newly added: it's already the
-- everyday unstuffed flatbread there (tagged high_fibre/requires_cooking,
-- no stuffed variant in this data), unlike Pyaaz Kachori, which is a
-- deep-fried stuffed pastry — the same category of dish the original
-- directive was written to avoid pairing with egg.
--
-- No other region gets this tag in this migration. Punjabi's breakfast
-- cereal pool is Poha / Corn flakes / Oats / four stuffed parathas
-- (Paneer, Aloo, Gobi, Methi, Mooli) with no plain-Paratha-equivalent food
-- at all in this data; gujarati/bengali/south_indian/hyderabadi/
-- maharashtrian haven't been reviewed for one either. Fabricating a "plain
-- cereal" designation for any of them without dietitian confirmation would
-- be worse than leaving the gap — food-selector-fallback.ts's graceful
-- degrade (falls back to the unrestricted cereal pool when no food carries
-- this tag) already handles that honestly, same pattern as every other
-- same-slot pairing rule in this file.

update public.foods set tags = array_append(tags, 'omelette_pairing_cereal')
  where name_en = 'Paratha' and not ('omelette_pairing_cereal' = any(tags));

update public.foods set tags = array_append(tags, 'omelette_pairing_cereal')
  where name_en = 'Bajra bhakri' and not ('omelette_pairing_cereal' = any(tags));
