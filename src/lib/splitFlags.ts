// Stops, recording gaps and unreliable splits.
// Moving time is always the basis for pace; these flags are display and
// analysis only and never change a run's distance or weekly mileage.

export type SplitFlag = "too_fast" | "too_slow" | "gap";

export type SplitRow = {
  strava_activity_id: number;
  mile_number: number;
  /** Moving seconds for the split as Strava reported it. */
  pace_seconds: number;
  distance_mi: number | null;
  moving_seconds: number | null;
  elapsed_seconds: number | null;
  heart_rate: number | null;
  flag: SplitFlag | null;
  flag_reason: string | null;
};

export type FlaggedSplit = {
  mile: number;
  /** Distance of this split in miles. */
  distance: number;
  /** Moving pace per mile. */
  pace: number;
  moving: number;
  elapsed: number | null;
  stopped: number | null;
  heartRate: number | null;
  /** Final part-mile remainder. */
  partial: boolean;
  flag: SplitFlag | null;
  reason: string | null;
};

export type RunLike = {
  distance_mi: number;
  duration_seconds: number;
  avg_pace_seconds: number | null;
  elapsed_seconds?: number | null;
};

/* ---------- thresholds ---------- */

export const STOP_DISPLAY_SECONDS = 60;
export const CLOCK_LEFT_RUNNING_RATIO = 0.2;
export const CLOCK_LEFT_RUNNING_SECONDS = 600;
const SPLIT_STOP_SECONDS = 60;
const SLOW_RATIO = 1.5;
const SLOW_VS_NEIGHBOURS = 150; // 2:30/mi
const FAST_FLOOR = 360; // 6:00/mi
const FAST_RATIO = 0.65; // >35% faster than the run average
const FAST_VS_NEIGHBOURS = 120; // 2:00/mi
export const PARTIAL_SPLIT_MI = 0.3;
export const GAP_SECONDS = 60;

export function flagLabel(flag: SplitFlag | null): string | null {
  if (flag === "too_fast") return "Suspect split · too fast";
  if (flag === "too_slow") return "Suspect split · too slow";
  if (flag === "gap") return "Recording gap";
  return null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Moving pace of a run, from its own average or its time over its distance. */
export function runAveragePace(run: RunLike): number | null {
  if (run.avg_pace_seconds) return Number(run.avg_pace_seconds);
  const miles = Number(run.distance_mi || 0);
  const seconds = Number(run.duration_seconds || 0);
  return miles > 0 && seconds > 0 ? seconds / miles : null;
}

/** Seconds the clock ran while the run was stopped, when it is known. */
export function stoppedSeconds(run: RunLike): number | null {
  const elapsed = Number(run.elapsed_seconds ?? 0);
  const moving = Number(run.duration_seconds ?? 0);
  if (!elapsed || !moving || elapsed <= moving) return null;
  return elapsed - moving;
}

/** "Clock left running": a lot of the recording was not running at all. */
export function clockLeftRunning(run: RunLike): boolean {
  const stopped = stoppedSeconds(run) ?? 0;
  const moving = Number(run.duration_seconds ?? 0);
  if (!moving) return false;
  return stopped > moving * CLOCK_LEFT_RUNNING_RATIO || stopped > CLOCK_LEFT_RUNNING_SECONDS;
}

/**
 * Splits of one run with a distance, a moving pace and, where warranted, a
 * "suspect split" flag. Stored flags of type "gap" (confirmed from the
 * activity's stream) always win, because they were verified against the
 * recording itself.
 */
export function flagSplits(run: RunLike, rows: SplitRow[]): FlaggedSplit[] {
  const ordered = [...rows].sort((a, b) => a.mile_number - b.mile_number);
  if (!ordered.length) return [];
  const total = Number(run.distance_mi || 0);
  const avg = runAveragePace(run);

  const base = ordered.map((row, i) => {
    const last = i === ordered.length - 1;
    const remainder = total - i;
    const distance =
      row.distance_mi != null && Number(row.distance_mi) > 0
        ? Number(row.distance_mi)
        : last
          ? Math.min(1, Math.max(remainder, 0.01))
          : 1;
    const moving = Number(row.moving_seconds ?? row.pace_seconds ?? 0);
    const elapsed = row.elapsed_seconds != null ? Number(row.elapsed_seconds) : null;
    return {
      mile: row.mile_number,
      distance,
      moving,
      elapsed,
      stopped: elapsed != null && elapsed > moving ? elapsed - moving : null,
      heartRate: row.heart_rate ?? null,
      pace: distance > 0 ? moving / distance : moving,
      partial: distance < PARTIAL_SPLIT_MI,
      stored: row.flag,
      storedReason: row.flag_reason,
    };
  });

  const fullPaces = base.filter((s) => !s.partial).map((s) => s.pace);

  return base.map((s, i): FlaggedSplit => {
    const neighbours = base
      .filter((o, j) => j !== i && !o.partial && Math.abs(j - i) <= 2)
      .map((o) => o.pace);
    const nb = median(neighbours.length ? neighbours : fullPaces);

    let flag: SplitFlag | null = null;
    let reason: string | null = null;

    const stopGap = s.stopped != null && s.stopped > SPLIT_STOP_SECONDS;
    const slowVsRun = avg != null && s.pace > avg * SLOW_RATIO;
    const slowVsNeighbours = nb != null && s.pace >= nb + SLOW_VS_NEIGHBOURS;
    if (stopGap) {
      flag = "too_slow";
      reason = `clock stopped ${Math.round(s.stopped as number)}s inside this mile`;
    } else if (slowVsRun && slowVsNeighbours) {
      flag = "too_slow";
      reason = "much slower than the run and the miles either side";
    } else if (
      s.pace < FAST_FLOOR ||
      (avg != null && s.pace < avg * FAST_RATIO) ||
      (nb != null && s.pace <= nb - FAST_VS_NEIGHBOURS)
    ) {
      flag = "too_fast";
      reason = "faster than the run and the miles either side can support";
    }

    // A confirmed recording gap outranks the guess it was based on.
    if (s.stored === "gap" && flag) {
      flag = "gap";
      reason = s.storedReason ?? "no GPS points for over a minute — distance may be undercounted";
    }

    return {
      mile: s.mile,
      distance: s.distance,
      pace: Math.round(s.pace),
      moving: s.moving,
      elapsed: s.elapsed,
      stopped: s.stopped,
      heartRate: s.heartRate,
      partial: s.partial,
      flag,
      reason,
    };
  });
}

/** Splits that count for pace statistics: not suspect, not the part-mile end. */
export function usableSplits(splits: FlaggedSplit[]): FlaggedSplit[] {
  return splits.filter((s) => !s.flag && !s.partial);
}

export function formatStop(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  if (m >= 60)
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
