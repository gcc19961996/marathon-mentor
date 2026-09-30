import { useMemo } from "react";
import {
  SINGLE_USER_ID,
  useMilestones,
  usePlanDays,
  usePlanWeeks,
  useProfile,
  useRuns,
  useTargets,
  useTodayCheckin,
  type Milestone,
  type PlanDayRow,
  type Run,
} from "./data";
import { fixedTodayRange, weekPlanDays, weekRowsFor } from "./fixedPlan";
import { matchWeek, weekStatus, type WeekMatch } from "./planMatch";
import { useBestEfforts, useRunSplits } from "./data";
import type { SplitRow } from "./splitFlags";
import {
  DAY_NAMES,
  FIXED_ZONES,
  HARD_TYPES,
  MARATHON_MI,
  daysToRace,
  formatDuration,
  formatPace,
  isoDate,
  nyToday,
  phaseFor,
  planTotal,
  riegel,
  startOfWeek,
  targetCheck,
  weeksToRace,
  type PlanDay,
  type WorkoutType,
} from "./training";

export function sumMiles(runs: Run[], from: string, to: string) {
  return (
    Math.round(
      runs
        .filter((r) => r.date >= from && r.date <= to)
        .reduce((s, r) => s + Number(r.distance_mi), 0) * 10,
    ) / 10
  );
}

/** Long-run distance a milestone implies, when it names one. */
export function milestoneDistance(m: Milestone | null): number | null {
  if (!m) return null;
  const match = m.name.match(/(\d{1,2})\s*-?\s*mile/i);
  if (match) return Number(match[1]);
  const paren = m.name.match(/\((\d{1,2})\)/);
  return paren ? Number(paren[1]) : null;
}

