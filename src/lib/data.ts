import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dbOp, SINGLE_USER_ID, type DbOp } from "./db.functions";
import { isoDate, startOfWeek } from "./training";

// Single-user app: no sign-in, every row belongs to this fixed id.
export { SINGLE_USER_ID };

/** Every read and write goes through the backend; writes are validated there. */
async function op<T>(input: DbOp): Promise<T> {
  return (await dbOp({ data: input })) as T;
}

export type Profile = {
  id: string;
  user_id: string;
  longest_run_mi: number | null;
  longest_run_date: string | null;
  long_run_day: string | null;
  setup_complete: boolean;
  race_name: string;
  race_date: string;
  recent_race_distance_mi: number | null;
  recent_race_date: string | null;
  recent_race_seconds: number | null;
  typical_weekly_mileage: number | null;
  days_per_week: number | null;
};

export type TargetTime = {
  id: string;
  target_seconds: number;
  target_pace_seconds: number;
  set_at: string;
  note: string | null;
};

export type Run = {
  id: string;
  date: string;
  type: string;
  distance_mi: number;
  duration_seconds: number;
  avg_pace_seconds: number | null;
  source: string;
  notes: string | null;
  fast_segment_pace_seconds: number | null;
  gels: number | null;
  fluids_oz: number | null;
  stomach: number | null;
  strava_activity_id: number | null;
  elevation_gain_ft: number | null;
  avg_heart_rate: number | null;
  max_speed_mph: number | null;
  elapsed_seconds: number | null;
  stopped_seconds: number | null;
  clock_left_running: boolean | null;
};

export type WeeklyPlan = {
  id: string;
  week_start: string;
  option_a: any;
  option_b: any;
  baseline: any;
  selected_option: string | null;
  completed: Record<string, boolean>;
};

export type Checkin = {
  id: string;
  date: string;
  leg_feel: number | null;
  sleep_quality: number | null;
  whoop_recovery_pct: number | null;
  pain_note: string | null;
  computed_min_mi: number | null;
  computed_max_mi: number | null;
  rest_recommended: boolean;
};

export type Milestone = {
  id: string;
  name: string;
  criteria: string | null;
  target_date: string | null;
  completed_date: string | null;
  is_custom: boolean;
  sort_order: number;
};

export type QuestionRow = {
  id: string;
  asked_at: string;
  question: string;
  answer: string | null;
  suggested_workout: any;
};

/* ---------- profile ---------- */

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile> => {
      const existing = await op<Profile | null>({ table: "profile", action: "select", single: true });
      if (existing) return existing;
      return op<Profile>({ table: "profile", action: "insert", values: {}, single: true });
    },
  });
}

export function useSaveProfile(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      await op({ table: "profile", action: "update", values: patch as Record<string, unknown> });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

/* ---------- target ---------- */

export function useTargets(userId?: string) {
  return useQuery({
    queryKey: ["targets", userId],
    queryFn: () =>
      op<TargetTime[]>({
        table: "target_times",
        action: "select",
        order: [{ column: "set_at", ascending: false }],
      }),
  });
}

export function useSetTarget(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { target_seconds: number; target_pace_seconds: number; note?: string }) => {
      await op({ table: "target_times", action: "insert", values: v });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["targets"] }),
  });
}

/* ---------- runs ---------- */

export function useRuns(userId?: string) {
  return useQuery({
    queryKey: ["runs", userId],
    queryFn: () =>
      op<Run[]>({
        table: "runs",
        action: "select",
        order: [{ column: "date", ascending: false }],
        limit: 500,
      }),
  });
}

export function useRunMutations(userId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["runs"] });
    qc.invalidateQueries({ queryKey: ["milestones"] });
  };
  return {
    add: useMutation({
      mutationFn: async (run: Partial<Run>) => {
        await op({ table: "runs", action: "insert", values: run as Record<string, unknown> });
      },
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...patch }: Partial<Run> & { id: string }) => {
        await op({ table: "runs", action: "update", match: { id }, values: patch as Record<string, unknown> });
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        await op({ table: "runs", action: "delete", match: { id } });
      },
      onSuccess: invalidate,
    }),
  };
}

/* ---------- weekly plan ---------- */

export function useCurrentPlan(userId?: string) {
  const weekStart = isoDate(startOfWeek());
  return useQuery({
    queryKey: ["plan", userId, weekStart],
    queryFn: () =>
      op<WeeklyPlan | null>({
        table: "weekly_plans",
        action: "select",
        match: { week_start: weekStart },
        single: true,
      }),
  });
}

