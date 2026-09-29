UPDATE public.strava_connection
SET last_error = NULL, updated_at = now()
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND last_error = 'Strava rejected the connection (400) Bad Request: code invalid';