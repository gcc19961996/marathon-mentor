// The TCS New York City Marathon course, mile by mile, and even-effort pacing
// for any goal time. Every split on Race Day comes from this one model, so the
// mile table and the 5K checkpoints always agree.

import { MARATHON_MI } from "./training";

export type Borough = "Staten Island" | "Brooklyn" | "Queens" | "Manhattan" | "The Bronx";

export type CourseMile = {
  /** 1–26, then 27 for the final 0.2 miles. */
  mile: number;
  borough: Borough;
  note: string;
  /**
   * Relative effort cost of the mile: 1 is a flat mile, higher means slower at
   * the same effort (climbs), lower means faster (descents). Miles 1–2 are also
   * held back on purpose so the Verrazzano downhill doesn't bank time.
   */
  factor: number;
};

export const NYC_COURSE: CourseMile[] = [
  {
    mile: 1,
    borough: "Staten Island",
    note: "Verrazzano Bridge climb, the course's biggest hill",
    factor: 1.045,
  },
  {
    mile: 2,
    borough: "Brooklyn",
    note: "Down the bridge into Brooklyn; don't bank time",
    factor: 1.03,
  },
  { mile: 3, borough: "Brooklyn", note: "Bay Ridge, onto 4th Avenue", factor: 1.01 },
  { mile: 4, borough: "Brooklyn", note: "4th Avenue: long, flat and loud", factor: 1 },
  { mile: 5, borough: "Brooklyn", note: "4th Avenue", factor: 1 },
  { mile: 6, borough: "Brooklyn", note: "4th Avenue", factor: 1 },
  { mile: 7, borough: "Brooklyn", note: "4th Avenue toward Atlantic Avenue", factor: 1 },
  {
    mile: 8,
    borough: "Brooklyn",
    note: "Past Barclays Center onto Lafayette Avenue, gentle rise",
    factor: 1.005,
  },
  { mile: 9, borough: "Brooklyn", note: "Bedford Avenue", factor: 1 },
  { mile: 10, borough: "Brooklyn", note: "Bedford Avenue through Williamsburg", factor: 1 },
  { mile: 11, borough: "Brooklyn", note: "Williamsburg, a quieter stretch", factor: 1 },
  { mile: 12, borough: "Brooklyn", note: "Greenpoint", factor: 1 },
  {
    mile: 13,
    borough: "Queens",
    note: "Pulaski Bridge into Queens; halfway at the top",
    factor: 1.015,
  },
  { mile: 14, borough: "Queens", note: "Long Island City", factor: 1 },
  {
    mile: 15,
    borough: "Queens",
    note: "Queensboro Bridge to Manhattan: long, quiet climb",
    factor: 1.05,
  },
  {
    mile: 16,
    borough: "Manhattan",
    note: "Down onto First Avenue; crowds roar, don't surge",
    factor: 0.99,
  },
  { mile: 17, borough: "Manhattan", note: "First Avenue, wide and gently rising", factor: 1 },
  { mile: 18, borough: "Manhattan", note: "First Avenue", factor: 1 },
  { mile: 19, borough: "Manhattan", note: "First Avenue", factor: 1 },
  { mile: 20, borough: "The Bronx", note: "Willis Avenue Bridge into the Bronx", factor: 1.02 },
  {
    mile: 21,
    borough: "The Bronx",
    note: "Madison Avenue Bridge back into Manhattan",
    factor: 1.02,
  },
  { mile: 22, borough: "Manhattan", note: "Harlem, onto Fifth Avenue", factor: 1 },
  { mile: 23, borough: "Manhattan", note: "Fifth Avenue climb along the park", factor: 1.04 },
  { mile: 24, borough: "Manhattan", note: "Top of Fifth Avenue, into Central Park", factor: 1.04 },
  { mile: 25, borough: "Manhattan", note: "Central Park: rolling hills", factor: 1.02 },
  {
    mile: 26,
    borough: "Manhattan",
    note: "Central Park South, back in at Columbus Circle",
    factor: 1.01,
  },
  { mile: 27, borough: "Manhattan", note: "Last rise to the finish", factor: 1.02 },
];

const mileLength = (index: number) => Math.min(1, MARATHON_MI - index);
const TOTAL_WEIGHT = NYC_COURSE.reduce((sum, m, i) => sum + m.factor * mileLength(i), 0);

/** Seconds from the start to `distanceMi` at even effort on the NYC course. */
export function courseTimeAt(distanceMi: number, goalSeconds: number): number {
  const perUnit = goalSeconds / TOTAL_WEIGHT;
  let seconds = 0;
  NYC_COURSE.forEach((m, i) => {
    const covered = Math.min(mileLength(i), Math.max(0, distanceMi - i));
    seconds += m.factor * covered * perUnit;
  });
  return seconds;
}

export type MileSplit = CourseMile & {
  label: string;
  distanceMi: number;
  /** Time for this mile (or the final 0.2). */
  splitSeconds: number;
  /** Pace for this mile, per mile. */
  paceSeconds: number;
  /** Clock time at the end of this mile. */
  cumulativeSeconds: number;
};

export function mileSplits(goalSeconds: number): MileSplit[] {
  const perUnit = goalSeconds / TOTAL_WEIGHT;
  let cumulative = 0;
  return NYC_COURSE.map((m, i) => {
    const distanceMi = mileLength(i);
    const splitSeconds = m.factor * distanceMi * perUnit;
    cumulative += splitSeconds;
    return {
      ...m,
      label: m.mile === 27 ? "26.2" : String(m.mile),
      distanceMi,
      splitSeconds,
      paceSeconds: m.factor * perUnit,
      cumulativeSeconds: cumulative,
    };
  });
}

export type Checkpoint = { label: string; distanceMi: number; even: number; course: number };

const KM_TO_MI = 0.621371;

/** The official NYC timing points: every 5K, the half, and the finish. */
export function courseCheckpoints(goalSeconds: number): Checkpoint[] {
  const points = [5, 10, 15, 20, 21.0975, 25, 30, 35, 40].map((km) => ({
    label: km === 21.0975 ? "Half" : `${km}K`,
    distanceMi: km * KM_TO_MI,
  }));
  points.push({ label: "Finish", distanceMi: MARATHON_MI });
  return points.map((p) => ({
    ...p,
    even: goalSeconds * (p.distanceMi / MARATHON_MI),
    course: p.label === "Finish" ? goalSeconds : courseTimeAt(p.distanceMi, goalSeconds),
  }));
}