export function usePlanMutations(userId?: string) {
  const qc = useQueryClient();
  const weekStart = isoDate(startOfWeek());
  const invalidate = () => qc.invalidateQueries({ queryKey: ["plan"] });
  return {
    weekStart,
    save: useMutation({
      mutationFn: async (v: { option_a: unknown; option_b: unknown; selected_option?: string | null }) => {
        await op({
          table: "weekly_plans",
          action: "upsert",
          onConflict: "user_id,week_start",
          values: {
            week_start: weekStart,
            selected_option: null,
            ...v,
            // Snapshot of the week as first built, for "Reset plan to original".
            baseline: { option_a: v.option_a, option_b: v.option_b },
            completed: {},
          } as Record<string, unknown>,
        });
      },
      onSuccess: invalidate,
    }),
    patch: useMutation({
      mutationFn: async (patch: Partial<WeeklyPlan>) => {
        await op({
          table: "weekly_plans",
          action: "update",
          match: { week_start: weekStart },
          values: patch as Record<string, unknown>,
        });
      },
      onSuccess: invalidate,
    }),
  };
}

/* ---------- check-ins ---------- */

export function useTodayCheckin(userId?: string) {
  const today = isoDate();
  return useQuery({
    queryKey: ["checkin", userId, today],
    queryFn: () =>
      op<Checkin | null>({
        table: "daily_checkins",
        action: "select",
        match: { date: today },
        single: true,
      }),
  });
}

export function useSaveCheckin(userId?: string) {
  const qc = useQueryClient();
  const today = isoDate();
  return useMutation({
    mutationFn: async (patch: Partial<Checkin>) => {
      await op({
        table: "daily_checkins",
        action: "upsert",
        onConflict: "user_id,date",
        values: { date: today, ...patch } as Record<string, unknown>,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkin"] }),
  });
}

/* ---------- milestones ---------- */

export function useMilestones(userId?: string) {
  return useQuery({
    queryKey: ["milestones", userId],
    queryFn: () =>
      op<Milestone[]>({
        table: "milestones",
        action: "select",
        order: [
          { column: "target_date", ascending: true, nullsFirst: false },
          { column: "sort_order", ascending: true },
        ],
      }),
  });
}

export function useMilestoneMutations(userId?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["milestones"] });
  return {
    // Insert defaults only when they're missing — never duplicates.
    seed: useMutation({
      mutationFn: async (rows: Partial<Milestone>[]) => {
        await op({
          table: "milestones",
          action: "upsert",
          onConflict: "name,target_date",
          ignoreDuplicates: true,
          values: rows as Record<string, unknown>[],
        });
      },
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...patch }: Partial<Milestone> & { id: string }) => {
        await op({ table: "milestones", action: "update", match: { id }, values: patch as Record<string, unknown> });
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        await op({ table: "milestones", action: "delete", match: { id } });
      },
      onSuccess: invalidate,
    }),
  };
}

/* ---------- questions ---------- */

export function useQuestions(userId?: string) {
  return useQuery({
    queryKey: ["questions", userId],
    queryFn: () =>
      op<QuestionRow[]>({
        table: "questions",
        action: "select",
        order: [{ column: "asked_at", ascending: false }],
        limit: 50,
      }),
  });
}

export function useSaveQuestion(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { question: string; answer: string; suggested_workout: unknown }) => {
      await op({ table: "questions", action: "insert", values: v as Record<string, unknown> });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["questions"] }),
  });
}

/* ---------- recent plans (for the Monday recap and long-run rule) ---------- */

export function useRecentPlans(userId?: string) {
  return useQuery({
    queryKey: ["plans-recent", userId],
    queryFn: () =>
      op<WeeklyPlan[]>({
        table: "weekly_plans",
        action: "select",
        order: [{ column: "week_start", ascending: false }],
        limit: 6,
      }),
  });
}

/* ---------- bulk run import ---------- */

export function useAddRuns(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<Run>[]) => {
      if (!rows.length) return;
      await op({ table: "runs", action: "insert", values: rows as Record<string, unknown>[] });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

/* ---------- cross-training ---------- */

export type CrossTraining = {
  id: string;
  date: string;
  activity: string;
  minutes: number;
};

export function useCrossTraining(userId?: string) {
  return useQuery({
    queryKey: ["cross-training", userId],
    queryFn: () =>
      op<CrossTraining[]>({
        table: "cross_training",
        action: "select",
        order: [{ column: "date", ascending: false }],
        limit: 200,
      }),
  });
}

export function useAddCrossTraining(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { date: string; activity: string; minutes: number }) => {
      await op({ table: "cross_training", action: "insert", values: v });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cross-training"] }),
  });
}

/* ---------- race-week checklist ---------- */

export type ChecklistItem = {
  id: string;
  key: string;
  label: string;
  item_date: string | null;
  note: string | null;
  checked: boolean;
  sort_order: number;
};

export function useChecklist(userId?: string) {
  return useQuery({
    queryKey: ["checklist", userId],
    queryFn: () =>
      op<ChecklistItem[]>({
        table: "checklist_items",
        action: "select",
        order: [{ column: "sort_order", ascending: true }],
      }),
  });
}

