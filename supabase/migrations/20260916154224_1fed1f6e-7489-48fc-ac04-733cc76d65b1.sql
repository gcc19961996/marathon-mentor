DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['profile','target_times','runs','run_splits','weekly_plans','daily_checkins','milestones','questions','cross_training','checklist_items','plan_changes','plan_days','plan_weeks','strava_connection','ai_usage']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      IF p.policyname <> 'service role manages strava connection' AND p.policyname <> 'service role manages ai usage' THEN
        EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "service role manages profile" ON public.profile FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages target_times" ON public.target_times FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages runs" ON public.runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages run_splits" ON public.run_splits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages weekly_plans" ON public.weekly_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages daily_checkins" ON public.daily_checkins FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages milestones" ON public.milestones FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages questions" ON public.questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages cross_training" ON public.cross_training FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages checklist_items" ON public.checklist_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages plan_changes" ON public.plan_changes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages plan_days" ON public.plan_days FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages plan_weeks" ON public.plan_weeks FOR ALL TO service_role USING (true) WITH CHECK (true);