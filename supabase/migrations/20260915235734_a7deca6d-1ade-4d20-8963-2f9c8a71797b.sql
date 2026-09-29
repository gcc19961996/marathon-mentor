ALTER TABLE public.strava_connection ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.strava_connection ADD COLUMN IF NOT EXISTS client_secret text;