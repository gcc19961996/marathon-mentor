// Pace analysis (beta): pure calculations over synced runs and per-mile splits.
// Zone definitions and colors come from ./effort — no duplicates here.

import { EFFORT_BANDS, effortFor, isRaceRun, type EffortKey } from "./effort";
import { flagSplits, usableSplits, type FlaggedSplit, type SplitRow } from "./splitFlags";
import { MARATHON_MI, mondayOfISO, shiftISODate } from "./training";

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
export function runFlaggedSplits(
  run: AnalysisRun,
  splitsByActivity: SplitsByActivity,
): FlaggedSplit[] {
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
  return shiftISODate(today, -days);
}

export function inRange(runs: AnalysisRun[], from: string, to: string): AnalysisRun[] {
  return runs.filter((r) => r.date >= from && r.date <= to);
}

/* ---------- pace vs distance ---------- */

export type PaceDistanceComparison = "previous" | "last-year" | "off";
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
const TEN_K_MI = 10000 / 1609.344;

function shiftDate(date: string, days: number): string {
  return shiftISODate(date, days);
}

function shiftYear(date: string, years: number): string {
  return shiftISODate(date, 0, years);
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
    const days =
      Math.round(
        (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000,
      ) + 1;
    comparisonTo = shiftDate(from, -1);
    comparisonFrom = shiftDate(comparisonTo, -(days - 1));
  }
  return {
    from: comparisonFrom,
    to: comparisonTo,
    label: periodRangeLabel(comparisonFrom, comparisonTo),
  };
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
    .map((run) => ({
      x: Math.log(Number(run.distance_mi)),
      distance: Number(run.distance_mi),
      y: runPace(run, normalized),
    }))
    .filter(
      (point): point is { x: number; distance: number; y: number } =>
        Number.isFinite(point.x) && point.y != null && Number.isFinite(point.y),
    );
  if (points.length < 5) return null;
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const sxx = points.reduce((sum, point) => sum + Math.pow(point.x - xMean, 2), 0);
  const slope =
    sxx > 0
      ? points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / sxx
      : 0;
  const intercept = yMean - slope * xMean;
  const residual = points.reduce(
    (sum, point) => sum + Math.pow(point.y - (intercept + slope * point.x), 2),
    0,
  );
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

function mondayOf(date: string): string {
  return mondayOfISO(date);
}

/** Every week (Monday) or month between two dates, so the axis stays continuous. */
export function periodsBetween(from: string, to: string, monthly: boolean): string[] {
  const out: string[] = [];
  if (monthly) {
    const cursor = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
    const end = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
    while (cursor <= end) {
      out.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return out;
  }
  const end = mondayOf(to);
  for (let week = mondayOf(from); week <= end; week = shiftISODate(week, 7)) out.push(week);
  return out;
}

export type WeekVolume = {
  week: string;
  label: string;
  miles: number;
  longest: number;
  /** Distance-weighted average moving pace for the week, or null with no timed runs. */
  pace: number | null;
  runs: number;
};

/** Miles, longest run and average pace for every week (Monday) from `from` to `to`. */
export function weeklyVolume(runs: AnalysisRun[], from: string, to: string): WeekVolume[] {
  return periodsBetween(from, to, false).map((week) => {
    const end = shiftISODate(week, 6);
    const inWeek = runs.filter((r) => r.date >= week && r.date <= end && r.date <= to);
    const miles = inWeek.reduce((s, r) => s + Number(r.distance_mi || 0), 0);
    const timed = inWeek.filter((r) => Number(r.distance_mi) > 0 && Number(r.duration_seconds) > 0);
    const timedMiles = timed.reduce((s, r) => s + Number(r.distance_mi), 0);
    const timedSeconds = timed.reduce((s, r) => s + Number(r.duration_seconds), 0);
    return {
      week,
      label: periodLabel(week, false),
      miles: Math.round(miles * 10) / 10,
      longest:
        Math.round(inWeek.reduce((m, r) => Math.max(m, Number(r.distance_mi || 0)), 0) * 10) / 10,
      pace: timedMiles > 0 ? Math.round(timedSeconds / timedMiles) : null,
      runs: inWeek.length,
    };
  });
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

/** Linear between (x0, y0) and (x1, y1), flat outside that range. */
function lerpClamped(x: number, x0: number, x1: number, y0: number, y1: number): number {
  const t = Math.min(Math.max((x - x0) / (x1 - x0), 0), 1);
  return y0 + t * (y1 - y0);
}

/**
 * Endurance and volume adjustments to the Riegel estimate. They shrink
 * gradually (rather than in steps at 16/20 mi and 25/35 mi a week) so every
 * longer long run or bigger week moves the prediction a little:
 * - longest run in 6 weeks: +4% at 14 mi or less, down to 0 at 20 mi
 * - average weekly miles over 4 weeks: +3% at 15 or less, down to 0 at 40
 */
export function enduranceFactor(longestMi: number): number {
  return lerpClamped(longestMi, 14, 20, 1.04, 1);
}

export function volumeFactor(weeklyMi: number): number {
  return lerpClamped(weeklyMi, 15, 40, 1.03, 1);
}

export function predictFromTraining(
  runs: AnalysisRun[],
  bestEffortRows: BestEffortRow[],
  today: string,
  splitsByActivity?: SplitsByActivity,
): TrainingPrediction {
  const since = (days: number) => shiftISODate(today, -days);

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
  seconds *= enduranceFactor(longestMi);

  const fourWeekMiles = runs
    .filter((r) => r.date >= since(28) && r.date <= today)
    .reduce((s, r) => s + Number(r.distance_mi || 0), 0);
  const weeklyMi = Math.round((fourWeekMiles / 4) * 10) / 10;
  seconds *= volumeFactor(weeklyMi);

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
  for (let asOf = mondayOf(from); asOf <= today; asOf = shiftISODate(asOf, 7)) {
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
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
    const pace =
      longest.avg_pace_seconds ?? Number(longest.duration_seconds) / Number(longest.distance_mi);
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
export function longRunCheck(
  runs: AnalysisRun[],
  splitsByActivity: SplitsByActivity,
): LongRunRow[] {
  return runs
    .filter((r) => !isRaceRun(r) && Number(r.distance_mi) >= 10)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((run) => {
      const splits = runFlaggedSplits(run, splitsByActivity);
      const all: Segment[] = splits.map((s) => ({ dist: s.distance, pace: s.pace }));
      const clean: Segment[] = usableSplits(splits).map((s) => ({
        dist: s.distance,
        pace: s.pace,
      }));
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
        verdict:
          diff == null
            ? null
            : diff < 0
              ? "negative"
              : diff <= 10
                ? "even"
                : diff > 20
                  ? "faded"
                  : null,
      };
    });
}
