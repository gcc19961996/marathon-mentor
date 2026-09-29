CREATE TABLE public.run_best_efforts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  strava_activity_id bigint NOT NULL,
  name text NOT NULL,
  distance_m integer NOT NULL,
  seconds integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (strava_activity_id, name)
);
GRANT ALL ON public.run_best_efforts TO service_role;
ALTER TABLE public.run_best_efforts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages run_best_efforts" ON public.run_best_efforts FOR ALL TO service_role USING (true) WITH CHECK (true);