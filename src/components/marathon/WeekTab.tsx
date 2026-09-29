import { useMemo, useState } from "react";
import { Bike, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { askCoach } from "@/lib/ai.functions";
import {
  useCrossTraining,
  useLogPlanChange,
  usePlanDayMutations,
  type PlanDayRow,
} from "@/lib/data";
import { buildAiContext, type Dashboard } from "@/lib/dashboard";
import { typeLabel, weekDates } from "@/lib/fixedPlan";
import { longRunHold, weekRecap } from "@/lib/tracking";
import { DAY_NAMES, easyPaceFlag, formatPace, startOfWeek } from "@/lib/training";

export function WeekTab({ d }: { d: Dashboard }) {
  const planDays = usePlanDayMutations(d.userId);
  const logChange = useLogPlanChange(d.userId);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const dates = weekDates(d.weekStart);

  // Runs and cross-training sit on the day of the week they were logged.
  const weekStartDate = startOfWeek();
  const dayOf = (date: string) =>
    Math.round((new Date(`${date}T00:00:00`).getTime() - weekStartDate.getTime()) / 86400000);

  const runsByDay = new Map<number, (typeof d.runs)[number]>();
  for (const r of d.runs) {
    const i = dayOf(r.date);
    if (i >= 0 && i < 7) runsByDay.set(i, r);
  }

  const crossQ = useCrossTraining(d.userId);
  const crossByDay = new Map<number, { activity: string; minutes: number }>();
  for (const c of crossQ.data ?? []) {
    const i = dayOf(c.date);
    if (i >= 0 && i < 7) crossByDay.set(i, c);
  }

  // Last week's plan powers the Monday recap and the short-long-run rule.
  const recap = useMemo(
    () =>
      d.lastWeekDays.some((x) => (x.distance_mi ?? 0) > 0)
        ? weekRecap(d.runs, d.lastWeekDays, d.lastWeekStart)
        : null,
    [d.runs, d.lastWeekDays, d.lastWeekStart],
  );

  const taperPhase = d.phaseLabel === "Taper" || d.phaseLabel === "Race week";
  const hold = useMemo(
    () =>
      d.lastWeekDays.some((x) => (x.distance_mi ?? 0) > 0)
        ? longRunHold({
            runs: d.runs,
            lastWeekPlan: d.lastWeekDays,
            lastWeekStart: d.lastWeekStart,
            activeDays: d.activeDays,
            taper: taperPhase,
          })
        : null,
    [d.runs, d.lastWeekDays, d.activeDays, taperPhase],
  );

  const [holdDismissed, setHoldDismissed] = useState(false);

  async function applyHold() {
    if (!hold) return;
    const row = d.weekRows[hold.dayIndex];
    if (!row) return;
    await planDays.update.mutateAsync({
      id: row.id,
      target_miles: hold.suggestMi,
      min_miles: Math.max(1, Math.round((hold.suggestMi - 1) * 10) / 10),
      max_miles: Math.round((hold.suggestMi + 1) * 10) / 10,
      status: "modified",
    });
    await logChange.mutateAsync({
      what: `Long run held at ${hold.suggestMi} mi (was ${hold.plannedMi} mi)`,
      why: "Last long run was cut short",
    });
    setHoldDismissed(true);
    toast.success("Long run held");
  }

  return (
    <div className="space-y-10">
      {recap && <MondayRecap d={d} recap={recap} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">This week</h2>
          <p className="text-sm text-muted-foreground tnum">
            {d.plannedWeekMi} mi planned · Suggested ceiling {d.weeklyLimitMi} mi · {d.ceilingReason}
          </p>
        </div>
        <Button onClick={() => setAdjustOpen(true)}>Adjust this week</Button>
      </div>

      {d.overCeilingMi > 0 && (
        <p className="rounded-lg bg-caution/15 px-3 py-2 text-sm text-foreground">
          {d.overCeilingMi} mi over suggested — keep the rest of the week easy.
        </p>
      )}

      {hold && !holdDismissed && (
        <div className="rounded-lg bg-caution/15 px-4 py-3">
          <p className="text-sm">{hold.message}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={applyHold}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setHoldDismissed(true)}>
              Keep plan
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-1">
        {d.weekRows.map((row, i) => (
          <li key={i} className="flex items-start gap-4 rounded-lg px-2 py-3 hover:bg-muted/50">
            <span className="w-10 pt-0.5 text-sm font-medium text-muted-foreground">
              {DAY_NAMES[i]}
            </span>
            <div className="flex-1">
              {row ? (
                <>
                  <p className="text-sm font-medium">
                    {typeLabel(row.workout_type)} · {Number(row.target_miles)} mi
                    {row.min_miles != null && row.max_miles != null && (
                      <span className="text-muted-foreground tnum">
                        {" "}
                        ({Number(row.min_miles)}–{Number(row.max_miles)})
                      </span>
                    )}
                    {row.pace_target && <span className="text-primary"> · {row.pace_target}</span>}
                    {row.status === "skipped" && (
                      <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                        skipped
                      </span>
                    )}
                  </p>
                  {row.details && <p className="text-xs text-muted-foreground">{row.details}</p>}
                  {row.purpose && <p className="text-xs text-muted-foreground">{row.purpose}</p>}
                </>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">Rest</p>
              )}
              {runsByDay.get(i) &&
                easyPaceFlag(runsByDay.get(i)!.type, runsByDay.get(i)!.avg_pace_seconds) && (
                  <p className="mt-1 inline-block rounded-full bg-caution px-2 py-0.5 text-xs font-semibold text-caution-foreground">
                    Too fast for an easy day · {formatPace(runsByDay.get(i)!.avg_pace_seconds)}
                  </p>
                )}
              {crossByDay.get(i) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Bike className="size-3.5" />
                  {crossByDay.get(i)!.activity} · {crossByDay.get(i)!.minutes} min
                </p>
              )}
            </div>
            {runsByDay.has(i) && (
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
                aria-label={`${DAY_NAMES[i]} logged`}
              >
                <Check className="size-3.5" />
              </span>
            )}
          </li>
        ))}
      </ul>

      <AdjustWeek
        d={d}
        dates={dates}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
      />
    </div>
  );
}

/** Edits only the remaining days of this week, one suggestion at a time. */
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
  const planDays = usePlanDayMutations(d.userId);
  const logChange = useLogPlanChange(d.userId);
  const [dayId, setDayId] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);

  const remaining = d.weekRows
    .map((row, i) => ({ row, i }))
    .filter((x): x is { row: PlanDayRow; i: number } => !!x.row && x.row.date >= d.today && x.row.status !== "skipped");

  const selected = remaining.find((x) => x.row.id === dayId) ?? null;

  // The first rest day still to come is where a missed session can go.
  const freeSlot = selected
    ? d.weekRows
        .map((row, i) => ({ row, i }))
        .find((x) => !x.row && (dates[x.i] ?? "") > selected.row.date && (dates[x.i] ?? "") >= d.today)
    : null;

  const suggestion = selected
    ? freeSlot
      ? `Move ${DAY_NAMES[selected.i]}'s ${typeLabel(selected.row.workout_type)} ${Number(selected.row.target_miles)} mi to ${DAY_NAMES[freeSlot.i]}.`
      : `Skip ${DAY_NAMES[selected.i]}'s ${typeLabel(selected.row.workout_type)} ${Number(selected.row.target_miles)} mi and leave the rest of the week as planned.`
    : null;

  async function apply() {
    if (!selected || !suggestion) return;
    setBusy(true);
    try {
      if (freeSlot && dates[freeSlot.i]) {
        await planDays.update.mutateAsync({
          id: selected.row.id,
          date: dates[freeSlot.i]!,
          status: "modified",
        });
      } else {
        await planDays.update.mutateAsync({ id: selected.row.id, status: "skipped" });
      }
      await logChange.mutateAsync({ what: suggestion, why: why || "Adjust this week" });
      setDayId("");
      setWhy("");
      onOpenChange(false);
      toast.success("This week updated");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust this week</DialogTitle>
          <DialogDescription>
            Only the days still to come change. Future weeks stay exactly as planned.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-day">Which day can&apos;t you run?</Label>
            <select
              id="adjust-day"
              className="h-10 w-full rounded-md bg-muted/60 px-3 text-sm"
              value={dayId}
              onChange={(e) => setDayId(e.target.value)}
            >
              <option value="">Choose a day</option>
              {remaining.map((x) => (
                <option key={x.row.id} value={x.row.id}>
                  {DAY_NAMES[x.i]} · {typeLabel(x.row.workout_type)} {Number(x.row.target_miles)} mi
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-why">Why? (optional)</Label>
            <Input
              id="adjust-why"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Travelling, work, tired"
            />
          </div>
          {suggestion && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{suggestion}</p>
          )}
          <Button onClick={apply} disabled={!suggestion || busy}>
            Apply change
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MondayRecap({ d, recap }: { d: Dashboard; recap: ReturnType<typeof weekRecap> }) {
  const storageKey = `recap-dismissed-${recap.weekStart}`;
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1",
  );
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (dismissed) return null;

  const longRunLine =
    recap.longRun === "none planned"
      ? "no long run planned"
      : `long run ${recap.longRun}${recap.longRunPlannedMi ? ` (${recap.longRunActualMi} of ${recap.longRunPlannedMi} mi)` : ""}`;

  async function coachNote() {
    setBusy(true);
    try {
      const res = await askCoach({
        data: {
          question: `Last week I planned ${recap.plannedMi} mi and ran ${recap.actualMi} mi, ${longRunLine}, ${recap.fastEasyRuns} easy runs too fast. Give me one short note for this week.`,
          context: buildAiContext(d, {}),
        },
      });
      setNote(res.answer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach your coach right now");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-muted/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Last week
          </h3>
          <p className="mt-2 text-sm tnum">
            {recap.actualMi} of {recap.plannedMi} mi planned · {longRunLine} · {recap.fastEasyRuns}{" "}
            easy run{recap.fastEasyRuns === 1 ? "" : "s"} too fast
          </p>
          <p className="mt-1 text-sm font-medium">{recap.line}</p>
          {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}
          <Button
            className="mt-3"
            size="sm"
            variant="ghost"
            onClick={coachNote}
            disabled={busy || !!note}
          >
            {busy ? "Asking…" : "Coach note"}
          </Button>
        </div>
        <button
          type="button"
          aria-label="Dismiss recap"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            window.localStorage.setItem(storageKey, "1");
            setDismissed(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </section>
  );
}
