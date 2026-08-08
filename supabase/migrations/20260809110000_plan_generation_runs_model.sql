-- LEANR Prompt 9 hardening #3: /settings/generation-log needs to show which
-- model each attempt used. plan_generation_runs only ever logs real LLM
-- attempts (the deterministic fallback itself isn't a "run"), so every
-- attempt has a well-defined model — but nothing captured it until now.

alter table public.plan_generation_runs add column if not exists model text;