export function useDashboard() {
  const userId = SINGLE_USER_ID;

  const profileQ = useProfile(userId);
  const targetsQ = useTargets(userId);
  const runsQ = useRuns(userId);
  const checkinQ = useTodayCheckin(userId);
  const milestonesQ = useMilestones(userId);
  const planDaysQ = usePlanDays(userId);
  const planWeeksQ = usePlanWeeks(userId);
  const splitsQ = useRunSplits(userId);
  const bestEffortsQ = useBestEfforts(userId);

  const value = useMemo(() => {
    const profile = profileQ.data ?? null;
    const runs = runsQ.data ?? [];
    const targets = targetsQ.data ?? [];
    const activeTarget = targets[0] ?? null;
    const checkin = checkinQ.data ?? null;
    const milestones = milestonesQ.data ?? [];
    const planDays = planDaysQ.data ?? [];
    const planWeeks = planWeeksQ.data ?? [];

    const raceDate = profile?.race_date ?? "2026-11-01";
    const days = daysToRace(raceDate);
    const weeks = weeksToRace(raceDate);
    const phase = phaseFor(weeks);

    const predictedSeconds =
      profile?.recent_race_distance_mi && profile?.recent_race_seconds
        ? riegel(
            Number(profile.recent_race_distance_mi),
            Number(profile.recent_race_seconds),
            MARATHON_MI,
          )
        : null;
    const fitnessMp = predictedSeconds ? predictedSeconds / MARATHON_MI : null;

    const mp = activeTarget?.target_pace_seconds ?? null;
    const zones = FIXED_ZONES;

    const trainingZones = FIXED_ZONES;
    const goalPace = activeTarget?.target_pace_seconds ?? 584;

    const splitsByActivity = new Map<number, SplitRow[]>();
    for (const s of splitsQ.data ?? []) {
      const list = splitsByActivity.get(Number(s.strava_activity_id)) ?? [];
      list.push(s as SplitRow);
      splitsByActivity.set(Number(s.strava_activity_id), list);
    }
    for (const list of splitsByActivity.values())
      list.sort((a, b) => a.mile_number - b.mile_number);
    const check =
      activeTarget && predictedSeconds
        ? targetCheck(activeTarget.target_seconds, predictedSeconds)
        : null;

    const weekStartDate = startOfWeek();
    const weekStart = isoDate(weekStartDate);
    const today = isoDate();
    const lastWeekStart = isoDate(new Date(weekStartDate.getTime() - 7 * 86400000));
    const lastWeekEnd = isoDate(new Date(weekStartDate.getTime() - 86400000));

    const typicalWeekly = Number(profile?.typical_weekly_mileage ?? 0);
    const thisWeekMileage = sumMiles(runs, weekStart, today);
    const loggedLastWeek = sumMiles(runs, lastWeekStart, lastWeekEnd);
    const lastWeekMileage = loggedLastWeek > 0 ? loggedLastWeek : typicalWeekly;

    const yesterday = isoDate(new Date(nyToday().getTime() - 86400000));
    const yesterdayHard = runs
      .filter((r) => r.date === yesterday)
      .some((r) => HARD_TYPES.includes(r.type as WorkoutType));

    const dayIndex = (nyToday().getDay() + 6) % 7;

    /* ----- the fixed plan ----- */
    const currentWeek = planWeeks.find((w) => w.start_date === weekStart) ?? null;
    const weekRows: (PlanDayRow | null)[] = weekRowsFor(planDays, weekStart);
    const activeDays: PlanDay[] = weekPlanDays(planDays, weekStart);
    const lastWeekDays: PlanDay[] = weekPlanDays(planDays, lastWeekStart);
    const todayRow = planDays.find((r) => r.date === today) ?? null;
    const todayPlanned = activeDays[dayIndex] ?? null;

    const phaseLabel = currentWeek?.phase ?? phaseFor(weeks);
    const plannedWeekMi = currentWeek ? Number(currentWeek.target_miles) : planTotal(activeDays);
    const limit = currentWeek ? Number(currentWeek.suggested_ceiling) : plannedWeekMi;
    const ceilingReason = currentWeek
      ? `week ${currentWeek.week_number} of the plan · ${currentWeek.phase}`
      : "outside the plan's dates";
    const remainingMi = Math.round(Math.max(0, plannedWeekMi - thisWeekMileage) * 10) / 10;
    const overCeilingMi = Math.round(Math.max(0, thisWeekMileage - limit) * 10) / 10;

    const todayRange = fixedTodayRange(todayRow, checkin, zones);

    /* ----- flexible run-to-plan matching ----- */
    const weekMatch: WeekMatch = matchWeek(planDays, runs, weekStart);
    const lastWeekMatch: WeekMatch = matchWeek(planDays, runs, lastWeekStart);
    const todayMatch = weekMatch.byPlanDate.get(today) ?? null;
    const todayAlreadyDone =
      todayMatch?.done && todayMatch.run && todayMatch.run.date !== today ? todayMatch.run : null;

    // Every plan week so far, newest first, with how it went.
    const pastWeeks = planWeeks
      .filter((w) => w.start_date <= weekStart)
      .map((w) => {
        const match = matchWeek(planDays, runs, w.start_date);
        return { week: w, match, ...weekStatus(match, w.start_date === weekStart) };
      })
      .sort((a, b) => b.week.start_date.localeCompare(a.week.start_date));

    // Next milestone still to come.
    const upcoming = [...milestones]
      .filter((m) => !m.completed_date && m.target_date)
      .sort((a, b) => (a.target_date ?? "").localeCompare(b.target_date ?? ""));
    const nextMilestone: Milestone | null =
      upcoming.find((m) => (m.target_date ?? "") >= today) ?? upcoming[0] ?? null;
    const longRunTargetMi = milestoneDistance(nextMilestone);

    // The most recent long run, from the log first and setup as a fallback.
    const loggedLong = [...runs]
      .filter((r) => Number(r.distance_mi) >= 8)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const recentLongRun = loggedLong
      ? {
          date: loggedLong.date,
          distance_mi: Number(loggedLong.distance_mi),
          pace: loggedLong.avg_pace_seconds,
        }
      : profile?.longest_run_mi
        ? {
            date: profile.longest_run_date ?? "",
            distance_mi: Number(profile.longest_run_mi),
            pace: null,
          }
        : null;

    const setupComplete = !!(profile?.setup_complete && activeTarget);

    // "Why today" — short bullets built from the data, no AI call.
    const bullets: string[] = [];
    if (checkin && (checkin.leg_feel != null || checkin.sleep_quality != null)) {
      const parts: string[] = [];
      if (checkin.leg_feel != null) parts.push(`Legs ${checkin.leg_feel}/5`);
      if (checkin.sleep_quality != null) parts.push(`sleep ${checkin.sleep_quality}/5`);
      if (checkin.whoop_recovery_pct != null) parts.push(`WHOOP ${checkin.whoop_recovery_pct}%`);
      if (checkin.pain_note?.trim()) parts.push(checkin.pain_note.trim().toLowerCase());
      const effect = todayRange.rest
        ? "rest today"
        : todayRange.status === "Go"
          ? "full range"
          : `${todayRange.zoneLabel.toLowerCase()} only`;
      bullets.push(`${parts.join(" · ")} → ${effect}`);
    } else {
      bullets.push("No check-in yet — plan uses your normal ranges");
    }
    bullets.push(`${thisWeekMileage} of ${plannedWeekMi} mi done · ${remainingMi} mi left`);
    const nextHardIdx = activeDays.findIndex(
      (day, i) => i > dayIndex && HARD_TYPES.includes(day.type as WorkoutType),
    );
    if (nextHardIdx >= 0) {
      const day = activeDays[nextHardIdx]!;
      bullets.push(
        `${DAY_NAMES[nextHardIdx]}: ${day.type}${day.distance_mi ? ` ${day.distance_mi} mi` : ""} — keep today controlled`,
      );
    } else if (nextMilestone) {
      bullets.push(
        `Next: ${nextMilestone.name}${nextMilestone.target_date ? ` · ${nextMilestone.target_date}` : ""}`,
      );
    }

    return {
      userId,
      loading:
        profileQ.isLoading ||
        targetsQ.isLoading ||
        runsQ.isLoading ||
        planDaysQ.isLoading ||
        planWeeksQ.isLoading,
      setupComplete,
      profile,
      runs,
      milestones,
      nextMilestone,
      longRunTargetMi,
      phaseLabel,
      targets,
      activeTarget,
      checkin,
      raceDate,
      days,
      weeks,
      phase,
      predictedSeconds,
      fitnessMp,
      mp,
      zones,
      trainingZones,
      goalPace,
      splitsByActivity,
      bestEffortRows: bestEffortsQ.data ?? [],
      todayRun: runs.find((r) => r.date === today) ?? null,
      check,
      weekStart,
      lastWeekStart,
      today,
      dayIndex,
      thisWeekMileage,
      lastWeekMileage,
      typicalWeekly,
      recentLongRun,
      planDays,
      planWeeks,
      currentWeek,
      weekRows,
      todayRow,
      lastWeekDays,
      plannedWeekMi,
      weeklyLimitMi: Math.round(limit * 10) / 10,
      ceilingReason,
      remainingMi,
      overCeilingMi,
      todayBullets: bullets,
      activeDays,
      todayPlanned,
      todayRange,
      yesterdayHard,
      weekMatch,
      lastWeekMatch,
      todayMatch,
      todayAlreadyDone,
      pastWeeks,
    };
  }, [
    profileQ.data,
    targetsQ.data,
    runsQ.data,
    checkinQ.data,
    milestonesQ.data,
    planDaysQ.data,
    planWeeksQ.data,
    splitsQ.data,
    bestEffortsQ.data,
    userId,
    profileQ.isLoading,
    targetsQ.isLoading,
    runsQ.isLoading,
    planDaysQ.isLoading,
    planWeeksQ.isLoading,
  ]);

  return value;
}

