// Pace analysis (beta): pure calculations over synced runs and per-mile splits.
// Zone definitions and colors come from ./effort — no duplicates here.

import { EFFORT_BANDS, effortFor, isRaceRun, runLengthLabel, type EffortKey } from "./effort";
import { flagSplits, usableSplits, type FlaggedSplit, type SplitRow } from "./splitFlags";
import { MARATHON_MI } from "./training";

export type AnalysisRun = {
  id?: string;
  date: string;
  type: string;
  distance_mi: number;
  duration_seconds: number;
  avg_pace_seconds: number | null;
  elapsed_seconds?: number | null;
  strava_activity_id: number | null;
};

export type SplitsByActivity = Map<number, SplitRow[]>;

/** Every split of a run, with its distance, moving pace and any flag. */
export function runFlaggedSplits(run: AnalysisRun, splitsByActivity: SplitsByActivity): FlaggedSplit[] {
  if (!run.strava_activity_id) return [];
  const rows = splitsByActivity.get(Number(run.strava_activity_id));
  if (!rows?.length) return [];
  return flagSplits(run, rows);
}

export type RangeKey = "4w" | "3m" | "12m";

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: "4w", label: "Last 4 weeks", days: 28 },
  { key: "3m", label: "3 months", days: 92 },
  { key: "12m", label: "12 months", days: 365 },
];

