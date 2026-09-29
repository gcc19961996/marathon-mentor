-- 1. Single-user mode: detach from auth.users and default every row to one owner
ALTER TABLE public.profile DROP CONSTRAINT IF EXISTS profile_user_id_fkey;
ALTER TABLE public.target_times DROP CONSTRAINT IF EXISTS target_times_user_id_fkey;
ALTER TABLE public.runs DROP CONSTRAINT IF EXISTS runs_user_id_fkey;
ALTER TABLE public.weekly_plans DROP CONSTRAINT IF EXISTS weekly_plans_user_id_fkey;
ALTER TABLE public.daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_user_id_fkey;
ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS milestones_user_id_fkey;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_user_id_fkey;

ALTER TABLE public.profile ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.target_times ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.runs ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.weekly_plans ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.daily_checkins ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.milestones ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.questions ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

UPDATE public.profile SET user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.target_times SET user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.runs SET user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.weekly_plans SET user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.daily_checkins SET user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.milestones SET user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.questions SET user_id = '00000000-0000-0000-0000-000000000001'::uuid;

DROP POLICY IF EXISTS "own profile" ON public.profile;
DROP POLICY IF EXISTS "own targets" ON public.target_times;
DROP POLICY IF EXISTS "own runs" ON public.runs;
DROP POLICY IF EXISTS "own plans" ON public.weekly_plans;
DROP POLICY IF EXISTS "own checkins" ON public.daily_checkins;
DROP POLICY IF EXISTS "own milestones" ON public.milestones;
DROP POLICY IF EXISTS "own questions" ON public.questions;

CREATE POLICY "open profile" ON public.profile FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open targets" ON public.target_times FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open runs" ON public.runs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open plans" ON public.weekly_plans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open checkins" ON public.daily_checkins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open milestones" ON public.milestones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open questions" ON public.questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_times TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon;

-- 2. Extra setup fields
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS longest_run_mi numeric;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS longest_run_date date;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS long_run_day text;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;

-- 3. AI usage cap (server-side only)
CREATE TABLE IF NOT EXISTS public.ai_usage (
  day date PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages ai usage" ON public.ai_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.bump_ai_usage(max_per_day integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c integer;
BEGIN
  INSERT INTO public.ai_usage (day, count) VALUES (current_date, 1)
  ON CONFLICT (day) DO UPDATE SET count = public.ai_usage.count + 1, updated_at = now()
  RETURNING count INTO c;
  RETURN c <= max_per_day;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_ai_usage(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_ai_usage(integer) TO service_role;