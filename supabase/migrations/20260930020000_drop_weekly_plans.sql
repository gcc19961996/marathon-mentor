-- The option A/B weekly-plan feature was replaced by the fixed plan (plan_weeks,
-- plan_days) and never shipped in the current app; the table is empty.
DROP TABLE IF EXISTS public.weekly_plans;