export function rangeStart(today: string, range: RangeKey): string {
  const days = RANGE_OPTIONS.find((o) => o.key === range)?.days ?? 92;
  const d = new Date(`${today}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function inRange(runs: AnalysisRun[], from: string, to: string): AnalysisRun[] {
  return runs.filter((r) => r.date >= from && r.date <= to);
}

/* ---------- pace vs distance ---------- */

export type PaceDistanceComparison = "previous" | "last-year" | "off";
export type PaceDistancePoint = {
  id: string;
  date: string;
  distance: number;
  pace: number;
  type: string;
  race: boolean;
  period: "current" | "comparison";
  trendPace: number | null;
};
export type PaceDistanceFit = {
  intercept: number;
  slope: number;
  minDistance: number;
  maxDistance: number;
  count: number;
  averageDistance: number;
  logDistanceMean: number;
  logDistanceSpread: number;
  standardError: number | null;
};
export type PaceDistanceTrendPoint = { distance: number; pace: number; band?: [number, number] };
export type LikeForLikeRow = {
  label: string;
  currentPace: number | null;
  currentCount: number;
  comparisonPace: number | null;
  comparisonCount: number;
  difference: number | null;
};

const TEN_K_MI = 10000 / 1609.344;

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function shiftYear(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function periodRangeLabel(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const left = a.toLocaleDateString("en-US", { month: "short" });
  const right = b.toLocaleDateString("en-US", { month: "short" });
  return `${left}–${right}${a.getFullYear() !== b.getFullYear() ? ` ${a.getFullYear()}–${String(b.getFullYear()).slice(-2)}` : ` ${b.getFullYear()}`}`;
}

export function comparisonWindow(
  from: string,
  to: string,
  mode: PaceDistanceComparison,
): { from: string; to: string; label: string } | null {
  if (mode === "off") return null;
  let comparisonFrom: string;
  let comparisonTo: string;
  if (mode === "last-year") {
    comparisonFrom = shiftYear(from, -1);
    comparisonTo = shiftYear(to, -1);
  } else {
    const days = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1;
    comparisonTo = shiftDate(from, -1);
    comparisonFrom = shiftDate(comparisonTo, -(days - 1));
  }
  return { from: comparisonFrom, to: comparisonTo, label: periodRangeLabel(comparisonFrom, comparisonTo) };
}

function runPace(run: AnalysisRun, normalized: boolean): number | null {
  const distance = Number(run.distance_mi);
  const seconds = Number(run.duration_seconds);
  if (!(distance > 0) || !(seconds > 0)) return null;
  if (!normalized) return seconds / distance;
  const equivalentSeconds = seconds * Math.pow(TEN_K_MI / distance, 1.06);
  return equivalentSeconds / TEN_K_MI;
}

export function fitPaceDistance(runs: AnalysisRun[], normalized: boolean): PaceDistanceFit | null {
  const points = runs
    .filter((run) => !isRaceRun(run))
    .map((run) => ({ x: Math.log(Number(run.distance_mi)), distance: Number(run.distance_mi), y: runPace(run, normalized) }))
    .filter((point): point is { x: number; distance: number; y: number } => Number.isFinite(point.x) && point.y != null && Number.isFinite(point.y));
  if (points.length < 5) return null;
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const sxx = points.reduce((sum, point) => sum + Math.pow(point.x - xMean, 2), 0);
  const slope = sxx > 0 ? points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / sxx : 0;
  const intercept = yMean - slope * xMean;
  const residual = points.reduce((sum, point) => sum + Math.pow(point.y - (intercept + slope * point.x), 2), 0);
  return {
    intercept,
    slope,
    minDistance: Math.min(...points.map((point) => point.distance)),
    maxDistance: Math.max(...points.map((point) => point.distance)),
    count: points.length,
    averageDistance: points.reduce((sum, point) => sum + point.distance, 0) / points.length,
    logDistanceMean: xMean,
    logDistanceSpread: sxx,
    standardError: points.length >= 8 ? Math.sqrt(residual / Math.max(1, points.length - 2)) : null,
  };
}

export function paceAtDistance(fit: PaceDistanceFit | null, distance: number): number | null {
  if (!fit || !(distance > 0)) return null;
  return fit.intercept + fit.slope * Math.log(distance);
}

export function paceDistanceTrend(fit: PaceDistanceFit | null): PaceDistanceTrendPoint[] {
  if (!fit) return [];
  const points: PaceDistanceTrendPoint[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const distance = Math.exp(Math.log(fit.minDistance) + ratio * (Math.log(fit.maxDistance) - Math.log(fit.minDistance)));
    const pace = paceAtDistance(fit, distance) ?? 0;
    const x = Math.log(distance);
    const confidenceFactor = fit.logDistanceSpread > 0
      ? Math.sqrt(1 / fit.count + Math.pow(x - fit.logDistanceMean, 2) / fit.logDistanceSpread)
      : Math.sqrt(1 / fit.count);
    const margin = fit.standardError == null ? null : 1.96 * fit.standardError * confidenceFactor;
    points.push({ distance, pace, ...(margin == null ? {} : { band: [pace - margin, pace + margin] as [number, number] }) });
  }
  return points;
}

export function paceDistancePoints(
  runs: AnalysisRun[],
  normalized: boolean,
  period: "current" | "comparison",
  fit: PaceDistanceFit | null,
): PaceDistancePoint[] {
  return runs.flatMap((run) => {
    const pace = runPace(run, normalized);
    const distance = Number(run.distance_mi);
    if (pace == null || !(distance > 0)) return [];
    return [{
      id: run.id ?? `${run.date}-${distance}`,
      date: run.date,
      distance,
      pace,
      type: run.type,
      race: isRaceRun(run),
      period,
      trendPace: fit && distance >= fit.minDistance && distance <= fit.maxDistance ? paceAtDistance(fit, distance) : null,
    }];
  });
}

const DISTANCE_BUCKETS = [
  { label: "<4 mi", min: 0, max: 4 },
  { label: "4–6 mi", min: 4, max: 6 },
  { label: "6–8 mi", min: 6, max: 8 },
  { label: "8–12 mi", min: 8, max: 12 },
  { label: "12+ mi", min: 12, max: Number.POSITIVE_INFINITY },
];

export function likeForLike(current: AnalysisRun[], comparison: AnalysisRun[]): LikeForLikeRow[] {
  const cell = (source: AnalysisRun[], min: number, max: number) => {
    const selected = source.filter((run) => !isRaceRun(run) && run.distance_mi >= min && run.distance_mi < max && run.distance_mi > 0 && run.duration_seconds > 0);
    const miles = selected.reduce((sum, run) => sum + Number(run.distance_mi), 0);
    const seconds = selected.reduce((sum, run) => sum + Number(run.duration_seconds), 0);
    return { count: selected.length, pace: miles > 0 ? seconds / miles : null };
  };
  return DISTANCE_BUCKETS.flatMap((bucket) => {
    const a = cell(current, bucket.min, bucket.max);
    const b = cell(comparison, bucket.min, bucket.max);
    if (!a.count && !b.count) return [];
    return [{
      label: bucket.label,
      currentPace: a.pace,
      currentCount: a.count,
      comparisonPace: b.pace,
      comparisonCount: b.count,
      difference: a.pace != null && b.pace != null ? Math.round(a.pace - b.pace) : null,
    }];
  });
}

/* ---------- summary ---------- */

export type PaceSummary = {
  runs: number;
  miles: number;
  avgPace: number | null;
  pctEasyMiles: number | null;
  longestMi: number;
};

export function paceSummary(runs: AnalysisRun[], splitMiles: SplitMile[]): PaceSummary {
  const miles = runs.reduce((s, r) => s + Number(r.distance_mi || 0), 0);
  const seconds = runs.reduce((s, r) => s + Number(r.duration_seconds || 0), 0);
  const easySplits = splitMiles.filter((m) => effortFor(m.pace) === "Easy").length;
  return {
    runs: runs.length,
    miles: Math.round(miles * 10) / 10,
    avgPace: miles > 0 && seconds > 0 ? Math.round(seconds / miles) : null,
    pctEasyMiles: splitMiles.length > 0 ? Math.round((easySplits / splitMiles.length) * 100) : null,
    longestMi: runs.reduce((m, r) => Math.max(m, Number(r.distance_mi || 0)), 0),
  };
}

/* ---------- pace trend ---------- */

export type TrendType = "Short" | "Medium" | "Long" | "All runs";

export const TREND_TYPES: TrendType[] = ["Short", "Medium", "Long", "All runs"];

export const TREND_COLORS: Record<TrendType, string> = {
  Short: "var(--chart-4)",
  Medium: "var(--chart-1)",
  Long: "var(--chart-2)",
  "All runs": "var(--muted-foreground)",
};

function typeOf(run: AnalysisRun): TrendType {
  const label = runLengthLabel(run.distance_mi);
  return label === "Long run" ? "Long" : label === "Medium run" ? "Medium" : "Short";
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d.toISOString().slice(0, 10);
}

export type TrendPoint = {
  period: string;
  label: string;
  values: Partial<Record<TrendType, { pace: number; runs: number; miles: number }>>;
};

/** One point per week (4w / 3m) or per month (12m); races excluded. */
export function paceTrend(
  runs: AnalysisRun[],
  range: RangeKey,
  types: TrendType[],
  from?: string,
  to?: string,
): TrendPoint[] {
  const monthly = range === "12m";
  const usable = runs.filter((r) => !isRaceRun(r) && Number(r.distance_mi) > 0 && Number(r.duration_seconds) > 0);
  const buckets = new Map<string, Map<TrendType, { seconds: number; miles: number; runs: number }>>();

  for (const run of usable) {
    const period = monthly ? run.date.slice(0, 7) : mondayOf(run.date);
    const runTypes: TrendType[] = [typeOf(run), "All runs"];
    for (const t of runTypes) {
      if (!types.includes(t)) continue;
      const byType = buckets.get(period) ?? new Map();
      const cell = byType.get(t) ?? { seconds: 0, miles: 0, runs: 0 };
      cell.seconds += Number(run.duration_seconds);
      cell.miles += Number(run.distance_mi);
      cell.runs += 1;
      byType.set(t, cell);
      buckets.set(period, byType);
    }
  }

  const periods =
    from && to ? periodsBetween(from, to, monthly) : [...buckets.keys()].sort((a, b) => a.localeCompare(b));

  return periods
    .map((period) => {
      const byType =
        buckets.get(period) ?? new Map<TrendType, { seconds: number; miles: number; runs: number }>();
      const values: TrendPoint["values"] = {};
      for (const [t, cell] of byType) {
        if (cell.miles > 0) {
          values[t] = {
            pace: Math.round(cell.seconds / cell.miles),
            runs: cell.runs,
            miles: Math.round(cell.miles * 10) / 10,
          };
        }
      }
      return { period, label: periodLabel(period, monthly), values };
    });
}

/** Every week (Monday) or month between two dates, so the axis stays continuous. */
export function periodsBetween(from: string, to: string, monthly: boolean): string[] {
  const out: string[] = [];
  if (monthly) {
    const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00`);
    const end = new Date(`${to.slice(0, 7)}-01T00:00:00`);
    while (cursor <= end) {
      out.push(cursor.toISOString().slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }
  const cursor = new Date(`${mondayOf(from)}T00:00:00`);
  const end = new Date(`${mondayOf(to)}T00:00:00`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

function periodLabel(period: string, monthly: boolean): string {
  const d = new Date(`${monthly ? `${period}-01` : period}T00:00:00`);
  return monthly
    ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ---------- miles from splits ---------- */

export type SplitMile = { date: string; pace: number };

export type SplitMiles = { miles: SplitMile[]; excluded: number; tooFast: number; tooSlow: number };

/** Splits of one run that count for pace statistics. */
export function runSplitPaces(run: AnalysisRun, splitsByActivity: SplitsByActivity): number[] {
  return usableSplits(runFlaggedSplits(run, splitsByActivity)).map((s) => s.pace);
}

/**
 * Every per-mile split inside the range that can be trusted, with the date of
 * its run. Suspect splits keep their distance in mileage totals but are left
 * out of pace statistics.
 */
export function splitMiles(runs: AnalysisRun[], splitsByActivity: SplitsByActivity): SplitMiles {
  const out: SplitMile[] = [];
  let tooFast = 0;
  let tooSlow = 0;
  for (const run of runs) {
    for (const split of runFlaggedSplits(run, splitsByActivity)) {
      if (split.flag === "too_fast") tooFast++;
      else if (split.flag === "too_slow" || split.flag === "gap") tooSlow++;
      if (split.flag || split.partial) continue;
      out.push({ date: run.date, pace: split.pace });
    }
  }
  return { miles: out, excluded: tooFast + tooSlow, tooFast, tooSlow };
}

export type Bucket = { pace: number; label: string; miles: number; color: string; zone: EffortKey };

function bucketLabel(pace: number): string {
  return `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")}`;
}

/** Miles per 15-second pace bucket; every bucket between fastest and slowest is present. */
export function paceDistribution(miles: SplitMile[]): Bucket[] {
  if (miles.length === 0) return [];
  const counts = new Map<number, number>();
  for (const m of miles) {
    const bucket = Math.floor(m.pace / 15) * 15;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const keys = [...counts.keys()];
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const out: Bucket[] = [];
  for (let pace = first; pace <= last; pace += 15) {
    const zone = effortFor(pace) ?? "Hard";
    out.push({
      pace,
      label: bucketLabel(pace),
      miles: counts.get(pace) ?? 0,
      zone,
      color: EFFORT_BANDS.find((b) => b.key === zone)?.color ?? "var(--chart-1)",
    });
  }
  return out;
}


export type ZoneSlice = { zone: EffortKey; miles: number; pct: number; color: string };

export function zoneMix(miles: SplitMile[]): ZoneSlice[] {
  const total = miles.length;
  return EFFORT_BANDS.map((band) => {
    const count = miles.filter((m) => (effortFor(m.pace) ?? "Hard") === band.key).length;
    return {
      zone: band.key,
      miles: count,
      pct: total ? Math.round((count / total) * 100) : 0,
      color: band.color,
    };
  });
}

/* ---------- best efforts (from Strava) ---------- */

export type BestEffortRow = {
  strava_activity_id: number;
  name: string;
  distance_m: number;
  seconds: number;
};

export type BestEffort = { label: string; date: string; seconds: number; pace: number } | null;

const EFFORT_DISTANCES: { label: string; name: string; distance: number }[] = [
  { label: "Fastest mile", name: "1 mile", distance: 1 },
  { label: "Fastest 5K", name: "5k", distance: 3.10686 },
  { label: "Fastest 10K", name: "10k", distance: 6.21371 },
];

/** 6:00/mi — nothing faster than this is treated as a real effort. */
const EFFORT_FLOOR = 360;

/**
 * Strava's own best efforts, fastest in range. An effort is dropped when it
 * implies a pace faster than 6:00/mi, or when it sits inside a split that was
 * flagged "too fast".
 */
export function bestEfforts(
  runs: AnalysisRun[],
  rows: BestEffortRow[],
  splitsByActivity?: SplitsByActivity,
): BestEffort[] {
  const runById = new Map<number, AnalysisRun>();
  for (const run of runs) {
    if (run.strava_activity_id) runById.set(Number(run.strava_activity_id), run);
  }
  return EFFORT_DISTANCES.map(({ label, name, distance }) => {
    let best: BestEffort = null;
    for (const row of rows) {
      if ((row.name ?? "").trim().toLowerCase() !== name) continue;
      const run = runById.get(Number(row.strava_activity_id));
      if (!run) continue;
      const pace = row.seconds / distance;
      if (pace < EFFORT_FLOOR) continue;
      if (splitsByActivity) {
        const splits = runFlaggedSplits(run, splitsByActivity);
        const fastestClean = usableSplits(splits).reduce(
          (m, s) => Math.min(m, s.pace),
          Number.POSITIVE_INFINITY,
        );
        // A "too fast" split is the only way the effort could beat every
        // believable mile of the same run by a clear margin.
        if (splits.some((s) => s.flag === "too_fast") && pace < fastestClean - 20) continue;
      }
      if (!best || row.seconds < best.seconds) {
        best = { label, date: run.date, seconds: Math.round(row.seconds), pace: Math.round(pace) };
      }
    }
    return best;
  });
}

/* ---------- predicted finish from training ---------- */

export type TrainingPrediction = {
  seconds: number;
  low: number;
  high: number;
  basis: { effort: string; date: string; pace: number; longestMi: number; weeklyMi: number };
} | null;

/** Same 0.2 mi tolerance as the milestones: 15.9 mi counts as a 16-miler. */
export const ENDURANCE_TOLERANCE_MI = 0.2;

export function predictFromTraining(
  runs: AnalysisRun[],
  bestEffortRows: BestEffortRow[],
  today: string,
  splitsByActivity?: SplitsByActivity,
): TrainingPrediction {
  const since = (days: number) => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  const recent = runs.filter((r) => r.date >= since(84) && r.date <= today);
  const efforts = bestEfforts(recent, bestEffortRows, splitsByActivity);
  const tenK = efforts[2];
  const fiveK = efforts[1];
  const base = tenK ?? fiveK;
  if (!base) return null;
  const baseDistance = base.label === "Fastest 10K" ? 6.21371 : 3.10686;

  let seconds = base.seconds * Math.pow(MARATHON_MI / baseDistance, 1.06);

  const longestMi = runs
    .filter((r) => r.date >= since(42) && r.date <= today)
    .reduce((m, r) => Math.max(m, Number(r.distance_mi || 0)), 0);
  if (longestMi < 16 - ENDURANCE_TOLERANCE_MI) seconds *= 1.04;
  else if (longestMi < 20 - ENDURANCE_TOLERANCE_MI) seconds *= 1.02;

  const fourWeekMiles = runs
    .filter((r) => r.date >= since(28) && r.date <= today)
    .reduce((s, r) => s + Number(r.distance_mi || 0), 0);
  const weeklyMi = Math.round((fourWeekMiles / 4) * 10) / 10;
  if (weeklyMi < 25) seconds *= 1.03;
  else if (weeklyMi <= 35) seconds *= 1.015;

  seconds = Math.round(seconds);
  return {
    seconds,
    low: Math.round(seconds * 0.97),
    high: Math.round(seconds * 1.03),
    basis: {
      effort: base.label.replace("Fastest ", "Best "),
      date: base.date,
      pace: base.pace,
      longestMi: Math.round(longestMi * 10) / 10,
      weeklyMi,
    },
  };
}

/* ---------- predicted finish over time ---------- */

export type PredictionPoint = {
  week: string;
  label: string;
  seconds: number;
  low: number;
  high: number;
  basis: NonNullable<TrainingPrediction>["basis"];
};

/** One training-based prediction per Monday, using only data up to that week. */
export function predictionTrend(
  allRuns: AnalysisRun[],
  bestEffortRows: BestEffortRow[],
  from: string,
  today: string,
  splitsByActivity?: SplitsByActivity,
): PredictionPoint[] {
  const out: PredictionPoint[] = [];
  const cursor = new Date(`${mondayOf(from)}T00:00:00`);
  const end = new Date(`${today}T00:00:00`);
  while (cursor <= end) {
    const asOf = cursor.toISOString().slice(0, 10);
    const p = predictFromTraining(allRuns, bestEffortRows, asOf, splitsByActivity);
    if (p) {
      out.push({
        week: asOf,
        label: periodLabel(asOf, false),
        seconds: p.seconds,
        low: p.low,
        high: p.high,
        basis: p.basis,
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

/* ---------- key takeaway ---------- */

export type KeyTakeawayContext = {
  currentEight: number | null;
  comparisonEight: number | null;
  comparisonLabel: string | null;
  currentAvgDistance: number | null;
  comparisonAvgDistance: number | null;
  pctEasyMiles: number | null;
  easyBand: { from: number; to: number };
  rangeEfforts: BestEffort[];
  allEfforts: BestEffort[];
  rangeFrom: string;
  latestLongRun: LongRunRow | null;
  longestInRangeRun: AnalysisRun | null;
  longestAllMi: number;
  summary: PaceSummary;
};

function clockOnly(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function paceText(seconds: number): string {
  return clockOnly(seconds);
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EFFORT_NAMES = ["mile", "5K", "10K"];

/**
 * The single most notable fact for the selected range, first match wins:
 * trend shift, easy-mile share, a new best effort, a faded long run, a
 * longest-run record, otherwise a plain period summary.
 */
export function keyTakeaway(ctx: KeyTakeawayContext): string | null {
  // 1) trend shift at 8 mi vs the comparison period
  if (ctx.currentEight != null && ctx.comparisonEight != null && ctx.comparisonLabel) {
    const gap = Math.round(ctx.currentEight - ctx.comparisonEight);
    if (Math.abs(gap) >= 10) {
      const a = ctx.currentAvgDistance?.toFixed(1) ?? "—";
      const b = ctx.comparisonAvgDistance?.toFixed(1) ?? "—";
      return gap > 0
        ? `You're running longer but slower: 8 mi trend ${paceText(ctx.currentEight)} now vs ${paceText(ctx.comparisonEight)} in ${ctx.comparisonLabel}, average run ${a} mi vs ${b} mi.`
        : `Your trend is faster: 8 mi ${paceText(ctx.currentEight)} now vs ${paceText(ctx.comparisonEight)} in ${ctx.comparisonLabel}, average run ${a} mi vs ${b} mi.`;
    }
  }

  // 2) easy-mile share under 50%
  if (ctx.pctEasyMiles != null && ctx.pctEasyMiles < 50) {
    return `Only ${ctx.pctEasyMiles}% of your miles are in the easy range (${paceText(ctx.easyBand.from)}–${paceText(ctx.easyBand.to)}) — the plan asks for most of them.`;
  }

  // 3) a new best effort set inside the range
  for (let i = 0; i < ctx.allEfforts.length; i++) {
    const all = ctx.allEfforts[i];
    if (!all || all.date < ctx.rangeFrom) continue;
    const inRange = ctx.rangeEfforts[i];
    if (!inRange || inRange.seconds > all.seconds) continue;
    return `New best ${EFFORT_NAMES[i]} in this period: ${clockOnly(all.seconds)} on ${dayLabel(all.date)}.`;
  }

  // 4) the most recent long run faded
  const latest = ctx.latestLongRun;
  if (latest?.verdict === "faded" && latest.diff != null) {
    return `Your last long run faded ${Math.round(latest.diff)} s/mi in the second half.`;
  }

  // 5) the longest run of the whole cycle happened in this range
  const longest = ctx.longestInRangeRun;
  if (longest && ctx.longestAllMi > 0 && ctx.summary.longestMi >= ctx.longestAllMi - 0.05) {
    const pace = longest.avg_pace_seconds ?? Number(longest.duration_seconds) / Number(longest.distance_mi);
    return `Longest run of the cycle: ${ctx.summary.longestMi.toFixed(1)} mi on ${dayLabel(longest.date)} at ${paceText(pace)}/mi.`;
  }

  // 6) fallback
  if (ctx.summary.runs === 0) return null;
  const avg = ctx.summary.avgPace != null ? paceText(ctx.summary.avgPace) : null;
  return `${ctx.summary.runs} runs · ${ctx.summary.miles.toFixed(1)} mi in this period${avg ? ` · average ${avg}/mi` : ""}.`;
}

/* ---------- long-run check ---------- */

export type LongRunRow = {
  id?: string | undefined;
  date: string;
  miles: number;
  avgPace: number | null;
  firstHalf: number | null;
  secondHalf: number | null;
  /** Halves including suspect splits, shown in brackets when they differ. */
  rawFirstHalf: number | null;
  rawSecondHalf: number | null;
  diff: number | null;
  slowestMile: number | null;
  excluded: number;
  verdict: "faded" | "even" | "negative" | null;
};

type Segment = { dist: number; pace: number };

/** First/second-half pace, splitting at half the distance covered. */
function halves(segs: Segment[]): { first: number | null; second: number | null } {
  const totalDist = segs.reduce((s, x) => s + x.dist, 0);
  if (totalDist <= 0) return { first: null, second: null };
  const halfDist = totalDist / 2;
  let dist = 0;
  let firstTime = 0;
  let totalTime = 0;
  for (const seg of segs) {
    const before = dist;
    dist += seg.dist;
    totalTime += seg.pace * seg.dist;
    if (before >= halfDist) continue;
    firstTime += seg.pace * Math.min(seg.dist, halfDist - before);
  }
  return {
    first: Math.round(firstTime / halfDist),
    second: Math.round((totalTime - firstTime) / (totalDist - halfDist)),
  };
}

/** Long runs (10+ mi, races excluded) with first/second-half pace split at half the distance. */
export function longRunCheck(runs: AnalysisRun[], splitsByActivity: SplitsByActivity): LongRunRow[] {
  return runs
    .filter((r) => !isRaceRun(r) && Number(r.distance_mi) >= 10)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((run) => {
      const splits = runFlaggedSplits(run, splitsByActivity);
      const all: Segment[] = splits.map((s) => ({ dist: s.distance, pace: s.pace }));
      const clean: Segment[] = usableSplits(splits).map((s) => ({ dist: s.distance, pace: s.pace }));
      const excluded = splits.filter((s) => s.flag).length;

      const cleanHalves = halves(clean.length ? clean : all);
      const rawHalves = halves(all);
      const diff =
        cleanHalves.first != null && cleanHalves.second != null
          ? cleanHalves.second - cleanHalves.first
          : null;
      const fullMiles = usableSplits(splits)
        .filter((s) => s.distance >= 0.9)
        .map((s) => s.pace);

      return {
        id: run.id,
        date: run.date,
        miles: Number(run.distance_mi),
        avgPace: run.avg_pace_seconds ?? null,
        firstHalf: cleanHalves.first,
        secondHalf: cleanHalves.second,
        rawFirstHalf: rawHalves.first,
        rawSecondHalf: rawHalves.second,
        diff,
        slowestMile: fullMiles.length ? Math.round(Math.max(...fullMiles)) : null,
        excluded,
        verdict: diff == null ? null : diff < 0 ? "negative" : diff <= 10 ? "even" : diff > 20 ? "faded" : null,
      };
    });
}
