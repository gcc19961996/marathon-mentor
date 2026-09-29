ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS elapsed_seconds integer,
  ADD COLUMN IF NOT EXISTS stopped_seconds integer,
  ADD COLUMN IF NOT EXISTS clock_left_running boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streams_checked_at timestamptz;

ALTER TABLE public.run_splits
  ADD COLUMN IF NOT EXISTS distance_mi numeric,
  ADD COLUMN IF NOT EXISTS moving_seconds integer,
  ADD COLUMN IF NOT EXISTS elapsed_seconds integer,
  ADD COLUMN IF NOT EXISTS flag text,
  ADD COLUMN IF NOT EXISTS flag_reason text;