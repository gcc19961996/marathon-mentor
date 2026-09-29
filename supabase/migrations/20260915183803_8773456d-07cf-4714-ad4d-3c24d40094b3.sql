ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS fast_segment_pace_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS gels INTEGER,
  ADD COLUMN IF NOT EXISTS fluids_oz NUMERIC,
  ADD COLUMN IF NOT EXISTS stomach INTEGER;

ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS baseline JSONB;

CREATE TABLE IF NOT EXISTS public.cross_training (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  activity TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cross_training TO anon, authenticated;
GRANT ALL ON public.cross_training TO service_role;
ALTER TABLE public.cross_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cross_training open" ON public.cross_training FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  item_date DATE,
  note TEXT,
  checked BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO anon, authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_items open" ON public.checklist_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.plan_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  what TEXT NOT NULL,
  why TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_changes TO anon, authenticated;
GRANT ALL ON public.plan_changes TO service_role;
ALTER TABLE public.plan_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_changes open" ON public.plan_changes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);