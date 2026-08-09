-- LEANR: additive tag dimension on the EXISTING foods table — foods
-- remains the single source of truth (nothing here replaces or duplicates
-- it). Nullable: most foods (generic sides, fruit, fat) never need a dish
-- family at all; only foods that serve as an archetype component do.

alter table public.foods
  add column if not exists dish_family_id uuid references public.dish_families (id);

create index if not exists foods_dish_family_id_idx on public.foods (dish_family_id);

-- Integrity guardrail: a food can only join a dish_family whose declared
-- exchange_type matches its own. Catches a whole class of curation
-- mistakes (e.g. assigning a "fat"-exchange family to a food that's
-- actually pulse) at write time instead of surfacing as a confusing
-- eligibility gap during plan generation.
create or replace function public.enforce_dish_family_exchange_match()
returns trigger
language plpgsql
as $$
declare
  family_exchange_type text;
begin
  if new.dish_family_id is null then
    return new;
  end if;

  select exchange_type into family_exchange_type
  from public.dish_families
  where id = new.dish_family_id;

  if family_exchange_type is distinct from new.exchange_type then
    raise exception 'food % is exchange type %, cannot join dish_family % (exchange type %)',
      new.id, new.exchange_type, new.dish_family_id, family_exchange_type;
  end if;

  return new;
end;
$$;

drop trigger if exists foods_dish_family_exchange_check on public.foods;
create trigger foods_dish_family_exchange_check
  before insert or update on public.foods
  for each row execute function public.enforce_dish_family_exchange_match();
