import { useEffect, useMemo, useRef, useState } from "react";
import { Bike, Check, ChevronDown, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AskBar } from "./AskBar";
import { askCoach } from "@/lib/ai.functions";
import {
  useAddCrossTraining,
  useChecklist,
  useChecklistMutations,
  useCrossTraining,
  useLogPlanChange,
  usePlanDayMutations,
  useSaveCheckin,
  type PlanDayRow,
} from "@/lib/data";
import { buildAiContext, type Dashboard } from "@/lib/dashboard";
import { typeLabel, weekDates } from "@/lib/fixedPlan";
import { longRunHold, weekRecap } from "@/lib/tracking";
import { hasMatchedLongRun, movedRunNote } from "@/lib/planMatch";
import { DAY_NAMES, formatPace, isoDate, startOfWeek } from "@/lib/training";
import {
  effortFor,
  effortRangeLabel,
  isRaceRun,
  runFlags,
  weeklyEffortSummary,
} from "@/lib/effort";
import { cn } from "@/lib/utils";

function formatShortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatBulletDate(text: string) {
  return text.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (_, year: string, month: string, day: string) =>
      new Date(`${year}-${month}-${day}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
  );
}

const workoutClass: Record<string, string> = {
  easy: "workout-easy",
  long: "workout-long",
  tempo: "workout-tempo",
  mp: "workout-mp",
  strides: "workout-strides",
  shakeout: "workout-shakeout",
  race: "workout-race",
  rest: "workout-rest",
};

export function WeeklyPlanTab({
  d,
  onLogRun,
  onOpenPlanRules,
}: {
  d: Dashboard;
  onLogRun: () => void;
  onOpenPlanRules?: () => void;
}) {
  const recap = useMemo(
    () =>
      d.lastWeekDays.some((x) => (x.distance_mi ?? 0) > 0)
        ? weekRecap(d.runs, d.lastWeekDays, d.lastWeekStart)
        : null,
    [d.runs, d.lastWeekDays, d.lastWeekStart],
  );
  // The hold rule only applies when last week had no matched long run at all.
  const hold = useMemo(
    () =>
      d.lastWeekDays.some((x) => (x.distance_mi ?? 0) > 0) && !hasMatchedLongRun(d.lastWeekMatch)
        ? longRunHold({
            runs: d.runs,
            lastWeekPlan: d.lastWeekDays,
            lastWeekStart: d.lastWeekStart,
            activeDays: d.activeDays,
            taper: d.phaseLabel === "Taper" || d.phaseLabel === "Race week",
          })
        : null,
    [d.runs, d.lastWeekDays, d.lastWeekStart, d.lastWeekMatch, d.activeDays, d.phaseLabel],
  );
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <WeekCompleteCard d={d} />
        {recap && <MondayRecap d={d} recap={recap} />}
        {hold && <HoldBanner d={d} hold={hold} />}
        <RaceWeekChecklist d={d} />
      </div>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <TodaySection d={d} onLogRun={onLogRun} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <WeekSummary d={d} />
        </div>
      </div>
      <ThisWeek d={d} />
      {onOpenPlanRules && (
        <Button variant="link" className="h-auto px-0 text-sm" onClick={onOpenPlanRules}>
          Plan rules →
        </Button>
      )}
      <AskBar d={d} daysAvailable={[]} />
    </div>
  );
}

function TodaySection({ d, onLogRun }: { d: Dashboard; onLogRun: () => void }) {
  const row = d.todayRow;
  const tomorrowDate = new Date(`${d.today}T12:00:00-04:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = d.planDays.find((x) => x.date === isoDate(tomorrowDate));
  // Today's workout may already have been run earlier in the week.
  const tomorrowMatch = tomorrow ? d.weekMatch.byPlanDate.get(tomorrow.date) : null;
  const tomorrowDone = tomorrowMatch?.done && tomorrowMatch.run ? tomorrowMatch.run : null;
  const alreadyDone = d.todayAlreadyDone;
  // Today's planned run is logged: lead with what was run, not the plan.
  const ranToday = !alreadyDone && row && d.todayRun ? d.todayRun : null;
  const alreadyDoneType = typeLabel(row?.workout_type ?? "long");
  return (
    <section className="surface-card workout-easy overflow-hidden border-l-4">
      <div className="border-b border-border px-5 py-3 sm:px-7">
        <h2 className="text-xs font-bold uppercase text-muted-foreground">
          Today ·{" "}
          {new Date(`${d.today}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </h2>
      </div>
      <div className="p-5 sm:p-7">
        {alreadyDone ? (
          <>
            <AlreadyDone run={alreadyDone} workout={alreadyDoneType} />
            <div className="mt-4">
              <CheckinRow d={d} collapsed />
            </div>
          </>
        ) : row && ranToday ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="workout-chip workout-easy">{typeLabel(row.workout_type)}</span>
                <p className="stat-figure mt-3 text-5xl font-bold text-foreground">
                  {Number(ranToday.distance_mi).toFixed(1)} mi
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p className="font-semibold">Planned {Number(row.target_miles)} mi</p>
                <p>{row.pace_target}</p>
              </div>
            </div>
            <div className="mt-4">
              <DoneToday d={d} />
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {d.todayBullets.slice(0, 3).map((b) => (
                <li key={b}>· {formatBulletDate(b)}</li>
              ))}
            </ul>
            <div className="mt-6 border-t border-border pt-4">
              <CheckinRow d={d} collapsed />
            </div>
          </>
        ) : row ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="workout-chip workout-easy">{typeLabel(row.workout_type)}</span>
                <p className="stat-figure mt-3 text-5xl font-bold text-foreground">
                  {Number(row.target_miles)} mi
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p className="font-semibold">
                  {d.todayRange.minMi}–{d.todayRange.maxMi} mi
                </p>
                <p>{row.pace_target}</p>
              </div>
            </div>
            {row.details &&
              !(row.workout_type === "easy" && row.details.startsWith("Easy 9:50")) && (
                <p className="mt-5 text-sm">{row.details}</p>
              )}
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {d.todayBullets.slice(0, 3).map((b) => (
                <li key={b}>· {formatBulletDate(b)}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <span className="workout-chip workout-rest">Rest</span>
            <p className="stat-figure mt-3 text-4xl font-bold text-foreground">Rest day</p>
            {tomorrow &&
              (tomorrowDone ? (
                <p className="mt-3 text-sm font-medium">
                  Already done{" "}
                  {new Date(`${tomorrowDone.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                  })}{" "}
                  · {Number(tomorrowDone.distance_mi).toFixed(1)} mi ·{" "}
                  {formatPace(tomorrowDone.avg_pace_seconds)}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Tomorrow · {typeLabel(tomorrow.workout_type)} {Number(tomorrow.target_miles)} mi ·{" "}
                  {tomorrow.pace_target}
                </p>
              ))}
          </>
        )}
        {!alreadyDone && !ranToday && (
          <div className="mt-6 border-t border-border pt-4">
            <CheckinRow d={d} />
          </div>
        )}
        {!alreadyDone && !ranToday && (
          <div className="mt-5">
            {row ? (
              <Button variant="secondary" className="h-9 rounded-md" onClick={onLogRun}>
                Log this run
              </Button>
            ) : (
              <CrossTrainingRow d={d} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function WeekSummary({ d }: { d: Dashboard }) {
  const percent = Math.min(100, (d.thisWeekMileage / Math.max(1, d.plannedWeekMi)) * 100);
  return (
    <section className="surface-card p-5 sm:p-6">
      <p className="text-xs font-bold uppercase text-muted-foreground">This week</p>
      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="stat-figure text-5xl font-bold leading-none">
          {d.thisWeekMileage}
          <span className="ml-1 text-2xl text-muted-foreground">mi</span>
        </p>
        <p className="pb-1 text-right text-sm font-semibold text-muted-foreground">
          of {d.plannedWeekMi} mi
        </p>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
        <span className="text-muted-foreground">Workouts</span>
        <span className="font-semibold">{d.weekMatch.complete ? "All done" : "In progress"}</span>
      </div>
      {d.overCeilingMi > 0 && (
        <p className="mt-3 rounded-md bg-caution/15 px-3 py-2 text-xs font-medium">
          {d.overCeilingMi} mi over suggested — keep the rest of the week easy.
        </p>
      )}
    </section>
  );
}

function DoneToday({ d }: { d: Dashboard }) {
  const run = d.todayRun;
  if (!run) return null;
  const effort =
    isRaceRun(run) || run.date === "2026-09-25"
      ? null
      : effortFor(run.avg_pace_seconds, d.trainingZones);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
      <Check className="size-5 text-success" aria-hidden />
      Done · {formatPace(run.avg_pace_seconds)}
      {effort && (
        <span
          title={`${effortRangeLabel(effort)} per mile`}
          className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent"
        >
          {effort}
        </span>
      )}
    </p>
  );
}

function CheckinRow({ d, collapsed = false }: { d: Dashboard; collapsed?: boolean }) {
  const save = useSaveCheckin(d.userId);
  const c = d.checkin;
  const [editing, setEditing] = useState(!collapsed && !c);
  const [legs, setLegs] = useState(c?.leg_feel == null ? "" : String(c.leg_feel));
  const [sleep, setSleep] = useState(c?.sleep_quality == null ? "" : String(c.sleep_quality));
  const [whoop, setWhoop] = useState(
    c?.whoop_recovery_pct == null ? "" : String(c.whoop_recovery_pct),
  );
  const [note, setNote] = useState(c?.pain_note ?? "");
  useEffect(() => {
    if (c) {
      setLegs(c.leg_feel == null ? "" : String(c.leg_feel));
      setSleep(c.sleep_quality == null ? "" : String(c.sleep_quality));
      setWhoop(c.whoop_recovery_pct == null ? "" : String(c.whoop_recovery_pct));
      setNote(c.pain_note ?? "");
    }
    // Seed the form only when a different check-in loads; refetches of the same
    // record must not overwrite what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await save.mutateAsync({
      leg_feel: legs === "" ? null : Number(legs),
      sleep_quality: sleep === "" ? null : Number(sleep),
      whoop_recovery_pct: whoop === "" ? null : Number(whoop),
      pain_note: note || null,
      computed_min_mi: d.todayRange.minMi,
      computed_max_mi: d.todayRange.maxMi,
      rest_recommended: d.todayRange.rest,
    });
    setEditing(false);
    toast.success("Check-in saved");
  }
  const empty = legs === "" && sleep === "" && whoop === "" && note === "";
  if (!editing && c)
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <p>
          <span className="font-semibold">Morning check-in</span>
          {legs ? ` · Legs ${legs}` : ""}
          {sleep ? ` · Sleep ${sleep}` : ""}
          {whoop ? ` · WHOOP ${whoop}%` : ""}
          {note ? ` · ${note}` : ""}
        </p>
        <Button variant="link" className="h-auto px-0" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  if (!editing && collapsed)
    return (
      <Button variant="link" className="h-auto px-0 text-sm" onClick={() => setEditing(true)}>
        Add check-in
      </Button>
    );
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
      <p className="w-full text-xs font-semibold uppercase text-muted-foreground">
        Morning check-in
      </p>
      {[
        ["check-legs", "Legs", legs, setLegs],
        ["check-sleep", "Sleep", sleep, setSleep],
      ].map(([id, label, value, setter]) => (
        <div key={String(id)} className="w-24">
          <Label htmlFor={String(id)}>{String(label)}</Label>
          <select
            id={String(id)}
            className="mt-2 h-10 w-full rounded-lg bg-muted px-3 text-sm"
            value={String(value)}
            onChange={(e) =>
              (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)
            }
          >
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </div>
      ))}
      <div className="w-28">
        <Label htmlFor="check-whoop">WHOOP %</Label>
        <Input
          id="check-whoop"
          className="mt-2"
          inputMode="numeric"
          min="0"
          max="100"
          value={whoop}
          onChange={(e) => setWhoop(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <div className="min-w-40 flex-1">
        <Label htmlFor="check-note">Pain / note</Label>
        <Input
          id="check-note"
          className="mt-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <Button type="submit" disabled={empty || save.isPending}>
        Save
      </Button>
    </form>
  );
}

function CrossTrainingRow({ d }: { d: Dashboard }) {
  const add = useAddCrossTraining(d.userId);
  const [minutes, setMinutes] = useState("");
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">Cross-training</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="w-24">
          <Label htmlFor="cross-training-minutes">Minutes</Label>
          <Input
            id="cross-training-minutes"
            className="mt-1"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="30"
          />
        </div>
        {["Yoga", "Gym", "Bike", "Other"].map((a) => (
          <Button
            key={a}
            size="sm"
            variant="secondary"
            onClick={async () => {
              await add.mutateAsync({ date: d.today, activity: a, minutes: Number(minutes) || 30 });
              toast.success(`${a} logged`);
            }}
          >
            {a}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ThisWeek({ d }: { d: Dashboard }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const dates = weekDates(d.weekStart);
  const cross = useCrossTraining(d.userId);
  const byDate = new Map((cross.data ?? []).map((x) => [x.date, x]));
  const runsByDate = new Map(d.runs.map((r) => [r.date, r]));
  const week = d.weekMatch;
  const extraIds = new Set(week.extras.map((r) => r.id));
  const next = d.planWeeks.find((w) => w.week_number === (d.currentWeek?.week_number ?? 0) + 1);
  const nextRows = next ? d.planDays.filter((x) => x.week_number === next.week_number) : [];
  return (
    <section>
      <h2 className="section-title">Schedule</h2>
      <div className="mt-5 overflow-x-auto pb-2">
        <ul className="grid min-w-[980px] grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border lg:min-w-0">
          {d.weekRows.map((row, i) => {
            const date = dates[i] ?? "";
            const run = runsByDate.get(date);
            const isToday = date === d.today;
            const open = expanded === date;
            const match = row ? (week.byPlanDate.get(row.date) ?? null) : null;
            const matchedRun = match?.done ? match.run : null;
            const shownRun = matchedRun ?? run ?? null;
            const movedHere =
              run && week.planForRun.get(run.id) && week.planForRun.get(run.id)!.date !== date
                ? week.planForRun.get(run.id)!
                : null;
            const isExtra = !!run && extraIds.has(run.id);
            const done = !!matchedRun || row?.status === "done";
            const effort =
              shownRun && !isRaceRun(shownRun) && shownRun.date !== "2026-09-25"
                ? effortFor(shownRun.avg_pace_seconds, d.trainingZones)
                : null;
            return (
              <li
                key={date}
                className={cn(
                  "min-h-48 bg-card",
                  isToday && "bg-primary/6",
                  done && date < d.today && "opacity-70",
                )}
              >
                <button
                  type="button"
                  className="flex h-full w-full flex-col items-stretch gap-3 p-4 text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setExpanded(open ? null : date)}
                  aria-expanded={open}
                >
                  <span className="flex items-start justify-between gap-2 border-b border-border pb-3 text-sm font-semibold">
                    <span>
                      {DAY_NAMES[i]}{" "}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {date.slice(5).replace("-", "/")}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      {done ? (
                        <Check className="size-4 text-accent" />
                      ) : row?.status === "modified" ? (
                        <span className="font-bold text-primary">~</span>
                      ) : row?.status === "skipped" ? (
                        <Minus className="size-4 text-muted-foreground" />
                      ) : null}
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-2">
                    {row ? (
                      <>
                        <span className={cn("workout-chip", workoutClass[row.workout_type])}>
                          {typeLabel(row.workout_type)}
                        </span>
                        <span className="text-sm font-semibold">{Number(row.target_miles)} mi</span>
                        {row.pace_target && !matchedRun && (
                          <span className="truncate text-xs text-muted-foreground">
                            {row.pace_target}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="workout-chip workout-rest">Rest</span>
                        {byDate.has(date) && <Bike className="size-4 text-accent" />}
                      </>
                    )}
                    {matchedRun && match?.moved && (
                      <span className="text-sm font-medium">
                        Done {formatShortDate(matchedRun.date)} ·{" "}
                        {Number(matchedRun.distance_mi).toFixed(1)} mi ·{" "}
                        {formatPace(matchedRun.avg_pace_seconds)}
                      </span>
                    )}
                    {matchedRun && match?.moved && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        moved
                      </span>
                    )}
                    {matchedRun && !match?.moved && (
                      <span className="text-sm font-medium">
                        Done · {Number(matchedRun.distance_mi).toFixed(1)} mi ·{" "}
                        {formatPace(matchedRun.avg_pace_seconds)}
                      </span>
                    )}
                    {movedHere && run && (
                      <span className="text-sm text-muted-foreground">
                        {Number(run.distance_mi).toFixed(1)} mi · {formatPace(run.avg_pace_seconds)}{" "}
                        — counted as {movedRunNote(movedHere).replace(/^.*planned /, "")}’s{" "}
                        {typeLabel(movedHere.workout_type).toLowerCase()}
                      </span>
                    )}
                    {isExtra && run && (
                      <>
                        <span className="text-sm font-medium">
                          {Number(run.distance_mi).toFixed(1)} mi ·{" "}
                          {formatPace(run.avg_pace_seconds)}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Extra
                        </span>
                      </>
                    )}
                    {!movedHere && effort && (
                      <span
                        title={`${effortRangeLabel(effort)} per mile`}
                        className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent"
                      >
                        {effort}
                      </span>
                    )}
                    {shownRun && isRaceRun(shownRun) && (
                      <span className="rounded-full bg-caution px-2 py-0.5 text-xs font-semibold text-caution-foreground">
                        Race
                      </span>
                    )}
                    {!movedHere &&
                      shownRun &&
                      runFlags(shownRun, d.runs, d.trainingZones, d.splitsByActivity).map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-caution px-2 py-0.5 text-xs font-semibold text-caution-foreground"
                        >
                          {f}
                        </span>
                      ))}
                  </span>
                </button>
                {open && row && (
                  <div className="border-t border-border px-4 pb-4 pt-3 text-sm">
                    <p>{row.details}</p>
                    <p className="mt-1 font-medium text-primary">{row.purpose}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {weeklyEffortSummary(
          d.runs.filter((r) => dates.includes(r.date)),
          d.trainingZones,
        ) && (
          <p className="mt-3 text-sm text-muted-foreground">
            {weeklyEffortSummary(
              d.runs.filter((r) => dates.includes(r.date)),
              d.trainingZones,
            )}
          </p>
        )}
      </div>
      <Button
        className="mt-4 h-9 rounded-md"
        variant="secondary"
        onClick={() => setAdjustOpen(true)}
      >
        Adjust this week
      </Button>
      {next && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold">
            Next week · {next.phase} · {Number(next.target_miles)} mi
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {nextRows.map((r) => (
              <p key={r.id} className="text-sm text-muted-foreground">
                {r.date.slice(5)} · {typeLabel(r.workout_type)} {Number(r.target_miles)} mi
              </p>
            ))}
          </div>
        </details>
      )}
      <AdjustWeek d={d} dates={dates} open={adjustOpen} onOpenChange={setAdjustOpen} />
    </section>
  );
}

function HoldBanner({
  d,
  hold,
}: {
  d: Dashboard;
  hold: NonNullable<ReturnType<typeof longRunHold>>;
}) {
  const [dismissed, setDismissed] = useState(false);
  const plan = usePlanDayMutations(d.userId);
  const log = useLogPlanChange(d.userId);
  if (dismissed) return null;
  return (
    <div className="rounded-xl bg-caution/15 p-4 text-sm">
      <p>{hold.message}</p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            const row = d.weekRows[hold.dayIndex];
            if (!row) return;
            await plan.update.mutateAsync({
              id: row.id,
              target_miles: hold.suggestMi,
              min_miles: Math.max(1, hold.suggestMi - 1),
              max_miles: hold.suggestMi + 1,
              status: "modified",
            });
            await log.mutateAsync({
              what: `Long run held at ${hold.suggestMi} mi`,
              why: "Last long run was cut short",
            });
            setDismissed(true);
          }}
        >
          Apply
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Keep plan
        </Button>
      </div>
    </div>
  );
}

function AdjustWeek({
  d,
  dates,
  open,
  onOpenChange,
}: {
  d: Dashboard;
  dates: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const plan = usePlanDayMutations(d.userId);
  const log = useLogPlanChange(d.userId);
  const [id, setId] = useState("");
  const [why, setWhy] = useState("");
  const remaining = d.weekRows
    .map((row, i) => ({ row, i }))
    .filter(
      (x): x is { row: PlanDayRow; i: number } =>
        !!x.row && x.row.date >= d.today && x.row.status !== "skipped",
    );
  const selected = remaining.find((x) => x.row.id === id);
  const free = selected
    ? d.weekRows
        .map((row, i) => ({ row, i }))
        .find((x) => !x.row && (dates[x.i] ?? "") > selected.row.date)
    : null;
  const suggestion = selected
    ? free
      ? `Move ${DAY_NAMES[selected.i]}'s run to ${DAY_NAMES[free.i]}.`
      : `Skip ${DAY_NAMES[selected.i]}'s run and leave the rest unchanged.`
    : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust this week</DialogTitle>
          <DialogDescription>Only remaining days in this week can change.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="adjust-day">Which day can’t you run?</Label>
        <select
          id="adjust-day"
          className="h-10 rounded-md bg-muted px-3"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Choose a day</option>
          {remaining.map((x) => (
            <option key={x.row.id} value={x.row.id}>
              {DAY_NAMES[x.i]} · {typeLabel(x.row.workout_type)}
            </option>
          ))}
        </select>
        <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why? (optional)" />
        {suggestion && <p className="rounded-lg bg-muted p-3 text-sm">{suggestion}</p>}
        <Button
          disabled={!selected}
          onClick={async () => {
            if (!selected) return;
            const nextDate = free ? dates[free.i] : undefined;
            if (nextDate)
              await plan.update.mutateAsync({
                id: selected.row.id,
                date: nextDate,
                status: "modified",
              });
            else await plan.update.mutateAsync({ id: selected.row.id, status: "skipped" });
            await log.mutateAsync({ what: suggestion, why: why || "Adjust this week" });
            onOpenChange(false);
            toast.success("This week updated");
          }}
        >
          Apply change
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function MondayRecap({ d, recap }: { d: Dashboard; recap: ReturnType<typeof weekRecap> }) {
  const key = `recap-dismissed-${recap.weekStart}`;
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(key) === "1",
  );
  const [note, setNote] = useState<string | null>(null);
  if (dismissed) return null;
  const line =
    recap.longRun === "none planned" ? "no long run planned" : `long run ${recap.longRun}`;
  return (
    <section className="relative rounded-xl bg-muted p-4">
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2"
        aria-label="Dismiss recap"
        onClick={() => {
          localStorage.setItem(key, "1");
          setDismissed(true);
        }}
      >
        <X />
      </Button>
      <p className="text-xs font-semibold uppercase text-muted-foreground">Last week</p>
      <p className="mt-2 text-sm">
        {recap.actualMi} of {recap.plannedMi} mi · {line} · {recap.fastEasyRuns} easy pace flags
      </p>
      <p className="mt-1 text-sm font-medium">{recap.line}</p>
      {note ? (
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
      ) : (
        <Button
          className="mt-2"
          size="sm"
          variant="ghost"
          onClick={async () => {
            const r = await askCoach({
              data: {
                question: `Last week: ${recap.actualMi} of ${recap.plannedMi} miles, ${line}. One short note for this week.`,
                context: buildAiContext(d, {}),
              },
            });
            setNote(r.answer);
          }}
        >
          Coach note
        </Button>
      )}
    </section>
  );
}

const CHECKLIST = [
  { key: "expo", label: "Expo bib pickup" },
  { key: "transport", label: "Transport to the start · start-village time" },
  { key: "bag", label: "Bag check or poncho" },
  { key: "outfit", label: "Outfit tested on a long run" },
  { key: "fuel", label: "Fueling plan" },
  { key: "breakfast", label: "Breakfast plan and timing" },
  { key: "pace", label: "Pace plan: first 2 miles ~10:05, then 9:44" },
];
function RaceWeekChecklist({ d }: { d: Dashboard }) {
  const items = useChecklist(d.userId);
  const { seed, update } = useChecklistMutations(d.userId);
  const seeded = useRef(false);
  const [dismissed, setDismissed] = useState(false);
  const active = d.today >= isoDate(startOfWeek(new Date(`${d.raceDate}T12:00:00`)));
  useEffect(() => {
    if (!active || seeded.current || items.isLoading || (items.data ?? []).length) return;
    seeded.current = true;
    void seed.mutateAsync(
      CHECKLIST.map((x, i) => ({ ...x, sort_order: i, note: "", item_date: null, checked: false })),
    );
    // Seeds once per page load (guarded by `seeded`); the mutation object is
    // new on every render and must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items.isLoading, items.data?.length]);
  if (!active || dismissed || !(items.data ?? []).length) return null;
  return (
    <section className="relative rounded-xl bg-muted p-4">
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2"
        aria-label="Dismiss checklist"
        onClick={() => setDismissed(true)}
      >
        <X />
      </Button>
      <p className="text-xs font-semibold uppercase text-muted-foreground">Race week checklist</p>
      <ul className="mt-3 space-y-2">
        {(items.data ?? []).map((x) => (
          <li key={x.id} className="flex items-center gap-3">
            <Checkbox
              checked={x.checked}
              onCheckedChange={(v) => update.mutate({ id: x.id, checked: !!v })}
            />
            <span className="text-sm">{x.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AlreadyDone({
  run,
  workout,
}: {
  run: NonNullable<Dashboard["todayAlreadyDone"]>;
  workout: string;
}) {
  const day = new Date(`${run.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
  return (
    <div className="text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        <Check className="size-5 text-accent" aria-hidden />
        {workout} done {day} · {Number(run.distance_mi).toFixed(1)} mi ·{" "}
        {formatPace(run.avg_pace_seconds)} — today is optional
      </p>
    </div>
  );
}

/** Earned, fact-only line about the week that just finished. */
function earnedLine(d: Dashboard, week: Dashboard["weekMatch"]): string | null {
  const longest = week.longestRun;
  if (!longest) return null;
  const miles = Number(longest.distance_mi);
  const cycleBest = d.runs.every((r) => Number(r.distance_mi) <= miles);
  if (cycleBest) return `Longest run of the cycle: ${miles.toFixed(1)} mi`;
  if (longest.avg_pace_seconds != null && longest.avg_pace_seconds < d.goalPace)
    return `Longest run at ${formatPace(longest.avg_pace_seconds)} — inside goal race pace`;
  return null;
}

function WeekCompleteCard({ d }: { d: Dashboard }) {
  const week = d.weekMatch;
  const key = `week-complete-${week.weekStart}`;
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(key) === "1",
  );
  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(key) === "1");
  }, [key]);
  if (!week.complete || dismissed) return null;
  const longest = week.longestRun;
  const line = earnedLine(d, week);
  const label = new Date(`${week.weekStart}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <section className="relative rounded-xl border border-success/40 bg-success/12 p-4">
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(key, "1");
          setDismissed(true);
        }}
      >
        <X />
      </Button>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Check className="size-5 text-success" aria-hidden />
        Week of {label} complete
      </p>
      <p className="mt-2 text-sm">
        {week.actualMi} of {d.plannedWeekMi} mi · {week.runCount} runs
        {longest ? ` · longest ${Number(longest.distance_mi).toFixed(1)} mi` : ""}
        {week.daysEarly > 0
          ? ` · finished ${week.daysEarly} day${week.daysEarly === 1 ? "" : "s"} early`
          : ""}
      </p>
      {line && <p className="mt-1 text-sm font-medium">{line}</p>}
    </section>
  );
}
