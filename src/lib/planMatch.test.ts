import { describe, expect, it } from "vitest";
import type { PlanDayRow, Run } from "./data";
import { hasMatchedLongRun, matchWeek, weekStatus } from "./planMatch";

const WEEK = "2026-09-28"; // Monday

const plan = (id: string, date: string, workout_type: string, miles: number): PlanDayRow => ({
  id,
  date,
  week_number: 3,
  phase: "Build",
  workout_type,
  target_miles: miles,
  min_miles: null,
  max_miles: null,
  details: null,
  pace_target: null,
  purpose: null,
  status: "planned",
  actual_run_id: null,
});

const run = (id: string, date: string, miles: number): Run =>
  ({ id, date, distance_mi: miles, duration_seconds: miles * 590, type: "" }) as unknown as Run;

const week = [
  plan("mon", "2026-09-28", "easy", 5),
  plan("tue", "2026-09-29", "long", 16),
  plan("thu", "2026-10-01", "mp", 6),
];

describe("matching runs to the plan", () => {
  it("matches a run on the planned day and marks it done", () => {
    const m = matchWeek(week, [run("r1", "2026-09-29", 17.1)], WEEK);
    expect(m.byPlanDate.get("2026-09-29")).toMatchObject({ moved: false, done: true });
  });

  it("accepts a run moved up to two days within the week", () => {
    const m = matchWeek(week, [run("r1", "2026-10-03", 6)], WEEK);
    expect(m.byPlanDate.get("2026-10-01")).toMatchObject({ moved: true, done: true });
  });

  it("does not match a run three or more days away", () => {
    const m = matchWeek([plan("mon", "2026-09-28", "easy", 5)], [run("r1", "2026-10-01", 5)], WEEK);
    expect(m.byPlanDate.get("2026-09-28")?.run).toBeNull();
    expect(m.extras.map((r) => r.id)).toEqual(["r1"]);
  });

  it("counts a workout done at 75% of the planned distance, not below", () => {
    const done = matchWeek(week, [run("r1", "2026-09-29", 12)], WEEK);
    const short = matchWeek(week, [run("r1", "2026-09-29", 11.9)], WEEK);
    expect(done.byPlanDate.get("2026-09-29")?.done).toBe(true);
    expect(short.byPlanDate.get("2026-09-29")?.done).toBe(false);
  });

  it("lets each run satisfy only one planned workout", () => {
    const m = matchWeek(week, [run("r1", "2026-09-29", 16)], WEEK);
    const matched = m.matches.filter((x) => x.run?.id === "r1");
    expect(matched).toHaveLength(1);
    expect(matched[0]?.row.id).toBe("tue");
  });

  it("reports totals and completion", () => {
    const m = matchWeek(
      week,
      [run("a", "2026-09-28", 5), run("b", "2026-09-29", 17.1), run("c", "2026-10-01", 6)],
      WEEK,
    );
    expect(m).toMatchObject({ complete: true, plannedMi: 27, actualMi: 28.1, runCount: 3 });
  });

  it("labels each week complete, partial, missed or in progress", () => {
    const all = [run("a", "2026-09-28", 5), run("b", "2026-09-29", 16), run("c", "2026-10-01", 6)];
    expect(weekStatus(matchWeek(week, all, WEEK), false)).toEqual({
      status: "complete",
      done: 3,
      total: 3,
    });
    // The travel week: a 3.5 mi run against a 6 mi tempo is under 75%.
    const travel = [plan("tue", "2026-09-22", "tempo", 6), plan("fri", "2026-09-25", "easy", 5)];
    expect(
      weekStatus(matchWeek(travel, [run("x", "2026-09-22", 3.5)], "2026-09-21"), false),
    ).toEqual({ status: "partial", done: 0, total: 2 });
    expect(weekStatus(matchWeek(travel, [], "2026-09-21"), false).status).toBe("missed");
    expect(weekStatus(matchWeek(week, [run("b", "2026-09-29", 16)], WEEK), true).status).toBe(
      "in progress",
    );
    expect(weekStatus(matchWeek(week, all, WEEK), true).status).toBe("complete");
  });

  it("knows whether the week's long run was covered", () => {
    expect(hasMatchedLongRun(matchWeek(week, [run("b", "2026-09-30", 16)], WEEK))).toBe(true);
    expect(hasMatchedLongRun(matchWeek(week, [run("a", "2026-09-28", 5)], WEEK))).toBe(false);
  });
});
