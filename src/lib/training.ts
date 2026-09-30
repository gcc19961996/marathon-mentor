// Pure training math + rules. No AI, no network.

export const MARATHON_MI = 26.2188;
export const HALF_MI = 13.1094;

export type WorkoutType =
  | "Easy Run"
  | "Long Run"
  | "Tempo"
  | "Strides"
  | "Marathon-Pace Run"
  | "Rest"
  | "Yoga/Mobility"
  | "Strength"
  | "Cross-Training";

export const WORKOUT_TYPES: WorkoutType[] = [
  "Easy Run",
  "Long Run",
  "Tempo",
  "Strides",
  "Marathon-Pace Run",
  "Rest",
  "Yoga/Mobility",
  "Strength",
  "Cross-Training",
];

export const HARD_TYPES: WorkoutType[] = ["Tempo", "Marathon-Pace Run", "Long Run"];

/* ---------- time helpers ---------- */

export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  const [a = 0, b = 0, c = 0] = nums;
  if (nums.length === 3) return a * 3600 + b * 60 + c;
  if (nums.length === 2) return a * 60 + b;
  if (nums.length === 1) return a * 60;
  return null;
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatPace(secondsPerMile: number | null | undefined): string {
  if (secondsPerMile == null || !Number.isFinite(secondsPerMile)) return "—";
  const s = Math.round(secondsPerMile);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/mi`;
}

/* ---------- prediction ---------- */

export function riegel(d1: number, t1Seconds: number, d2 = MARATHON_MI): number {
  return t1Seconds * Math.pow(d2 / d1, 1.06);
}

export type TargetCheck = {
  label: "On track" | "Stretch" | "Aggressive" | "Conservative";
  deltaPct: number;
  explanation: string;
};

export function targetCheck(targetSeconds: number, predictedSeconds: number): TargetCheck {
  // positive = target faster than prediction
  const deltaPct = ((predictedSeconds - targetSeconds) / predictedSeconds) * 100;
  if (deltaPct < -2)
    return {
      label: "Conservative",
      deltaPct,
      explanation: `Your target is ${Math.abs(deltaPct).toFixed(1)}% slower than your predicted finish — comfortably within reach.`,
    };
  if (deltaPct <= 2)
    return {
      label: "On track",
      deltaPct,
      explanation: `Target is within ${Math.abs(deltaPct).toFixed(1)}% of your predicted finish — realistic on current fitness.`,
    };
  if (deltaPct <= 5)
    return {
      label: "Stretch",
      deltaPct,
      explanation: `Target is ${deltaPct.toFixed(1)}% faster than predicted — achievable with a strong block.`,
    };
  return {
    label: "Aggressive",
    deltaPct,
    explanation: `Target is ${deltaPct.toFixed(1)}% faster than predicted — keep marathon-pace work conservative and reassess as training builds.`,
  };
}

/* ---------- phase ---------- */

export type Phase = "Base" | "Build" | "Peak" | "Taper" | "Race week";

export function daysToRace(raceDate: string, today = nyToday()): number {
  const race = new Date(`${raceDate}T00:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((race.getTime() - t.getTime()) / 86400000);
}

export function weeksToRace(raceDate: string, today = nyToday()): number {
  // whole weeks remaining, rounded down (47 days = 6 weeks)
  return Math.max(0, Math.floor(daysToRace(raceDate, today) / 7));
}

export function phaseFor(weeks: number): Phase {
  if (weeks <= 1) return "Race week";
  if (weeks <= 3) return "Taper";
  if (weeks <= 6) return "Peak";
  if (weeks <= 15) return "Build";
  return "Base";
}

export function taperFactor(weeks: number): number {
  if (weeks <= 1) return 0.45;
  if (weeks === 2) return 0.65;
  if (weeks === 3) return 0.8;
  return 1;
}

/* ---------- pace zones ---------- */

export type Zone = { key: string; name: string; from: number; to: number; note: string };

/**
 * Every zone is built from ONE base pace: marathon pace (MP) from the target time.
 * Tempo and intervals are anchored on current fitness (half-marathon / 10K pace from
 * the recent race) but are always clamped to stay faster than MP.
 */
