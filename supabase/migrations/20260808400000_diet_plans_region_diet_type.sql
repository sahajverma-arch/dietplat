-- diet_plans never recorded which region/dietType a plan was actually
-- generated with — region has no other source at all (it's a dietitian
-- choice made at generation time, not derivable from counselling answers),
-- and dietType, though re-derivable from counselling_sessions.answers, should
-- be snapshotted like everything else under a diet plan: if the client's
-- answers are edited later, an old plan must not silently start reporting a
-- different diet type than it was actually built with.
-- Backfill: no rows exist yet in production for this table, so a NOT NULL
-- default is safe.

alter table public.diet_plans
  add column region text not null default 'north_indian',
  add column diet_type text not null default 'vegetarian';

alter table public.diet_plans
  alter column region drop default,
  alter column diet_type drop default;
