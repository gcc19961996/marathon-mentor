DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['runs','run_splits','daily_checkins','profile','target_times','plan_days','plan_weeks','weekly_plans','plan_changes','milestones','checklist_items','cross_training','questions','ai_usage','strava_connection']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      IF p.policyname <> 'service role manages strava connection' AND p.policyname <> 'service role manages ai usage' THEN
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END IF;
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;