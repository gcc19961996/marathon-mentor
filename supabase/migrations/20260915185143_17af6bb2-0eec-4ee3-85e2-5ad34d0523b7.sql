CREATE TABLE public.plan_weeks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  week_number integer NOT NULL,
  start_date date NOT NULL,
  phase text NOT NULL,
  target_miles numeric NOT NULL DEFAULT 0,
  suggested_ceiling numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_weeks TO anon, authenticated;
GRANT ALL ON public.plan_weeks TO service_role;
ALTER TABLE public.plan_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_weeks open" ON public.plan_weeks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.plan_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  date date NOT NULL,
  week_number integer NOT NULL,
  phase text NOT NULL,
  workout_type text NOT NULL,
  target_miles numeric NOT NULL DEFAULT 0,
  min_miles numeric,
  max_miles numeric,
  details text,
  pace_target text,
  purpose text,
  status text NOT NULL DEFAULT 'planned',
  actual_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_days TO anon, authenticated;
GRANT ALL ON public.plan_days TO service_role;
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_days open" ON public.plan_days FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_plan_weeks_updated_at BEFORE UPDATE ON public.plan_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plan_days_updated_at BEFORE UPDATE ON public.plan_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plan_weeks (week_number, start_date, phase, target_miles, suggested_ceiling) VALUES
  (1, '2026-09-14', 'Build', 33, 35),
  (2, '2026-09-21', 'Build (travel week)', 11, 13),
  (3, '2026-09-28', 'Build', 32, 35),
  (4, '2026-10-05', 'Recovery', 25, 28),
  (5, '2026-10-12', 'Peak', 34, 37),
  (6, '2026-10-19', 'Taper', 26, 28),
  (7, '2026-10-26', 'Race week', 15, 17);

INSERT INTO public.plan_days (date, week_number, phase, workout_type, target_miles, min_miles, max_miles, details, pace_target, purpose) VALUES
  ('2026-09-14', 1, 'Build', 'easy', 7.8, 7, 8.5, 'Easy/steady', '9:50–10:20/mi', 'Kickoff week'),
  ('2026-09-15', 1, 'Build', 'easy', 8.1, 7, 8.5, 'Easy/steady', '9:50–10:20/mi', 'Kickoff week'),
  ('2026-09-17', 1, 'Build', 'easy', 3, 2, 4, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Stay fresh for Sunday''s 14'),
  ('2026-09-20', 1, 'Build', 'long', 14, 12, 15, 'East Hampton; 9:50–10:15/mi; gel every 30–45 min', '9:50–10:15/mi', 'Longest run yet; rehearse a Sunday race morning'),
  ('2026-09-22', 2, 'Build (travel week)', 'tempo', 6, 5, 6, 'Morning: 1.5 warm-up, 3 @ 8:30, 1.5 cool-down. Swap for easy 4 if stressed or short on sleep', '8:25–8:35/mi', 'Quality before a busy week'),
  ('2026-09-25', 2, 'Build (travel week)', 'easy', 5, 4, 6, 'Jackson (~6,200 ft): run by effort, expect 10:15–11:00/mi, flat route, extra fluids', 'by effort', 'Stay loose while traveling'),
  ('2026-09-28', 3, 'Build', 'easy', 5, 4, 6, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Fresh legs for tomorrow''s long run'),
  ('2026-09-29', 3, 'Build', 'long', 16, 14, 16, '9:50–10:15/mi; gel every 30–45 min', '9:50–10:15/mi', 'Milestone: first 16-miler'),
  ('2026-10-01', 3, 'Build', 'mp', 6, 5, 7, '1 warm-up, 4 @ 9:10, 1 cool-down', '9:10/mi', 'Lock in race pace'),
  ('2026-10-03', 3, 'Build', 'easy', 5, 4, 6, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Aerobic volume'),
  ('2026-10-05', 4, 'Recovery', 'easy', 4, 3, 5, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Recovery week: absorb training'),
  ('2026-10-06', 4, 'Recovery', 'long', 12, 10, 13, 'Easy, last 3 @ 9:10', '9:50–10:15/mi', 'Race pace on tired legs'),
  ('2026-10-08', 4, 'Recovery', 'strides', 5, 4, 6, 'Easy + 6 × 20-sec relaxed strides', '9:50–10:20/mi', 'Keep legs sharp'),
  ('2026-10-10', 4, 'Recovery', 'easy', 4, 3, 5, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Recovery week'),
  ('2026-10-12', 5, 'Peak', 'easy', 5, 4, 6, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Fresh legs for peak long run'),
  ('2026-10-13', 5, 'Peak', 'long', 18, 16, 20, '9:50–10:15/mi; go to 20 only if the 16 felt good and nothing hurts', '9:50–10:15/mi', 'Milestone: peak long run'),
  ('2026-10-15', 5, 'Peak', 'tempo', 6, 5, 7, '1.5 warm-up, 3 @ 8:30, 1.5 cool-down', '8:25–8:35/mi', 'Last hard session'),
  ('2026-10-17', 5, 'Peak', 'easy', 5, 4, 6, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Aerobic volume'),
  ('2026-10-19', 6, 'Taper', 'easy', 5, 4, 6, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Taper begins'),
  ('2026-10-20', 6, 'Taper', 'long', 12, 10, 13, 'Easy with miles 6–9 @ 9:10', '9:50–10:15/mi', 'Last longish run'),
  ('2026-10-22', 6, 'Taper', 'mp', 5, 4, 6, '1.5 warm-up, 2 @ 9:10, 1.5 cool-down', '9:10/mi', 'Stay sharp'),
  ('2026-10-24', 6, 'Taper', 'easy', 4, 3, 5, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Taper'),
  ('2026-10-26', 7, 'Race week', 'easy', 4, 3, 4, 'Easy 9:50–10:20/mi', '9:50–10:20/mi', 'Race week: stay loose'),
  ('2026-10-27', 7, 'Race week', 'mp', 6, 5, 6, '2 warm-up, 2 @ 9:10, 2 cool-down', '9:10/mi', 'Rehearse race pace'),
  ('2026-10-29', 7, 'Race week', 'strides', 3, 2, 3, 'Easy + 4 strides', '9:50–10:20/mi', 'Sharpen, don''t tire'),
  ('2026-10-31', 7, 'Race week', 'shakeout', 2, 1.5, 2.5, 'Very easy', 'very easy', 'Loosen up'),
  ('2026-11-01', 7, 'Race week', 'race', 26.2, NULL, NULL, 'Target 4:00 (9:10/mi). Miles 1–2 (Verrazzano) ~9:30; don''t bank time', '9:10/mi', 'Race day');