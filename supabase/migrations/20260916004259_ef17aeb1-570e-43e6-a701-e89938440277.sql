GRANT ALL ON public.strava_connection TO service_role;
CREATE POLICY "service role manages strava connection"
ON public.strava_connection
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);