export function useChecklistMutations(userId?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["checklist"] });
  return {
    seed: useMutation({
      mutationFn: async (rows: Partial<ChecklistItem>[]) => {
        await op({
          table: "checklist_items",
          action: "upsert",
          onConflict: "user_id,key",
          ignoreDuplicates: true,
          values: rows as Record<string, unknown>[],
        });
      },
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...patch }: Partial<ChecklistItem> & { id: string }) => {
        await op({
          table: "checklist_items",
          action: "update",
          match: { id },
          values: patch as Record<string, unknown>,
        });
      },
      onSuccess: invalidate,
    }),
  };
}

/* ---------- plan change log ---------- */

export type PlanChange = {
  id: string;
  changed_at: string;
  what: string;
  why: string | null;
};

export function usePlanChanges(userId?: string) {
  return useQuery({
    queryKey: ["plan-changes", userId],
    queryFn: () =>
      op<PlanChange[]>({
        table: "plan_changes",
        action: "select",
        order: [{ column: "changed_at", ascending: false }],
        limit: 50,
      }),
  });
}

export function useLogPlanChange(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { what: string; why?: string | null }) => {
      await op({ table: "plan_changes", action: "insert", values: v as Record<string, unknown> });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-changes"] }),
  });
}

/* ---------- per-mile splits from Strava ---------- */

export type RunSplit = {
  strava_activity_id: number;
  mile_number: number;
  pace_seconds: number;
  distance_mi: number | null;
  moving_seconds: number | null;
  elapsed_seconds: number | null;
  flag: "too_fast" | "too_slow" | "gap" | null;
  flag_reason: string | null;
  heart_rate: number | null;
  elevation_difference?: number | null;
};

export function useRunSplits(userId?: string) {
  return useQuery({
    queryKey: ["run-splits", userId],
    queryFn: () =>
      op<RunSplit[]>({
        table: "run_splits",
        action: "select",
        columns:
          "strava_activity_id, mile_number, pace_seconds, distance_mi, moving_seconds, elapsed_seconds, flag, flag_reason, heart_rate",
        order: [{ column: "mile_number", ascending: true }],
        limit: 5000,
      }),
  });
}

/* ---------- Strava best efforts (1 mile / 5K / 10K) ---------- */

export type BestEffortRow = {
  strava_activity_id: number;
  name: string;
  distance_m: number;
  seconds: number;
};

export function useBestEfforts(userId?: string) {
  return useQuery({
    queryKey: ["run-best-efforts", userId],
    queryFn: () =>
      op<BestEffortRow[]>({
        table: "run_best_efforts",
        action: "select",
        columns: "strava_activity_id, name, distance_m, seconds",
        limit: 5000,
      }),
  });
}

/* ---------- fixed plan ---------- */

export type PlanDayRow = {
  id: string;
  date: string;
  week_number: number;
  phase: string;
  workout_type: string;
  target_miles: number;
  min_miles: number | null;
  max_miles: number | null;
  details: string | null;
  pace_target: string | null;
  purpose: string | null;
  status: string;
  actual_run_id: string | null;
};

export type PlanWeek = {
  id: string;
  week_number: number;
  start_date: string;
  phase: string;
  target_miles: number;
  suggested_ceiling: number;
};

export function usePlanDays(userId?: string) {
  return useQuery({
    queryKey: ["plan-days", userId],
    queryFn: () =>
      op<PlanDayRow[]>({
        table: "plan_days",
        action: "select",
        order: [{ column: "date", ascending: true }],
      }),
  });
}

export function usePlanWeeks(userId?: string) {
  return useQuery({
    queryKey: ["plan-weeks", userId],
    queryFn: () =>
      op<PlanWeek[]>({
        table: "plan_weeks",
        action: "select",
        order: [{ column: "week_number", ascending: true }],
      }),
  });
}

export function usePlanDayMutations(userId?: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["plan-days"] });
  return {
    update: useMutation({
      mutationFn: async ({ id, ...patch }: Partial<PlanDayRow> & { id: string }) => {
        await op({ table: "plan_days", action: "update", match: { id }, values: patch as Record<string, unknown> });
      },
      onSuccess: invalidate,
    }),
    /** Mark the plan day that falls on a date, if there is one. */
    markDate: useMutation({
      mutationFn: async (v: { date: string; status: string; runId?: string | null }) => {
        await op({
          table: "plan_days",
          action: "update",
          match: { date: v.date },
          values: { status: v.status, actual_run_id: v.runId ?? null },
        });
      },
      onSuccess: invalidate,
    }),
    /** Restore every plan day to the original seed, leaving runs alone. */
    resetToSeed: useMutation({
      mutationFn: async (rows: Partial<PlanDayRow>[]) => {
        for (const row of rows) {
          await op({
            table: "plan_days",
            action: "update",
            match: { date: row.date! },
            values: {
              week_number: row.week_number,
              phase: row.phase,
              workout_type: row.workout_type,
              target_miles: row.target_miles,
              min_miles: row.min_miles ?? null,
              max_miles: row.max_miles ?? null,
              details: row.details ?? null,
              pace_target: row.pace_target ?? null,
              purpose: row.purpose ?? null,
            },
          });
        }
      },
      onSuccess: invalidate,
    }),
  };
}
