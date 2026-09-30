-- Passcode attempt throttle, kept in the database so every server instance
-- shares it (Vercel functions do not share memory, and restart often).
CREATE TABLE IF NOT EXISTS public.unlock_throttle (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  failures integer NOT NULL DEFAULT 0,
  window_started timestamptz,
  locked_until timestamptz
);
INSERT INTO public.unlock_throttle (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.unlock_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unlock_throttle FROM anon, authenticated;
GRANT ALL ON public.unlock_throttle TO service_role;
CREATE POLICY "service role manages unlock throttle" ON public.unlock_throttle
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seconds until unlocking is allowed again (0 when not locked).
CREATE OR REPLACE FUNCTION public.unlock_wait_seconds()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(GREATEST(0, CEIL(EXTRACT(EPOCH FROM (locked_until - now()))))::integer, 0)
  FROM public.unlock_throttle WHERE id = 1;
$$;

-- Counts a wrong passcode. After max_failures within window_seconds, locks
-- unlocking for lock_seconds and returns the lock length; otherwise 0.
CREATE OR REPLACE FUNCTION public.record_unlock_failure(
  max_failures integer,
  window_seconds integer,
  lock_seconds integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t public.unlock_throttle;
BEGIN
  SELECT * INTO t FROM public.unlock_throttle WHERE id = 1 FOR UPDATE;
  IF t.window_started IS NULL OR t.window_started < now() - make_interval(secs => window_seconds) THEN
    t.failures := 0;
    t.window_started := now();
  END IF;
  t.failures := t.failures + 1;
  IF t.failures >= max_failures THEN
    UPDATE public.unlock_throttle
      SET failures = 0, window_started = NULL, locked_until = now() + make_interval(secs => lock_seconds)
      WHERE id = 1;
    RETURN lock_seconds;
  END IF;
  UPDATE public.unlock_throttle
    SET failures = t.failures, window_started = t.window_started
    WHERE id = 1;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_unlock_failures()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.unlock_throttle
    SET failures = 0, window_started = NULL, locked_until = NULL
    WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.unlock_wait_seconds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_unlock_failure(integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_unlock_failures() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_wait_seconds() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_unlock_failure(integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_unlock_failures() TO service_role;
