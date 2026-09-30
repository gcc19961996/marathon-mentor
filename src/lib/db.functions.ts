// All app data goes through here. Reading is open; every write is validated
// and rate limited, and the browser never gets a direct database connection.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

const TABLES = [
  "profile",
  "target_times",
  "runs",
  "run_splits",
  "run_best_efforts",
  "weekly_plans",
  "daily_checkins",
  "milestones",
  "questions",
  "cross_training",
  "checklist_items",
  "plan_changes",
  "plan_days",
  "plan_weeks",
] as const;

const OpSchema = z.object({
  table: z.enum(TABLES),
  action: z.enum(["select", "insert", "update", "upsert", "delete"]),
  columns: z.string().optional(),
  values: z
    .union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))])
    .optional(),
  match: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  order: z
    .array(
      z.object({
        column: z.string(),
        ascending: z.boolean().optional(),
        nullsFirst: z.boolean().optional(),
      }),
    )
    .optional(),
  limit: z.number().int().positive().max(5000).optional(),
  single: z.boolean().optional(),
  onConflict: z.string().optional(),
  ignoreDuplicates: z.boolean().optional(),
});

export type DbOp = z.infer<typeof OpSchema>;

function withUser<T extends Record<string, unknown>>(row: T) {
  return { ...row, user_id: SINGLE_USER_ID };
}

/* ---------- write guardrails ---------- */

// Roughly 30 writes a minute, so a stray script cannot hammer the data.
const WRITE_LIMIT = 30;
const writeTimes: number[] = [];

function checkWriteRate() {
  const now = Date.now();
  while (writeTimes.length && now - (writeTimes[0] as number) > 60_000) writeTimes.shift();
  if (writeTimes.length >= WRITE_LIMIT) {
    throw new Error("Too many changes at once. Wait a minute and try again.");
  }
  writeTimes.push(now);
}

const NUMBER_RANGES: Record<string, [number, number]> = {
  distance_mi: [0, 50],
  target_miles: [0, 50],
  min_miles: [0, 50],
  max_miles: [0, 50],
  duration_seconds: [0, 12 * 3600],
  target_seconds: [0, 12 * 3600],
  avg_pace_seconds: [0, 3600],
  target_pace_seconds: [0, 3600],
  fast_segment_pace_seconds: [0, 3600],
  pace_seconds: [0, 3600],
  elevation_gain_ft: [0, 60_000],
  avg_heart_rate: [0, 260],
  heart_rate: [0, 260],
  max_speed_mph: [0, 60],
  gels: [0, 40],
  fluids_oz: [0, 400],
  stomach: [1, 5],
  leg_feel: [1, 5],
  sleep_quality: [1, 5],
  whoop_recovery_pct: [0, 100],
  minutes: [0, 600],
  mile_number: [0, 60],
  week_number: [0, 60],
  sort_order: [0, 1000],
  suggested_ceiling: [0, 200],
};

const DATE_FIELDS = new Set([
  "date",
  "item_date",
  "target_date",
  "completed_date",
  "start_date",
  "week_start",
  "race_date",
  "recent_race_date",
  "longest_run_date",
]);

function validateRow(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error(`${key} is not a valid number.`);
      const range = NUMBER_RANGES[key];
      if (range && (value < range[0] || value > range[1])) {
        throw new Error(`${key} must be between ${range[0]} and ${range[1]}.`);
      }
    }
    if (typeof value === "string") {
      if (DATE_FIELDS.has(key)) {
        const time = Date.parse(value);
        if (Number.isNaN(time)) throw new Error(`${key} is not a valid date.`);
        const year = new Date(time).getUTCFullYear();
        if (year < 2000 || year > 2100) throw new Error(`${key} is outside a sensible date range.`);
      } else if (value.length > 500) {
        throw new Error(`${key} is too long (500 characters maximum).`);
      }
    }
  }
}

function validateValues(values: DbOp["values"]) {
  if (!values) return;
  const rows = Array.isArray(values) ? values : [values];
  for (const row of rows) validateRow(row);
}

export const dbOp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => OpSchema.parse(input))
  .handler(async ({ data }): Promise<any> => {
    const gate = await import("./gate.server");
    if (data.action === "select") {
      gate.requireAnyRole();
    } else {
      gate.requireOwner();
      checkWriteRate();
      validateValues(data.values);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = supabaseAdmin.from(data.table as never);

    const applyFilters = (builder: any) => {
      let b = builder.eq("user_id", SINGLE_USER_ID);
      for (const [key, value] of Object.entries(data.match ?? {})) b = b.eq(key, value);
      return b;
    };

    if (data.action === "select") {
      const runSelect = async () => {
        let b = applyFilters((table as any).select(data.columns ?? "*"));
        // Deleted runs are only hidden, never removed.
        if (data.table === "runs") b = b.eq("hidden", false);
        for (const o of data.order ?? []) {
          b = b.order(o.column, { ascending: o.ascending ?? true, nullsFirst: o.nullsFirst });
        }
        if (data.limit) b = b.limit(data.limit);
        return data.single ? await b.maybeSingle() : await b;
      };

      let { data: rows, error } = await runSelect();
      // Clock drift between this server and the database can briefly reject a
      // request ("JWT issued at future"). One quiet retry clears it.
      if (error && /jwt|token/i.test(error.message)) {
        await new Promise((r) => setTimeout(r, 400));
        ({ data: rows, error } = await runSelect());
      }
      if (error) throw new Error(error.message);
      return rows ?? (data.single ? null : []);
    }

    if (data.action === "insert") {
      const payload = Array.isArray(data.values)
        ? data.values.map(withUser)
        : withUser((data.values ?? {}) as Record<string, unknown>);
      const { data: rows, error } = await (table as any).insert(payload).select();
      if (error) throw new Error(error.message);
      return data.single ? (rows?.[0] ?? null) : (rows ?? []);
    }

    if (data.action === "upsert") {
      const payload = Array.isArray(data.values)
        ? data.values.map(withUser)
        : withUser((data.values ?? {}) as Record<string, unknown>);
      const { error } = await (table as any).upsert(payload, {
        onConflict: data.onConflict,
        ignoreDuplicates: data.ignoreDuplicates,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (data.action === "update") {
      const { error } = await applyFilters((table as any).update(data.values ?? {}));
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (data.table === "runs") {
      // Soft delete: the row stays in the database, just out of sight.
      const { error: hideError } = await applyFilters((table as any).update({ hidden: true }));
      if (hideError) throw new Error(hideError.message);
      return { ok: true };
    }

    const { error } = await applyFilters((table as any).delete());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Full JSON snapshot of every table, for manual backups. */
export const exportAllData = createServerFn({ method: "GET" }).handler(async (): Promise<any> => {
  const gate = await import("./gate.server");
  gate.requireOwner();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tables: Record<string, any[]> = {};
  for (const name of TABLES) {
    const { data, error } = await supabaseAdmin.from(name as never).select("*");
    if (error) throw new Error(error.message);
    tables[name] = data ?? [];
  }
  return { exportedAt: new Date().toISOString(), tables };
});