export function paceZones(mp: number, fitnessMp?: number | null): Zone[] {
  const fit = fitnessMp && Number.isFinite(fitnessMp) ? fitnessMp : mp;

  // Half-marathon pace from current fitness, then 10K pace.
  const hmp = fit - 15;
  const tenK = hmp - 12;

  // Tempo sits around half-marathon pace but must always be faster than MP.
  let tempoTo = Math.min(hmp + 8, mp - 10);
  let tempoFrom = tempoTo - 12;
  if (tempoFrom >= tempoTo) tempoFrom = tempoTo - 10;

  // Intervals are 10K pace or faster, and always faster than tempo.
  const intervalsTo = Math.min(tenK, tempoFrom - 5);

  const zones: Zone[] = [
    {
      key: "easy",
      name: "Easy",
      from: mp + 60,
      to: mp + 90,
      note: "Conversational — 60 to 90 seconds slower than marathon pace.",
    },
    {
      key: "long",
      name: "Long run",
      from: mp + 30,
      to: mp + 75,
      note: "Steady and controlled — 30 to 75 seconds slower than marathon pace.",
    },
    {
      key: "mp",
      name: "Marathon pace",
      from: mp,
      to: mp,
      note: "Race rehearsal pace, from your target.",
    },
    {
      key: "tempo",
      name: "Tempo / threshold",
      from: tempoFrom,
      to: tempoTo,
      note: "Comfortably hard, around half-marathon pace.",
    },
    {
      key: "intervals",
      name: "Intervals",
      from: intervalsTo - 10,
      to: intervalsTo,
      note: "10K pace or faster.",
    },
  ];

  return enforceZoneOrder(zones, mp);
}

/** Safety net: easy/long are always slower than MP, tempo/intervals always faster. */
export function enforceZoneOrder(zones: Zone[], mp: number): Zone[] {
  return zones.map((z) => {
    if (z.key === "easy" || z.key === "long") {
      const from = Math.max(z.from, mp + (z.key === "easy" ? 60 : 30));
      const to = Math.max(z.to, from + 15);
      return { ...z, from, to };
    }
    if (z.key === "tempo" || z.key === "intervals") {
      const to = Math.min(z.to, mp - (z.key === "tempo" ? 10 : 25));
      const from = Math.min(z.from, to - 10);
      return { ...z, from, to };
    }
    return z;
  });
}

export function zoneRange(zones: Zone[], key: string): string {
  const z = zones.find((x) => x.key === key);
  if (!z) return "—";
  return z.from === z.to ? formatPace(z.from) : `${formatPace(z.from)} – ${formatPace(z.to)}`;
}

/* ---------- race-day splits ---------- */

/**
 * Relative per-mile effort factors for the NYC course:
 * up the Verrazzano (mile 1) then the downslope, the Queensboro climb (mile 15–16),
 * fast on First Avenue (17–19), and the slow last 5K through Central Park.
 */
const NYC_MILE_FACTORS = [
  1.05, 1.05, 1.02, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.01, 1.04, 1.04, 0.97, 0.97,
  0.98, 0.99, 1.0, 1.01, 1.04, 1.05, 1.04, 1.03, 1.02,
];

function cumulativeTimeAt(distanceMi: number, targetSeconds: number, adjusted: boolean): number {
  if (!adjusted) return targetSeconds * (distanceMi / MARATHON_MI);
  const factors = NYC_MILE_FACTORS;
  let weighted = 0;
  const totalWeighted = factors.reduce((acc, f, i) => {
    const len = Math.min(1, MARATHON_MI - i);
    return acc + (len > 0 ? f * len : 0);
  }, 0);
  let remaining = distanceMi;
  for (let i = 0; i < factors.length && remaining > 0; i++) {
    const len = Math.min(1, MARATHON_MI - i, remaining);
    if (len <= 0) break;
    weighted += (factors[i] ?? 1) * len;
    remaining -= len;
  }
  return targetSeconds * (weighted / totalWeighted);
}

export type SplitRow = { label: string; distanceMi: number; even: number; adjusted: number };

