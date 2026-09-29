// Helpers that turn fixed plan_days rows into the shapes the UI already speaks.

import type { PlanDayRow } from "./data";
import {
  DAY_NAMES,
  isoDate,
  type PlanDay,
  type TodayRange,
  type Zone,
} from "./training";

export const TYPE_LABEL: Record<string, string> = {
  easy: "Easy Run",
  long: "Long Run",
  tempo: "Tempo",
  mp: "Marathon-Pace Run",
  strides: "Easy Run",
  shakeout: "Shakeout",
  race: "Race",
};

export function typeLabel(workoutType: string): string {
  return TYPE_LABEL[workoutType] ?? workoutType;
}

export function zoneKeyFor(workoutType: string): string {
  if (workoutType === "long") return "long";
  if (workoutType === "tempo") return "tempo";
  if (workoutType === "mp" || workoutType === "race") return "mp";
  return "easy";
}

export function dayIndexOfDate(date: string): number {
  const d = new Date(`${date}T00:00:00`);
  return (d.getDay() + 6) % 7; // Monday = 0
}

export function toPlanDay(row: PlanDayRow): PlanDay {
  const i = dayIndexOfDate(row.date);
  return {
    day: DAY_NAMES[i] ?? "",
    date: row.date,
    type: typeLabel(row.workout_type),
    distance_mi: Number(row.target_miles),
    pace_zone: row.pace_target ?? "",
    why: row.purpose ?? "",
  };
}

export function restPlanDay(i: number, date: string): PlanDay {
  return { day: DAY_NAMES[i] ?? "", date, type: "Rest", distance_mi: 0, pace_zone: "", why: "" };
}

/** The seven dates of a Monday-starting week. */
export function weekDates(weekStart: string): string[] {
  const start = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => isoDate(new Date(start.getTime() + i * 86400000)));
}

/** Seven slots for a week; null means a rest day. */
export function weekRowsFor(rows: PlanDayRow[], weekStart: string): (PlanDayRow | null)[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return weekDates(weekStart).map((d) => byDate.get(d) ?? null);
}

/** Same week as PlanDay[], with rest days filled in. */
export function weekPlanDays(rows: PlanDayRow[], weekStart: string): PlanDay[] {
  const dates = weekDates(weekStart);
  return weekRowsFor(rows, weekStart).map((row, i) =>
    row ? toPlanDay(row) : restPlanDay(i, dates[i] ?? weekStart),
  );
}

/* ---------- today's range, straight from the plan row ---------- */

export type CheckinLite = {
  leg_feel: number | null;
  sleep_quality: number | null;
  whoop_recovery_pct: number | null;
  pain_note: string | null;
} | null;

const round = (n: number) => Math.round(n * 10) / 10;

export function fixedTodayRange(
  row: PlanDayRow | null,
  checkin: CheckinLite,
  zones: Zone[],
): TodayRange {
  const zoneName = (key: string) => zones.find((z) => z.key === key)?.name ?? "Easy";

  if (!row) {
    return {
      rest: true,
      status: "Rest",
      minMi: 0,
      maxMi: 0,
      headlineMi: 0,
      zoneKey: "easy",
      zoneLabel: zoneName("easy"),
      reason: "Rest day in your plan — cross-train if you feel like it.",
      weekLimit: 0,
    };
  }

  const painSharp = !!row && !!checkin?.pain_note && /sharp|worse|worsening|stab|localis|localiz/i.test(checkin.pain_note);
  const legs = checkin?.leg_feel ?? null;
  const sleep = checkin?.sleep_quality ?? null;
  const whoop = checkin?.whoop_recovery_pct ?? null;
  const avg = legs != null && sleep != null ? (legs + sleep) / 2 : legs;

  // Race day is its own thing: no ranges, no downgrades.
  if (row.workout_type === "race") {
    const mi = Number(row.target_miles);
    return {
      rest: false,
      status: "Go",
      minMi: mi,
      maxMi: mi,
      headlineMi: mi,
      zoneKey: "mp",
      zoneLabel: zoneName("mp"),
      reason: row.purpose ?? "Race day",
      weekLimit: 0,
    };
  }

  const target = Number(row.target_miles);
  let min = row.min_miles != null ? Number(row.min_miles) : round(target * 0.85);
  let max = row.max_miles != null ? Number(row.max_miles) : round(target * 1.1);
  let headline = target;
  let zoneKey = zoneKeyFor(row.workout_type);
  let status: TodayRange["status"] = "Go";
  let reason = row.purpose || row.details || "Run the plan.";

  if (painSharp) {
    return {
      rest: true,
      status: "Rest",
      minMi: 0,
      maxMi: 0,
      headlineMi: 0,
      zoneKey: "easy",
      zoneLabel: zoneName("easy"),
      reason: `You noted ${checkin!.pain_note!.trim().toLowerCase()} — sharp or worsening pain means rest and a physio, not a workaround.`,
      weekLimit: 0,
    };
  }

  if (legs === 1 || sleep === 1 || (whoop != null && whoop < 34)) {
    return {
      rest: true,
      status: "Rest",
      minMi: 0,
      maxMi: 0,
      headlineMi: 0,
      zoneKey: "easy",
      zoneLabel: zoneName("easy"),
      reason: whoop != null && whoop < 34 ? `WHOOP recovery at ${whoop}% — rest or use the minimum only.` : "Check-in is at 1/5 — rest is the productive choice today.",
      weekLimit: 0,
    };
  }

  if (legs === 2 || sleep === 2 || (avg != null && avg <= 2)) {
    max = min;
    zoneKey = "easy";
    status = "Take it easy";
    reason = "Check-in is low, so today is shorter and easy only.";
  } else if (avg != null && avg <= 2.5) {
    max = round(max * 0.9);
    status = "Take it easy";
    reason = "Check-in is a bit flat — stay at the lower end today.";
  }

  // A low check-in intentionally collapses the range to the day's minimum.
  if (status === "Go" && min >= max) min = round(max - 0.5);
  if (min < 1) min = 1;
  headline = round(Math.min(max, Math.max(min, headline)));

  return {
    rest: false,
    status,
    minMi: round(min),
    maxMi: round(max),
    headlineMi: headline,
    zoneKey,
    zoneLabel: zoneName(zoneKey),
    reason,
    weekLimit: 0,
  };
}
