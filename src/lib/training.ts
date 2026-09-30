// Pure training math + rules. No AI, no network.

export const MARATHON_MI = 26.2188;

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
  const tempoTo = Math.min(hmp + 8, mp - 10);
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

/**
 * Adds whole days (or years) to a plain YYYY-MM-DD date. Works in UTC so the
 * result is the same on any device, whatever its time zone.
 */
export function shiftISODate(date: string, days: number, years = 0): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday on or before a plain YYYY-MM-DD date. */
export function mondayOfISO(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun
  return shiftISODate(date, -((day + 6) % 7));
}

export function startOfWeek(d: Date = nyToday()): Date {
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return s;
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

/* ---------- today's range ---------- */

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

/* ---------- plan days ---------- */

export type PlanDay = {
  day: string;
  date?: string;
  type: WorkoutType | string;
  distance_mi?: number | null;
  duration_min?: number | null;
  pace_zone?: string;
  why?: string;
};

export function planTotal(days: PlanDay[]): number {
  return Math.round(days.reduce((s, d) => s + (d.distance_mi ?? 0), 0) * 10) / 10;
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
