import { describe, expect, it } from "vitest";
import type { PlanDayRow } from "./data";
import { fixedTodayRange, type CheckinLite } from "./fixedPlan";
import { FIXED_ZONES } from "./training";

const longRun: PlanDayRow = {
  id: "day-1",
  date: "2026-09-29",
  week_number: 3,
  phase: "Build",
  workout_type: "long",
  target_miles: 16,
  min_miles: 14,
  max_miles: 16,
  details: null,
  pace_target: "9:50–10:15/mi",
  purpose: "First 16-miler + checkpoint",
  status: "planned",
  actual_run_id: null,
};

const checkin = (patch: Partial<NonNullable<CheckinLite>>): CheckinLite => ({
  leg_feel: null,
  sleep_quality: null,
  whoop_recovery_pct: null,
  pain_note: null,
  ...patch,
});

const range = (c: CheckinLite, row: PlanDayRow = longRun) => fixedTodayRange(row, c, FIXED_ZONES);

describe("today's range from the fixed plan", () => {
  it("uses the planned range with no check-in", () => {
    expect(range(null)).toMatchObject({ status: "Go", rest: false, minMi: 14, maxMi: 16 });
  });

  it("treats a blank check-in exactly like no check-in", () => {
    expect(range(checkin({}))).toEqual(range(null));
  });

  it("never scales up for a great check-in", () => {
    expect(range(checkin({ leg_feel: 5, sleep_quality: 5, whoop_recovery_pct: 95 }))).toEqual(
      range(null),
    );
  });

  it("drops to the minimum, easy only, when legs or sleep are at 2", () => {
    for (const c of [checkin({ leg_feel: 2 }), checkin({ sleep_quality: 2 })]) {
      expect(range(c)).toMatchObject({
        status: "Take it easy",
        minMi: 14,
        maxMi: 14,
        zoneKey: "easy",
      });
    }
  });

  it("means rest at 1/5 or WHOOP under 34%", () => {
    for (const c of [
      checkin({ leg_feel: 1 }),
      checkin({ sleep_quality: 1 }),
      checkin({ whoop_recovery_pct: 33 }),
    ]) {
      expect(range(c)).toMatchObject({ status: "Rest", rest: true, maxMi: 0 });
    }
    expect(range(checkin({ whoop_recovery_pct: 34 })).status).toBe("Go");
  });

  it("means rest for sharp or worsening pain, not for a mild note", () => {
    expect(range(checkin({ pain_note: "Sharp pain in left shin" })).rest).toBe(true);
    expect(range(checkin({ pain_note: "Knee getting worse" })).rest).toBe(true);
    expect(range(checkin({ pain_note: "a bit tight" })).rest).toBe(false);
  });

  it("never changes race day", () => {
    const race = {
      ...longRun,
      workout_type: "race",
      target_miles: 26.2,
      min_miles: null,
      max_miles: null,
    };
    expect(range(checkin({ leg_feel: 1 }), race)).toMatchObject({
      status: "Go",
      minMi: 26.2,
      maxMi: 26.2,
    });
  });
});
