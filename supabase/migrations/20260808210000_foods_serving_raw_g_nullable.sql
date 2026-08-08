-- Table 4.1 defines fruit's raw amount as variable ("null" in the source
-- table) — each fruit food's own serving_raw_g may legitimately be unknown
-- while household_measure still carries the real-world portion (e.g. "1
-- medium"). Drop the NOT NULL that assumed every food has a fixed gram
-- weight.
alter table public.foods alter column serving_raw_g drop not null;
