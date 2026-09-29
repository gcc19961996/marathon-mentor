// Effort zones, run labels and warning flags. Pure functions, no network.

import { clockLeftRunning, flagSplits, usableSplits, type SplitRow } from "./splitFlags";
import { formatPace, type Zone } from "./training";

/* ---------- run length ---------- */

export type LengthLabel = "Short run" | "Medium run" | "Long run";

export function runLengthLabel(miles: number): LengthLabel {
  const mi = Number(miles) || 0;
  if (mi >= 10) return "Long run";
  if (mi >= 5) return "Medium run";
  return "Short run";
}

export type EffortKey = "Easy" | "Moderate" | "Fast" | "Tempo" | "Hard";

/** One shared definition of the pace zones: bands, labels and colors. */
export const EFFORT_BANDS: { key: EffortKey; minimum: number; label: string; color: string }[] = [
  { key: "Easy", minimum: 590, label: "Easy 9:50+", color: "var(--chart-1)" },
  { key: "Moderate", minimum: 540, label: "Moderate 9:00–9:49", color: "var(--chart-3)" },
  { key: "Fast", minimum: 516, label: "Fast 8:36–8:59", color: "var(--chart-4)" },
  { key: "Tempo", minimum: 505, label: "Tempo 8:25–8:35", color: "var(--chart-5)" },
  { key: "Hard", minimum: 0, label: "Hard <8:25", color: "var(--chart-2)" },
];

export function effortRangeLabel(effort: EffortKey): string {
  return EFFORT_BANDS.find((band) => band.key === effort)?.label ?? effort;
}

export function effortColor(effort: EffortKey): string {
  return EFFORT_BANDS.find((band) => band.key === effort)?.color ?? "var(--muted-foreground)";
}


/** Neutral description of how hard a run actually was. */
export function effortFor(paceSeconds: number | null | undefined, _zones?: Zone[]): EffortKey | null {
  if (!paceSeconds) return null;
  return EFFORT_BANDS.find((band) => paceSeconds >= band.minimum)?.key ?? "Hard";
}

export function isRaceRun(run: { date: string; distance_mi: number; type?: string | null }): boolean {
  return run.type === "Race" || (run.date === "2026-04-26" && Number(run.distance_mi) >= 13.1 && Number(run.distance_mi) <= 13.8);
}

/* ---------- warning flags ---------- */

export type FlagRun = {
  date: string;
  distance_mi: number;
  avg_pace_seconds: number | null;
  duration_seconds?: number | null;
  elapsed_seconds?: number | null;
  type?: string | null;
  strava_activity_id?: number | null;
  max_speed_mph?: number | null;
};

const dayBefore = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const PLAN_START = "2026-09-14";

/** True when the run carries a workout label the user or Strava set. */
function hasWorkout(run: FlagRun): boolean {
  const t = (run.type ?? "").trim();
  return t !== "" && t !== "Easy Run";
}

function hasChosenQualityWorkout(run: FlagRun): boolean {
  const type = (run.type ?? "").trim().toLowerCase();
  return type === "tempo" || type === "strides" || type === "mp" || type === "marathon-pace" || type === "marathon-pace run" || type === "mp workout";
}

/** Amber warnings, only when they are actually true. */
export function runFlags(
  run: FlagRun,
  allRuns: FlagRun[],
  zones: Zone[],
  splitsByActivity?: Map<number, SplitRow[]>,
): string[] {
  const flags: string[] = [];
  if (isRaceRun(run)) return flags;
  const pace = run.avg_pace_seconds;
  const altitudeDay = run.date === "2026-09-25";
  if (
    clockLeftRunning({
      distance_mi: Number(run.distance_mi),
      duration_seconds: Number(run.duration_seconds ?? 0),
      avg_pace_seconds: run.avg_pace_seconds ?? null,
      elapsed_seconds: run.elapsed_seconds ?? null,
    })
  ) {
    flags.push("Clock left running");
  }


  // At most one speed warning per run, chosen by run length.
  const length = runLengthLabel(run.distance_mi);
  if (!altitudeDay && pace) {
    if (length === "Short run") {
      if (pace < 505 && !hasChosenQualityWorkout(run) && run.date >= PLAN_START) flags.push("Short faster than 8:25");
    } else if (length === "Medium run") {
      if (pace < 590 && !hasWorkout(run) && run.date >= PLAN_START) flags.push("Medium faster than 9:50");
    } else if (pace < 590 && !hasWorkout(run)) {
      flags.push("Long faster than 9:50");
    }
  }

  if (pace && pace < 540) {
    const prev = dayBefore(run.date);
    const fastYesterday = allRuns.some(
      (r) => !isRaceRun(r) && r.date === prev && r.avg_pace_seconds != null && r.avg_pace_seconds < 540,
    );
    if (fastYesterday) flags.push("Back-to-back fast days");
  }

  const from = new Date(`${run.date}T00:00:00`);
  from.setDate(from.getDate() - 14);
  const windowStart = from.toISOString().slice(0, 10);
  const longestBefore = allRuns
    .filter((r) => !isRaceRun(r) && r.date >= windowStart && r.date < run.date)
    .reduce((m, r) => Math.max(m, Number(r.distance_mi)), 0);
  if (longestBefore > 0 && Number(run.distance_mi) > longestBefore * 1.3) {
    flags.push("Big jump");
  }

  const rows = run.strava_activity_id ? splitsByActivity?.get(Number(run.strava_activity_id)) : null;
  // Suspect splits (stops, GPS spikes) are left out of the fade check.
  const paces = rows
    ? usableSplits(
        flagSplits(
          {
            distance_mi: Number(run.distance_mi),
            duration_seconds: Number(run.duration_seconds ?? 0),
            avg_pace_seconds: run.avg_pace_seconds ?? null,
            elapsed_seconds: run.elapsed_seconds ?? null,
          },
          rows,
        ),
      ).map((s) => s.pace)
    : [];
  if (paces.length >= 4) {
    const half = Math.floor(paces.length / 2);
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const first = avg(paces.slice(0, half));
    const second = avg(paces.slice(half));
    if (second - first > 20) flags.push("Faded late");
  }

  return flags;
}

/* ---------- weekly easy-miles summary ---------- */

export function weeklyEffortSummary(runs: FlagRun[], zones: Zone[]): string | null {
  const withPace = runs.filter((r) => r.avg_pace_seconds);
  if (!withPace.length || !zones.length) return null;
  const easy = withPace.filter((r) => effortFor(r.avg_pace_seconds, zones) === "Easy").length;
  return easy === withPace.length
    ? `${easy} of ${withPace.length} runs at easy pace (9:50–10:20)`
    : `${easy} of ${withPace.length} runs at easy pace (9:50–10:20) — slow easy days down`;
}

export function paceLabel(seconds: number | null | undefined): string {
  return formatPace(seconds);
}