export function splitTable(targetSeconds: number): SplitRow[] {
  const rows: SplitRow[] = [];
  const kmToMi = 0.621371;
  for (let k = 5; k <= 40; k += 5) {
    const mi = k * kmToMi;
    rows.push({
      label: `${k}K`,
      distanceMi: mi,
      even: cumulativeTimeAt(mi, targetSeconds, false),
      // NYC strategy is deliberately conservative: never bank time before 30K.
      adjusted:
        k <= 30
          ? Math.max(
              cumulativeTimeAt(mi, targetSeconds, true),
              cumulativeTimeAt(mi, targetSeconds, false),
            )
          : cumulativeTimeAt(mi, targetSeconds, true),
    });
    if (k === 20) {
      rows.push({
        label: "Half",
        distanceMi: HALF_MI,
        even: cumulativeTimeAt(HALF_MI, targetSeconds, false),
        adjusted: Math.max(
          cumulativeTimeAt(HALF_MI, targetSeconds, true),
          cumulativeTimeAt(HALF_MI, targetSeconds, false),
        ),
      });
    }
  }
  rows.push({
    label: "Finish",
    distanceMi: MARATHON_MI,
    even: targetSeconds,
    adjusted: targetSeconds,
  });
  const sorted = rows.sort((a, b) => a.distanceMi - b.distanceMi);
  // Never bank time before 30K; 35K and 40K sit ~30s behind even for the Fifth Avenue climb.
  const thirtyK = 30 * 0.621371;
  return sorted.map((r) => {
    if (r.label === "35K" || r.label === "40K") return { ...r, adjusted: r.even + 30 };
    if (r.distanceMi < thirtyK) return { ...r, adjusted: Math.max(r.adjusted, r.even) };
    return r;
  });
}

/* ---------- dates (always New York local time) ---------- */

export const TIME_ZONE = "America/New_York";

/** Today in New York, as a Date whose local Y/M/D match the New York calendar day. */
export function nyToday(): Date {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1);
}

