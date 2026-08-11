-- Seasonal eligibility layer (see CLAUDE.md "The exchange system" —
-- "Seasonal filter"). Adds seasons as another AND-combined eligibility
-- filter alongside region/diet_type/allergens/dislikes/medical_tags — never
-- touches exchange counts or macros, same "additive, never a second source
-- of nutrition truth" discipline as the Meal Archetype layer.
--
-- Default '{all_year}': every existing row (and every future row that never
-- gets explicitly tagged) stays eligible in every season, so this migration
-- cannot silently narrow any pool on its own — only an explicit retag
-- (see the companion data migration/seed update) can.
alter table public.foods
  add column seasons text[] not null default '{all_year}';

create index foods_seasons_gin on public.foods using gin (seasons);
