CREATE TABLE IF NOT EXISTS public.strava_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  athlete_id bigint,
  athlete_name text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.strava_connection TO service_role;
ALTER TABLE public.strava_connection ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.run_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  strava_activity_id bigint NOT NULL,
  mile_number integer NOT NULL,
  pace_seconds integer NOT NULL,
  heart_rate integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (strava_activity_id, mile_number)
);
GRANT SELECT ON public.run_splits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_splits TO authenticated;
GRANT ALL ON public.run_splits TO service_role;
ALTER TABLE public.run_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "run_splits readable" ON public.run_splits FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS strava_activity_id bigint;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS elevation_gain_ft numeric;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS avg_heart_rate integer;
CREATE UNIQUE INDEX IF NOT EXISTS runs_strava_activity_id_key ON public.runs (strava_activity_id) WHERE strava_activity_id IS NOT NULL;