export type Dashboard = ReturnType<typeof useDashboard>;

export function buildAiContext(
  d: Dashboard,
  extras?: { daysAvailable?: string[]; notes?: string | null },
) {
  const cutoff = isoDate(new Date(nyToday().getTime() - 14 * 86400000));
  const recent = d.runs
    .filter((r) => r.date >= cutoff)
    .map(
      (r) =>
        `${r.date} ${r.type} ${Number(r.distance_mi).toFixed(1)}mi @ ${formatPace(r.avg_pace_seconds)}`,
    )
    .join("; ");

  const week = d.activeDays
    .map((day, i) =>
      `${DAY_NAMES[i]}: ${day.type} ${day.distance_mi ? `${day.distance_mi}mi` : ""} ${day.pace_zone ?? ""}`.trim(),
    )
    .join("; ");

  const longNote = d.recentLongRun
    ? `${d.recentLongRun.distance_mi} mi on ${d.recentLongRun.date || "an unknown date"}`
    : "none recorded";

  const nextM = d.nextMilestone
    ? `${d.nextMilestone.name}${d.nextMilestone.target_date ? ` on ${d.nextMilestone.target_date}` : ""}`
    : "none";

  return {
    today: d.today,
    raceName: d.profile?.race_name ?? "Marathon",
    raceDate: d.raceDate,
    daysToRace: d.days,
    weeksToRace: d.weeks,
    phase: d.phaseLabel,
    targetTime: d.activeTarget ? formatDuration(d.activeTarget.target_seconds) : "not set",
    targetPace: d.mp ? formatPace(d.mp) : "not set",
    predictedFinish: d.predictedSeconds ? formatDuration(d.predictedSeconds) : "unknown",
    targetCheck: d.check ? `${d.check.label} — ${d.check.explanation}` : "unknown",
    paceZones: d.zones
      .map((z) => `${z.name} ${formatPace(z.from)}${z.from === z.to ? "" : `-${formatPace(z.to)}`}`)
      .join("; "),
    lastWeekMileage: d.lastWeekMileage,
    thisWeekMileage: d.thisWeekMileage,
    weeklyLimit: d.weeklyLimitMi,
    daysAvailable: extras?.daysAvailable ?? [],
    daysPerWeek: d.profile?.days_per_week ?? null,
    longRunDay: d.profile?.long_run_day ?? null,
    nextMilestone: nextM,
    longRunTargetMi: d.longRunTargetMi ?? null,
    legFeel: d.checkin?.leg_feel ?? null,
    sleepQuality: d.checkin?.sleep_quality ?? null,
    whoopRecovery: d.checkin?.whoop_recovery_pct ?? null,
    recentRuns: recent || "none logged",
    activeWeek: week || "rest week",
    todayRange: d.todayRange.rest
      ? `rest recommended (${d.todayRange.reason})`
      : `${d.todayRange.minMi}-${d.todayRange.maxMi} mi in the ${d.todayRange.zoneLabel} zone`,
    notes: `${extras?.notes ?? ""} Most recent long run: ${longNote}.`.trim(),
  };
}

export { planTotal };