export function isoDate(d: Date = nyToday()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfWeek(d: Date = nyToday()): Date {
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return s;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Index of a plain date within the week starting at `weekStart` (0 = Monday). */
export function dayIndexOf(date: string, weekStart: Date = startOfWeek()): number {
  return Math.round((new Date(`${date}T00:00:00`).getTime() - weekStart.getTime()) / 86400000);
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------- pace checks ---------- */

export const EASY_FLAG_TYPES = ["Easy Run", "Long Run", "Cross-Training"];
const EASY_PACE_FLOOR = 575; // 9:35/mi
const LONG_WITH_MP_FLOOR = 560; // 9:20/mi

/** True when an easy-intent run was run faster than it should have been. */
export function easyPaceFlag(
  type: string,
  paceSeconds: number | null | undefined,
  hasMpSegment = false,
): boolean {
  if (!paceSeconds || !Number.isFinite(paceSeconds)) return false;
  if (!EASY_FLAG_TYPES.includes(type)) return false;
  const floor = type === "Long Run" && hasMpSegment ? LONG_WITH_MP_FLOOR : EASY_PACE_FLOOR;
  return paceSeconds < floor;
}

export type PaceVerdict = "On target" | "Too fast" | "Slow";

export function workoutPaceVerdict(paceSeconds: number, targetSeconds: number): PaceVerdict {
  const delta = paceSeconds - targetSeconds;
  if (Math.abs(delta) <= 10) return "On target";
  return delta < 0 ? "Too fast" : "Slow";
}

/* ---------- today's range ---------- */

export type RunLite = {
  date: string;
  type: string;
  distance_mi: number;
  avg_pace_seconds: number | null;
};

export type TodayInput = {
  planned?: { type: WorkoutType | string; distance_mi?: number | null; note?: string } | null;
  zones: Zone[];
  phase: Phase;
  weeks: number;
  lastWeekMileage: number;
  thisWeekMileage: number;
  restDayTakenThisWeek: boolean;
  daysLeftInWeek: number;
  yesterdayHard: boolean;
  typicalWeekly?: number;
  /** Suggested weekly ceiling in miles; overrides the internal estimate. */
  weeklyCeiling?: number | null;
  legFeel?: number | null;
  whoop?: number | null;
  painNote?: string | null;
};

export type TodayRange = {
  rest: boolean;
  status: "Go" | "Take it easy" | "Rest";
  minMi: number;
  maxMi: number;
  headlineMi: number;
  zoneKey: string;
  zoneLabel: string;
  reason: string;
  weekLimit: number;
};

export function weeklyLimit(
  lastWeekMileage: number,
  phase: Phase,
  weeks: number,
  typical: number,
): number {
  const base = lastWeekMileage > 0 ? lastWeekMileage * 1.1 : typical || 20;
  if (phase === "Taper" || phase === "Race week") {
    const peak = Math.max(lastWeekMileage, typical || 0);
    return peak * taperFactor(weeks);
  }
  return base;
}

export function computeTodayRange(input: TodayInput): TodayRange {
  const {
    planned,
    zones,
    phase,
    weeks,
    lastWeekMileage,
    thisWeekMileage,
    restDayTakenThisWeek,
    daysLeftInWeek,
    yesterdayHard,
    typicalWeekly = 0,
    weeklyCeiling,
    legFeel,
    whoop,
    painNote,
  } = input;

  // Fall back to the mileage given at setup when the log is still thin.
  const baseWeekly = lastWeekMileage > 0 ? lastWeekMileage : typicalWeekly;
  const limit =
    weeklyCeiling && weeklyCeiling > 0
      ? weeklyCeiling
      : weeklyLimit(baseWeekly, phase, weeks, typicalWeekly);
  const remaining = Math.max(0, limit - thisWeekMileage);

  const plannedType = (planned?.type ?? "Easy Run") as WorkoutType;
  const plannedDist = planned?.distance_mi ?? 0;

  let zoneKey = HARD_TYPES.includes(plannedType)
    ? plannedType === "Long Run"
      ? "long"
      : "mp"
    : "easy";
  if (plannedType === "Tempo") zoneKey = "tempo";
  if (plannedType === "Strides") zoneKey = "strides";
  if (plannedType === "Marathon-Pace Run") zoneKey = "mp";

  // Reasons carry a weight so badge and message always come from the same call.
  const notes: { weight: number; text: string }[] = [];
  const note = (weight: number, text: string) => notes.push({ weight, text });

  let rest = false;
  let quality = HARD_TYPES.includes(plannedType);

  const typicalDay = baseWeekly > 0 ? baseWeekly / 5 : 4;
  let max = Math.max(plannedDist || typicalDay, 3);

  if (plannedType === "Rest" || plannedType === "Yoga/Mobility" || plannedType === "Strength") {
    rest = true;
    note(60, "Your plan has today down as a non-running day.");
  }

  if (yesterdayHard) {
    quality = false;
    zoneKey = "easy";
    max = Math.min(max, Math.max(4, plannedDist * 0.6));
    note(70, "You ran hard yesterday, so today is easy running only.");
  }

  if (phase === "Taper" || phase === "Race week") {
    const f = taperFactor(weeks);
    max = max * f;
    note(
      30,
      phase === "Race week"
        ? "Race week: short and sharp, and rest the day before."
        : `You're in the taper, so volume sits around ${Math.round(f * 100)}% of peak.`,
    );
  }

  if (whoop != null) {
    if (whoop <= 33) {
      rest = true;
      quality = false;
      max = Math.min(max, 3);
      note(90, `Recovery at ${whoop}% is in the red, so rest or a short shakeout only.`);
    } else if (whoop <= 66) {
      quality = false;
      zoneKey = "easy";
      max = max * 0.75;
      note(75, `Recovery at ${whoop}% is amber, so shorter and easy — no quality work today.`);
    } else {
      note(10, `Recovery at ${whoop}% is green, so the full range is available.`);
    }
  }

  if (legFeel === 1) {
    rest = true;
    quality = false;
    note(95, "Legs at 1/5 — rest is the productive choice today.");
  } else if (legFeel === 2) {
    quality = false;
    zoneKey = "easy";
    max = max * 0.8;
    note(80, "Legs at 2/5, so keep it easy and short.");
  }

  if (!restDayTakenThisWeek && daysLeftInWeek <= 1) {
    rest = true;
    note(85, "You still owe yourself a rest day and the week is nearly over.");
  }

  if (painNote && painNote.trim()) {
    if (/sharp|worse|worsening|stab|localis|localiz/i.test(painNote)) {
      rest = true;
      quality = false;
      note(
        100,
        `You noted ${painNote.trim().toLowerCase()}, and sharp or worsening pain means rest and a physio or doctor, not a workaround.`,
      );
    } else {
      quality = false;
      zoneKey = "easy";
      max = max * 0.8;
      note(78, `${painNote.trim()} noted, so easy only today.`);
    }
  }

  // Past the suggested ceiling the week stays easy — logging is never blocked.
  if (remaining <= 0.5 && !rest && thisWeekMileage > 0) {
    quality = false;
    zoneKey = "easy";
    max = Math.min(max, 3);
    note(88, "You're at this week's suggested ceiling, so keep the rest easy.");
  }

  max = Math.min(max, remaining > 0.5 ? remaining : max);
  max = Math.round(Math.max(0, max) * 10) / 10;

  // Minimum is roughly 55% of the maximum, and never equal to it.
  let min = 0;
  if (!rest) {
    if (max < 2) max = 2;
    min = Math.round(max * 0.55 * 10) / 10;
    if (min >= max) min = Math.round((max - 0.5) * 10) / 10;
    if (min < 1) min = 1;
    if (min >= max) max = Math.round((min + 1) * 10) / 10;
  }

  if (!quality && zoneKey !== "easy" && zoneKey !== "long") zoneKey = "easy";
  const zoneLabel = zones.find((z) => z.key === zoneKey)?.name ?? "Easy";

  const status: TodayRange["status"] = rest ? "Rest" : quality ? "Go" : "Take it easy";

  // Show the single reason that actually drove the badge.
  const relevant = notes.filter((n) => (status === "Go" ? true : n.weight >= 30));
  const primary = relevant.sort((a, b) => b.weight - a.weight)[0];
  const reason =
    primary?.text ??
    (status === "Go"
      ? "Nothing in your recent training says to hold back — run the plan."
      : "Keeping today easy.");

  // Headline distance always sits inside [min, max].
  let headline = 0;
  if (!rest) {
    const wanted = plannedDist > 0 ? plannedDist : (min + max) / 2;
    headline = Math.round(Math.min(max, Math.max(min, wanted)) * 10) / 10;
  }

  return {
    rest,
    status,
    minMi: min,
    maxMi: max,
    headlineMi: headline,
    zoneKey,
    zoneLabel,
    reason,
    weekLimit: Math.round(limit * 10) / 10,
  };
}

/* ---------- milestone target dates ---------- */

export function milestoneTargetDate(criteria: string | null, raceDate: string): string | null {
  const race = new Date(`${raceDate}T00:00:00`);
  const minus = (n: number) => isoDate(new Date(race.getTime() - n * 86400000));
  switch (criteria) {
    case "long_16":
      return minus(56);
    case "long_18":
      return minus(42);
    case "long_20":
      return minus(21);
    case "mp_6":
      return minus(35);
    case "peak_week":
      return minus(28);
    case "taper":
      return isoDate(startOfWeek(new Date(race.getTime() - 14 * 86400000)));
    case "race_week":
      return isoDate(startOfWeek(race));
    case "race_day":
      return raceDate;
    default:
      return null;
  }
}

/* ---------- plan validation ---------- */

export type PlanDay = {
  day: string;
  date?: string;
  type: WorkoutType | string;
  distance_mi?: number | null;
  duration_min?: number | null;
  pace_zone?: string;
  why?: string;
};

export type PlanOptions = {
  limitMi: number;
  longRunCap: number;
  weeks: number;
  daysPerWeek?: number | null;
  longRunDay?: string | null;
  longRunTargetMi?: number | null;
  longRunTargetLabel?: string | null;
};

export function validatePlan(
  days: PlanDay[],
  opts: PlanOptions,
): { days: PlanDay[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const out = days.map((d, i) => ({ ...d, day: DAY_NAMES[i] ?? d.day }));
  const isRun = (d: PlanDay) => (d.distance_mi ?? 0) > 0 && d.type !== "Rest";

  // no back-to-back hard days
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    const cur = out[i];
    if (!prev || !cur) continue;
    const prevHard = HARD_TYPES.includes(prev.type as WorkoutType);
    const hard = HARD_TYPES.includes(cur.type as WorkoutType);
    if (prevHard && hard) {
      cur.type = "Easy Run";
      cur.pace_zone = "Easy";
      cur.distance_mi = Math.min(cur.distance_mi ?? 5, 6);
      cur.why = "Downgraded to easy: hard sessions can't run back to back.";
      adjustments.push(`${cur.day}: hard day followed a hard day, switched to an easy run.`);
    }
  }

  // long run sits on the preferred long-run day from Settings
  const wantedIdx = opts.longRunDay ? DAY_NAMES.indexOf(opts.longRunDay) : -1;
  if (wantedIdx >= 0) {
    const currentIdx = out.findIndex((d) => d.type === "Long Run");
    if (currentIdx >= 0 && currentIdx !== wantedIdx) {
      const a = out[currentIdx]!;
      const b = out[wantedIdx]!;
      out[wantedIdx] = { ...a, day: DAY_NAMES[wantedIdx]! };
      out[currentIdx] = { ...b, day: DAY_NAMES[currentIdx]! };
      adjustments.push(`Long run moved to ${opts.longRunDay} to match your settings.`);
    } else if (currentIdx === -1) {
      out[wantedIdx] = {
        ...(out[wantedIdx] ?? { day: DAY_NAMES[wantedIdx]!, type: "Long Run" }),
        day: DAY_NAMES[wantedIdx]!,
        type: "Long Run",
        pace_zone: "Long run",
        distance_mi: out[wantedIdx]?.distance_mi ?? 10,
        why: "Added the weekly long run on your preferred day.",
      };
      adjustments.push(`Long run added on ${opts.longRunDay}.`);
    }
  }

  // long run cap + last 20-miler no later than 3 weeks out
  for (const d of out) {
    if (d.type === "Long Run" && (d.distance_mi ?? 0) > opts.longRunCap) {
      adjustments.push(`${d.day}: long run capped at ${opts.longRunCap} miles.`);
      d.distance_mi = opts.longRunCap;
    }
    if (opts.weeks <= 3 && d.type === "Long Run" && (d.distance_mi ?? 0) > 12) {
      adjustments.push(`${d.day}: taper long run shortened — no 20-milers inside three weeks.`);
      d.distance_mi = 12;
    }
  }

  // at least one rest / yoga-only day
  const hasRest = out.some((d) => d.type === "Rest" || d.type === "Yoga/Mobility");
  if (!hasRest) {
    const easiest = [...out]
      .filter((d) => !HARD_TYPES.includes(d.type as WorkoutType))
      .sort((a, b) => (a.distance_mi ?? 0) - (b.distance_mi ?? 0))[0];
    if (easiest) {
      easiest.type = "Rest";
      easiest.distance_mi = 0;
      easiest.why = "Added rest day: every week needs at least one.";
      adjustments.push(`${easiest.day}: turned into a rest day.`);
    }
  }

  // number of running days matches "Days per week"
  const wantDays = opts.daysPerWeek ?? null;
  if (wantDays && wantDays >= 1 && wantDays <= 7) {
    let runDays = out.filter(isRun);
    while (runDays.length > wantDays) {
      const drop = [...runDays]
        .filter((d) => d.type !== "Long Run")
        .sort((a, b) => (a.distance_mi ?? 0) - (b.distance_mi ?? 0))[0];
      if (!drop) break;
      drop.type = "Rest";
      drop.distance_mi = 0;
      drop.pace_zone = "";
      drop.why = "Rest day: your settings say fewer running days.";
      adjustments.push(`${drop.day}: turned into a rest day to keep ${wantDays} running days.`);
      runDays = out.filter(isRun);
    }
  }

  // weekly mileage ceiling — scale the easy miles, protect the long run
  const longRun = out.find((d) => d.type === "Long Run");
  const total = out.reduce((s, d) => s + (d.distance_mi ?? 0), 0);
  if (total > opts.limitMi + 0.5 && total > 0) {
    const longMi = longRun?.distance_mi ?? 0;
    const others = total - longMi;
    const room = opts.limitMi - longMi;
    if (others > 0 && room > 0.5) {
      const scale = room / others;
      for (const d of out) {
        if (d !== longRun && d.distance_mi)
          d.distance_mi = Math.round(d.distance_mi * scale * 10) / 10;
      }
    } else {
      const scale = opts.limitMi / total;
      for (const d of out) {
        if (d.distance_mi) d.distance_mi = Math.round(d.distance_mi * scale * 10) / 10;
      }
    }
    adjustments.push(
      `Weekly mileage brought down from ${total.toFixed(1)} to about ${opts.limitMi.toFixed(1)} miles to respect the ~10% rule.`,
    );
  }

  // long run builds towards the next milestone
  const target = opts.longRunTargetMi ?? null;
  if (target && longRun) {
    const capped = Math.min(target, opts.longRunCap, opts.weeks <= 3 ? 12 : opts.longRunCap);
    const current = longRun.distance_mi ?? 0;
    if (Math.abs(current - capped) > 0.6) {
      const label = opts.longRunTargetLabel ? ` (${opts.longRunTargetLabel})` : "";
      if (capped < target) {
        adjustments.push(
          `Long run held at ${capped} mi rather than ${target} mi${label} — taper and long-run limits come first.`,
        );
      } else {
        adjustments.push(
          `Long run set to ${capped} mi to build towards your next milestone${label}.`,
        );
      }
      longRun.distance_mi = capped;
      longRun.why = `Builds towards your next milestone${label}.`;
    }
  }

  return { days: out, adjustments };
}

export function planTotal(days: PlanDay[]): number {
  return Math.round(days.reduce((s, d) => s + (d.distance_mi ?? 0), 0) * 10) / 10;
}

/* ---------- suggested weekly ceiling ---------- */

export type CeilingInput = {
  /** Miles logged in each of the last three completed weeks, most recent first. */
  recentWeeks: number[];
  startingWeekly: number;
  /** Index of this training week; every 4th week steps back. */
  weekIndex: number;
  /** Average of leg feel and sleep from today's check-in, 1-5. */
  checkinAvg: number | null;
  milestoneLongMi: number | null;
  daysPerWeek: number | null;
  peakMi: number;
  /** ISO Monday of the current week. */
  weekStart: string;
  taperDate: string | null;
  raceWeekDate: string | null;
};

export type Ceiling = { mi: number; reason: string };

export function suggestedCeiling(input: CeilingInput): Ceiling {
  const logged = input.recentWeeks.filter((m) => m > 0);
  const round = (n: number) => Math.round(n);

  // Taper and race week come straight off peak mileage.
  if (input.raceWeekDate && input.weekStart >= input.raceWeekDate) {
    return {
      mi: round(input.peakMi * 0.4),
      reason: `race week — 40% of your ${round(input.peakMi)} mi peak`,
    };
  }
  if (input.taperDate && input.weekStart >= input.taperDate) {
    const idx = Math.floor(
      (new Date(`${input.weekStart}T00:00:00`).getTime() -
        new Date(`${input.taperDate}T00:00:00`).getTime()) /
        (7 * 86400000),
    );
    const f = idx <= 0 ? 0.75 : 0.6;
    return {
      mi: round(input.peakMi * f),
      reason: `taper — ${Math.round(f * 100)}% of your ${round(input.peakMi)} mi peak`,
    };
  }

  const lastWeek = input.recentWeeks[0] ?? 0;
  const avg3 = logged.length ? logged.reduce((s, m) => s + m, 0) / logged.length : 0;
  const thin = logged.length < 2;
  const base = thin ? input.startingWeekly || 20 : Math.max(lastWeek, avg3);
  const baseLabel = thin
    ? `starting mileage ${round(base)} mi`
    : lastWeek >= avg3
      ? `last week ${round(lastWeek)} mi`
      : `3-week average ${round(avg3)} mi`;

  const stepBack = input.weekIndex > 0 && input.weekIndex % 4 === 3;
  const lowCheckin = input.checkinAvg != null && input.checkinAvg <= 2;
  let mi: number;
  let reason: string;
  if (stepBack || lowCheckin) {
    mi = base * 0.85;
    reason = `${baseLabel} − 15% ${lowCheckin ? "(check-in is low)" : "(step-back week)"}`;
  } else {
    mi = base * 1.1;
    reason = `${baseLabel} + 10% build`;
  }

  // Never below what this week's milestone long run needs.
  const otherDays = Math.max(0, (input.daysPerWeek ?? 4) - 1);
  const needed = (input.milestoneLongMi ?? 0) + 3 * otherDays;
  if (input.milestoneLongMi && needed > mi) {
    mi = needed;
    reason = `room for the ${input.milestoneLongMi} mi long run plus easy miles`;
  }

  return { mi: round(mi), reason };
}

/* ---------- fixed pace zones (the plan's own paces) ---------- */

export const FIXED_ZONES: Zone[] = [
  { key: "easy", name: "Easy", from: 590, to: 620, note: "Talk test · conversational." },
  { key: "long", name: "Long run", from: 590, to: 615, note: "Steady and controlled." },
  { key: "mp", name: "Marathon pace", from: 584, to: 584, note: "From the 4:15:00 target." },
  { key: "tempo", name: "Tempo", from: 505, to: 515, note: "Comfortably hard." },
  { key: "strides", name: "Strides", from: 0, to: 0, note: "20 sec fast, relaxed." },
  {
    key: "altitude",
    name: "Altitude (Jackson)",
    from: 615,
    to: 660,
    note: "Run by effort; no pace warnings.",
  },
];
