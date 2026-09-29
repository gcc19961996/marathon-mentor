DELETE FROM public.milestones m
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY name, target_date
           ORDER BY (completed_date IS NULL), created_at ASC, id ASC
         ) AS rn
  FROM public.milestones
) t
WHERE m.id = t.id AND t.rn > 1;

ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_name_target_date_key UNIQUE (name, target_date);