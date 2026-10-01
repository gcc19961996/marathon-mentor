import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Check, Footprints, Loader2, Pencil, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RunMileDetail } from "@/components/marathon/RunMileDetail";
import {
  useAddRuns,
  useMilestoneMutations,
  usePlanDayMutations,
  useRunMutations,
  type Run,
} from "@/lib/data";
import type { Dashboard } from "@/lib/dashboard";
import { predictFromTraining } from "@/lib/paceAnalysis";
import {
  clockLeftRunning,
  flagSplits,
  formatStop,
  STOP_DISPLAY_SECONDS,
  stoppedSeconds,
} from "@/lib/splitFlags";
import { autoCompleteDate, formatMilestoneDate, shortMilestoneDate } from "@/lib/milestones";
import { parsePastedRuns, type PastedRow } from "@/lib/tracking";
import { typeLabel } from "@/lib/fixedPlan";
import {
  effortFor,
  effortRangeLabel,
  isRaceRun,
  runFlags,
  runLengthLabel,
  type EffortKey,
} from "@/lib/effort";
import { relativeTime, useStravaStatus, useStravaSync } from "@/lib/strava";
import {
  WORKOUT_TYPES,
  formatDuration,
  formatPace,
  isoDate,
  parseDuration,
  startOfWeek,
} from "@/lib/training";

// Grows a small control's touch area to ~44px tall without changing how it looks.
const TAP = "relative after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']";

export function ProgressTab({ d, prefillRun = 0 }: { d: Dashboard; prefillRun?: number }) {
  return (
    <div className="space-y-6">
      <LogRun d={d} prefillRun={prefillRun} />
      <RunLog d={d} />
      <MileageChart d={d} />
      <Milestones d={d} />
      <PastWeeks d={d} />
      <Collapsible title="Pace zones">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          Your plan paces
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(d.trainingZones.length ? d.trainingZones : d.zones).map((z) => (
            <div
              key={z.key}
              className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{z.name}</p>
                <p className="text-xs text-muted-foreground">{z.note}</p>
              </div>
              <p className="text-sm font-semibold tnum">
                {z.key === "strides"
                  ? "no pace"
                  : z.from === z.to
                    ? formatPace(z.from)
                    : `${formatPace(z.from)}–${formatPace(z.to)}`}
              </p>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

function LogRun({ d, prefillRun }: { d: Dashboard; prefillRun: number }) {
  const { add } = useRunMutations(d.userId);
  const planDays = usePlanDayMutations(d.userId);
  const [draft, setDraft] = useState({
    date: d.today,
    miles: "",
    time: "",
    notes: "",
    fast: "",
    gels: "",
    fluids: "",
    stomach: "",
    workout: "",
  });
  const [fuelOpen, setFuelOpen] = useState(false);
  const planned = d.planDays.find((row) => row.date === draft.date) ?? null;
  const distance = Number(draft.miles);
  const seconds = parseDuration(draft.time) ?? 0;
  const fastSeconds = parseDuration(draft.fast);
  const showFast = planned?.workout_type === "tempo" || planned?.workout_type === "mp";
  // Fuelling opens by itself once the run reaches 10 miles.
  const longEnoughToFuel = distance >= 10;
  useEffect(() => setFuelOpen(longEnoughToFuel), [longEnoughToFuel]);

  const todayPlannedMiles = d.todayRow ? String(Number(d.todayRow.target_miles)) : "";
  useEffect(() => {
    if (!prefillRun) return;
    setDraft((x) => ({ ...x, date: d.today, miles: todayPlannedMiles }));
    document.getElementById("log-run")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefillRun, d.today, todayPlannedMiles]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(distance > 0)) {
      toast.error("Add the miles you ran");
      return;
    }
    const recentRaceMatch =
      d.profile?.recent_race_date === draft.date &&
      (draft.date === "2026-04-26"
        ? distance >= 13.1 && distance <= 13.8
        : Math.abs(distance - Number(d.profile?.recent_race_distance_mi ?? 0)) <= 0.1);
    await add.mutateAsync({
      date: draft.date,
      type: draft.workout || (recentRaceMatch ? "Race" : ""),
      distance_mi: distance,
      duration_seconds: seconds,
      avg_pace_seconds: seconds ? Math.round(seconds / distance) : null,
      source: "manual",
      notes: draft.notes || null,
      fast_segment_pace_seconds: fastSeconds ?? null,
      gels: draft.gels === "" ? null : Number(draft.gels),
      fluids_oz: draft.fluids === "" ? null : Number(draft.fluids),
      stomach: draft.stomach === "" ? null : Number(draft.stomach),
    });
    if (planned) {
      const min = Number(planned.min_miles ?? 0);
      const max = Number(planned.max_miles ?? planned.target_miles);
      await planDays.markDate.mutateAsync({
        date: draft.date,
        status: distance >= min && distance <= max ? "done" : "modified",
      });
    }
    setDraft({
      date: d.today,
      miles: "",
      time: "",
      notes: "",
      fast: "",
      gels: "",
      fluids: "",
      stomach: "",
      workout: "",
    });
    toast.success("Run logged");
  }

  return (
    <section id="log-run" className="surface-card workout-easy scroll-mt-6 border-l-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Log a run</h2>
        <PasteRuns d={d} />
      </div>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div>
          <Label htmlFor="new-date">Date</Label>
          <Input
            id="new-date"
            type="date"
            className="mt-1"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="new-miles">Miles</Label>
          <Input
            id="new-miles"
            inputMode="decimal"
            className="mt-1"
            value={draft.miles}
            onChange={(e) => setDraft({ ...draft, miles: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="new-time">Time</Label>
          <Input
            id="new-time"
            placeholder="mm:ss or h:mm:ss"
            className="mt-1"
            value={draft.time}
            onChange={(e) => setDraft({ ...draft, time: e.target.value })}
          />
        </div>
        {showFast && (
          <div>
            <Label htmlFor="new-fast">Fast-segment pace</Label>
            <Input
              id="new-fast"
              placeholder={planned?.workout_type === "tempo" ? "8:30" : "9:10"}
              className="mt-1"
              value={draft.fast}
              onChange={(e) => setDraft({ ...draft, fast: e.target.value })}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label htmlFor="new-notes">Notes</Label>
          <Input
            id="new-notes"
            className="mt-1"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
        <details
          className="sm:col-span-2"
          open={fuelOpen}
          onToggle={(e) => setFuelOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Fuelling
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="new-gels">Gels / chews</Label>
              <Input
                id="new-gels"
                className="mt-1"
                value={draft.gels}
                onChange={(e) => setDraft({ ...draft, gels: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-fluids">Fluids (oz)</Label>
              <Input
                id="new-fluids"
                className="mt-1"
                value={draft.fluids}
                onChange={(e) => setDraft({ ...draft, fluids: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-stomach">Stomach (1–5)</Label>
              <Input
                id="new-stomach"
                className="mt-1"
                value={draft.stomach}
                onChange={(e) => setDraft({ ...draft, stomach: e.target.value })}
              />
            </div>
          </div>
        </details>
        <div>
          <Label htmlFor="new-workout">Workout (optional)</Label>
          <select
            id="new-workout"
            className="mt-1 h-10 w-full rounded-md bg-muted px-3 text-sm"
            value={draft.workout}
            onChange={(e) => setDraft({ ...draft, workout: e.target.value })}
          >
            <option value="">Auto</option>
            {WORKOUT_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <div className="flex items-center gap-3">
            <Button type="submit">Save run</Button>
            {planned && (
              <span className="text-sm text-muted-foreground">
                {typeLabel(planned.workout_type)} · {Number(planned.target_miles)} mi planned
              </span>
            )}
          </div>
          <StravaRow />
        </div>
      </form>
    </section>
  );
}

const WORKOUT_OPTIONS = ["Easy", "Tempo", "Strides", "Marathon-Pace", "Race"];

function workoutLabel(type: string, source: string) {
  if (!type) return null;
  if ((source === "strava_import" || source === "strava") && type === "Easy Run") return null;
  if (type === "Marathon-Pace" || type === "Marathon-Pace Run") return "MP workout";
  if (type === "Easy Run") return "Easy";
  return type;
}

function formatRunDate(date: string, weekday = true) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    ...(weekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
  });
}

function runDisplay(r: Run, d: Dashboard) {
  const race = isRaceRun(r);
  const altitude = r.date === "2026-09-25";
  const chips: { label: string; warning?: boolean; tooltip?: string }[] = [];
  if (!race && !altitude) {
    const effort = effortFor(r.avg_pace_seconds, d.trainingZones);
    if (effort) chips.push({ label: effort, tooltip: `${effortRangeLabel(effort)} per mile` });
  }
  const workout = workoutLabel(r.type, r.source);
  if (workout && workout !== "Race") chips.push({ label: workout });
  runFlags(r, d.runs, d.trainingZones, d.splitsByActivity).forEach((label) =>
    chips.push({ label, warning: true }),
  );
  return { race, chips };
}

function RunChips({ chips }: { chips: { label: string; warning?: boolean; tooltip?: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = chips.slice(0, 2);
  const hidden = chips.slice(2);
  const visible = expanded ? chips : shown;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {visible.map((chip) => (
        <span
          key={chip.label}
          title={chip.tooltip}
          className={
            chip.warning
              ? "whitespace-nowrap flag-tag bg-caution text-caution-foreground"
              : "whitespace-nowrap flag-tag bg-accent text-accent-foreground"
          }
        >
          {chip.label}
        </span>
      ))}
      {hidden.length > 0 && !expanded && (
        <button
          type="button"
          className={`shrink-0 flag-tag bg-foreground text-background ${TAP}`}
          title={hidden.map((chip) => chip.tooltip ?? chip.label).join(" · ")}
          aria-label={`Show ${hidden.length} more labels`}
          onClick={(event) => {
            // The chip sits inside a clickable run row; do not also open mile detail.
            event.stopPropagation();
            setExpanded(true);
          }}
        >
          +{hidden.length}
        </button>
      )}
      {expanded && hidden.length > 0 && (
        <button
          type="button"
          className={`text-xs text-muted-foreground underline ${TAP}`}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(false);
          }}
        >
          Less
        </button>
      )}
    </div>
  );
}

/** Average pace, plus the stopped time when the clock kept running. */
function PaceCell({ r }: { r: Run }) {
  const stopped = stoppedSeconds(r);
  const miles = Number(r.distance_mi || 0);
  const elapsedPace =
    r.elapsed_seconds && miles > 0
      ? `Elapsed pace ${formatPace(Math.round(Number(r.elapsed_seconds) / miles))}`
      : undefined;
  return (
    <span title={elapsedPace} className="block min-w-0 text-right tnum">
      <span className="block whitespace-nowrap">{formatPace(r.avg_pace_seconds)}</span>
      {stopped != null && stopped > STOP_DISPLAY_SECONDS && (
        <span className="mt-0.5 block whitespace-nowrap text-xs text-muted-foreground">
          stopped {formatStop(stopped)}
        </span>
      )}
    </span>
  );
}

function RunActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="run-actions flex items-center justify-center gap-3 transition-opacity">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={onEdit}
        aria-label="Edit run"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label="Delete run"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export const DISTANCE_FILTERS = ["Short", "Medium", "Long", "Race"] as const;
export type DistanceFilter = (typeof DISTANCE_FILTERS)[number];
const PACE_FILTERS: EffortKey[] = ["Easy", "Moderate", "Fast", "Tempo", "Hard"];

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function FilterPill({
  label,
  active,
  onClick,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center gap-1.5 rounded-none border-2 px-3 text-[11px] font-extrabold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 ${active ? "border-sidebar bg-sidebar text-sidebar-foreground" : "border-foreground bg-transparent text-foreground hover:bg-caution"}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {dot && <span className={`size-2 ${dot}`} aria-hidden />}
      {label}
    </button>
  );
}

function RunTableRow({
  r,
  d,
  open,
  onToggle,
  onEdit,
  onDelete,
}: {
  r: Run;
  d: Dashboard;
  open: boolean;
  onToggle: () => void;
  onEdit: (run: Run) => void;
  onDelete: () => void;
}) {
  const display = runDisplay(r, d);
  const rows = r.strava_activity_id
    ? (d.splitsByActivity.get(Number(r.strava_activity_id)) ?? [])
    : [];
  return (
    <>
      <div
        role="row"
        className={`group grid min-h-16 grid-cols-[140px_minmax(180px,1fr)_80px_96px_132px_80px] items-center gap-x-4 border-b border-border/50 px-5 ${rows.length ? "cursor-pointer" : ""}`}
        tabIndex={rows.length ? 0 : undefined}
        aria-expanded={rows.length ? open : undefined}
        onClick={() => rows.length && onToggle()}
        onKeyDown={(event) => {
          if (rows.length && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <div role="cell" className="whitespace-nowrap py-3 font-medium">
          {formatRunDate(r.date)}
        </div>
        <div role="cell" className="min-w-0 py-3">
          <div className="flex min-w-0 items-center gap-2 font-medium">
            {display.race ? (
              <Trophy className="size-4 shrink-0 text-caution-foreground" aria-label="Race" />
            ) : r.strava_activity_id ? (
              <Activity className="size-4 shrink-0 text-primary" aria-label="From Strava" />
            ) : (
              <Footprints className="size-4 shrink-0 text-muted-foreground" aria-label="Manual" />
            )}
            <span className="truncate">
              {display.race ? "Race" : runLengthLabel(r.distance_mi)}
            </span>
          </div>
          <div className="mt-1.5">
            <RunChips chips={display.chips} />
          </div>
          {rows.length > 0 && (
            <RunMileDetail
              run={r}
              rows={rows}
              open={false}
              onToggle={onToggle}
              labelledBy={`run-${r.id}`}
            />
          )}
        </div>
        <div role="cell" className="border-l border-border/40 py-3 pl-4 text-right tnum">
          {Number(r.distance_mi).toFixed(1)}
        </div>
        <div role="cell" className="py-3 text-right tnum">
          {r.duration_seconds ? formatDuration(r.duration_seconds) : "—"}
        </div>
        <div role="cell" className="min-w-0 py-3 text-right">
          <PaceCell r={r} />
        </div>
        <div role="cell" className="py-3" onClick={(event) => event.stopPropagation()}>
          <RunActions onEdit={() => onEdit(r)} onDelete={onDelete} />
        </div>
      </div>
      {open && rows.length > 0 && (
        <div role="row" className="border-b border-border px-5 pb-4">
          <div role="cell" className="col-span-full">
            <RunMileDetail
              run={r}
              rows={rows}
              open
              onToggle={onToggle}
              labelledBy={`run-${r.id}`}
              showToggle={false}
            />
          </div>
        </div>
      )}
    </>
  );
}

function RunMobileCard({
  r,
  d,
  open,
  onToggle,
  onEdit,
  onDelete,
}: {
  r: Run;
  d: Dashboard;
  open: boolean;
  onToggle: () => void;
  onEdit: (run: Run) => void;
  onDelete: () => void;
}) {
  const display = runDisplay(r, d);
  const rows = r.strava_activity_id
    ? (d.splitsByActivity.get(Number(r.strava_activity_id)) ?? [])
    : [];
  return (
    <article className="surface-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="flex min-w-0 items-center gap-2 font-medium">
          <span className="shrink-0 text-xs text-muted-foreground">{formatRunDate(r.date)}</span>
          {display.race ? (
            <Trophy className="size-4 shrink-0 text-caution-foreground" />
          ) : r.strava_activity_id ? (
            <Activity className="size-4 shrink-0 text-primary" />
          ) : (
            <Footprints className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{display.race ? "Race" : runLengthLabel(r.distance_mi)}</span>
        </p>
        <RunActions onEdit={() => onEdit(r)} onDelete={onDelete} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 border-y border-border/60 py-2 text-right text-sm tnum">
        <span>{Number(r.distance_mi).toFixed(1)} mi</span>
        <span>{r.duration_seconds ? formatDuration(r.duration_seconds) : "—"}</span>
        <PaceCell r={r} />
      </div>
      <div className="mt-3">
        <RunChips chips={display.chips} />
        <RunMileDetail
          run={r}
          rows={rows}
          open={open}
          onToggle={onToggle}
          labelledBy={`run-mobile-${r.id}`}
        />
      </div>
    </article>
  );
}

function StravaRow() {
  const status = useStravaStatus();
  const sync = useStravaSync();
  const [result, setResult] = useState<string | null>(null);
  const s = status.data;

  async function syncNow() {
    const res = await sync.mutateAsync();
    setResult(
      res.status === "ok"
        ? `${res.imported ?? 0} new runs · just now`
        : "Strava sync failed — reconnect",
    );
  }

  if (!s) return null;
  if (!s.connected) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => document.getElementById("open-settings")?.click()}
      >
        Connect Strava
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="inline-flex h-9 items-center rounded-md bg-success-soft px-3 text-sm font-semibold text-success-emphasis">
        ✓ Strava connected
      </span>
      <Button
        type="button"
        variant="secondary"
        className="h-9 rounded-md"
        onClick={syncNow}
        disabled={sync.isPending}
      >
        {sync.isPending ? (
          <>
            <Loader2 className="mr-1 size-4 animate-spin" />
            Syncing…
          </>
        ) : (
          "Sync now"
        )}
      </Button>
      <span className="text-xs text-muted-foreground">
        {sync.isPending ? "" : (result ?? `last synced ${relativeTime(s.lastSyncedAt)}`)}
      </span>
    </div>
  );
}

export function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="section-kicker cursor-pointer">{title}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function TargetSummary({ d }: { d: Dashboard }) {
  const training = predictFromTraining(d.runs, d.bestEffortRows, d.today, d.splitsByActivity);
  const target = d.activeTarget?.target_seconds ?? null;

  const verdict = (low: number, high: number) => {
    if (!target) return null;
    if (target < low) return "a stretch";
    if (target > high) return "conservative";
    return "on track";
  };
  const verdictClass = (v: string | null) =>
    v === "conservative"
      ? "text-success"
      : v === "on track"
        ? "text-caution-foreground"
        : "text-destructive";
  const hm = (seconds: number) => {
    const s = Math.round(seconds);
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  };

  const raceVerdict =
    d.predictedSeconds && target
      ? verdict(d.predictedSeconds * 0.98, d.predictedSeconds * 1.02)
      : null;
  const trainingVerdict = training && target ? verdict(training.low, training.high) : null;

  return (
    <section className="grid gap-6 sm:grid-cols-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Target</p>
        <p className="stat-figure text-3xl font-semibold">
          {d.activeTarget ? formatDuration(d.activeTarget.target_seconds) : "—"}
        </p>
        <p className="text-sm text-muted-foreground tnum">{formatPace(d.mp)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Predicted finish</p>
        <p className="stat-figure text-3xl font-semibold">
          {d.predictedSeconds ? formatDuration(d.predictedSeconds) : "—"}
        </p>
        <p className="text-sm text-muted-foreground">from your recent race</p>
      </div>
      <div>
        {raceVerdict || trainingVerdict ? (
          <p className="text-sm text-muted-foreground">
            {raceVerdict && d.predictedSeconds && (
              <span>
                vs recent race ({hm(d.predictedSeconds)}):{" "}
                <span className={`font-semibold ${verdictClass(raceVerdict)}`}>{raceVerdict}</span>
              </span>
            )}
            {raceVerdict && trainingVerdict && " · "}
            {trainingVerdict && training && (
              <span>
                vs training ({hm(training.low)}–{hm(training.high)}):{" "}
                <span className={`font-semibold ${verdictClass(trainingVerdict)}`}>
                  {trainingVerdict}
                </span>
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Add a recent race result to compare.</p>
        )}
      </div>
    </section>
  );
}

function Milestones({ d }: { d: Dashboard }) {
  const m = useMilestoneMutations(d.userId);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markDate, setMarkDate] = useState(isoDate());

  // Completion follows the run log; defaults are only ever seeded during setup.
  useEffect(() => {
    for (const row of d.milestones) {
      if (row.completed_date || row.is_custom) continue;
      const date = autoCompleteDate(row, d);
      if (date) m.update.mutate({ id: row.id, completed_date: date });
    }
    // Deliberately narrow: `d` and the mutation object change on every render,
    // and re-running on those would re-send the same updates in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.milestones, d.runs.length, d.weeks]);

  const rows = useMemo(
    () =>
      [...d.milestones].sort((a, b) => (a.target_date ?? "").localeCompare(b.target_date ?? "")),
    [d.milestones],
  );

  return (
    <section>
      <h3 className="section-kicker mb-4">Milestones</h3>
      <ol>
        {rows.map((row, i) => {
          const overdue = !row.completed_date && !!row.target_date && row.target_date < d.today;
          return (
            <li key={row.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex size-6 items-center justify-center rounded-full border ${
                    row.completed_date
                      ? "border-success bg-success text-success-foreground"
                      : "border-border"
                  }`}
                >
                  {row.completed_date && <Check className="size-3.5" />}
                </span>
                {i < rows.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="flex-1 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={`text-sm font-medium ${row.completed_date ? "" : "text-muted-foreground"}`}
                  >
                    {row.name}
                    {row.target_date && !row.name.startsWith("Peak week ·") && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatMilestoneDate(row.target_date)}
                      </span>
                    )}
                    {overdue && (
                      <span className="ml-2 flag-tag bg-caution text-caution-foreground">
                        Overdue
                      </span>
                    )}
                  </p>
                  {row.completed_date ? (
                    <span className="text-xs text-muted-foreground tnum">
                      {row.target_date && row.completed_date < row.target_date
                        ? `Done early · ${shortMilestoneDate(row.completed_date)}`
                        : `Done ${formatMilestoneDate(row.completed_date)}`}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMarkingId(row.id);
                        setMarkDate(isoDate());
                      }}
                    >
                      Mark done
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <Dialog open={!!markingId} onOpenChange={(v) => !v && setMarkingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>When did you complete this?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="date" value={markDate} onChange={(e) => setMarkDate(e.target.value)} />
            <Button
              onClick={async () => {
                if (!markingId) return;
                await m.update.mutateAsync({ id: markingId, completed_date: markDate });
                setMarkingId(null);
                toast.success("Milestone marked done");
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MileageChart({ d }: { d: Dashboard }) {
  const weekly = useMemo(() => {
    const start = startOfWeek();
    const weeks: { week: string; miles: number; target: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(start.getTime() - i * 7 * 86400000);
      const we = new Date(ws.getTime() + 6 * 86400000);
      const a = isoDate(ws);
      const b = isoDate(we);
      const miles = d.runs
        .filter((r) => r.date >= a && r.date <= b)
        .reduce((s, r) => s + Number(r.distance_mi), 0);
      weeks.push({
        week: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        miles: Math.round(miles * 10) / 10,
        target: Number(d.planWeeks.find((row) => row.start_date === a)?.target_miles ?? 0),
      });
    }
    return weeks;
  }, [d.runs, d.planWeeks]);

  const hasRuns = weekly.some((w) => w.miles > 0);
  const peak = Math.max(...weekly.flatMap((w) => [w.miles, w.target]));
  const step = peak <= 25 ? 5 : 10;
  const top = Math.max(step * 4, Math.ceil(peak / step) * step);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const currentWeekLabel = new Date(`${d.weekStart}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <section>
      <h3 className="section-kicker mb-4">Weekly mileage · last 8 weeks</h3>
      {hasRuns ? (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                width={32}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                allowDecimals={false}
                domain={[0, top]}
                ticks={ticks}
              />
              <Tooltip
                formatter={(v) => [`${v} mi`, "Total"]}
                cursor={{ fill: "var(--color-muted)" }}
              />
              <Bar
                dataKey="miles"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              {weekly
                .filter((w) => w.target > 0)
                .map((w) =>
                  w.week === currentWeekLabel ? (
                    <ReferenceLine
                      key={w.week}
                      x={w.week}
                      segment={[
                        { x: w.week, y: w.target },
                        { x: w.week, y: w.target },
                      ]}
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      label={{
                        value: "This week",
                        position: "insideTop",
                        fontSize: 11,
                        fill: "var(--color-muted-foreground)",
                      }}
                    />
                  ) : (
                    <ReferenceLine
                      key={w.week}
                      x={w.week}
                      segment={[
                        { x: w.week, y: w.target },
                        { x: w.week, y: w.target },
                      ]}
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                    />
                  ),
                )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No runs yet.</p>
      )}
    </section>
  );
}

function RunLog({ d }: { d: Dashboard }) {
  const { update, remove } = useRunMutations(d.userId);
  const planDays = usePlanDayMutations(d.userId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [distanceFilters, setDistanceFilters] = useState<DistanceFilter[]>([]);
  const [paceFilters, setPaceFilters] = useState<EffortKey[]>([]);
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [flagsOnly, setFlagsOnly] = useState(false);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [draft, setDraft] = useState({
    date: isoDate(),
    type: "",
    distance: "",
    duration: "",
    notes: "",
    gels: "",
    fluids: "",
    stomach: "",
  });

  const distance = Number(draft.distance);
  const duration = parseDuration(draft.duration) ?? 0;
  const pace = distance > 0 && duration > 0 ? Math.round(duration / distance) : null;
  const types = [...WORKOUT_TYPES.filter((t) => t !== "Rest"), "Race"];
  const longEnoughToFuel = distance >= 10;
  useEffect(() => {
    if (longEnoughToFuel) setFuelOpen(true);
  }, [longEnoughToFuel]);
  const filteredRuns = useMemo(
    () =>
      d.runs.filter((run) => {
        const race = isRaceRun(run);
        if (distanceFilters.length) {
          const bucket: DistanceFilter = race
            ? "Race"
            : runLengthLabel(run.distance_mi) === "Long run"
              ? "Long"
              : runLengthLabel(run.distance_mi) === "Medium run"
                ? "Medium"
                : "Short";
          if (!distanceFilters.includes(bucket)) return false;
        }
        if (paceFilters.length) {
          const effort = race ? null : effortFor(run.avg_pace_seconds, d.trainingZones);
          if (!effort || !paceFilters.includes(effort)) return false;
        }
        if (sourceFilters.length) {
          const bucket = run.strava_activity_id ? "Strava" : "Manual";
          if (!sourceFilters.includes(bucket)) return false;
        }
        if (warningsOnly && runFlags(run, d.runs, d.trainingZones, d.splitsByActivity).length === 0)
          return false;
        if (flagsOnly) {
          const rows = run.strava_activity_id
            ? d.splitsByActivity.get(Number(run.strava_activity_id))
            : null;
          const hasSuspect = rows ? flagSplits(run, rows).some((s) => !!s.flag) : false;
          if (!hasSuspect && !clockLeftRunning(run)) return false;
        }
        return true;
      }),
    [
      d.runs,
      d.trainingZones,
      d.splitsByActivity,
      distanceFilters,
      paceFilters,
      sourceFilters,
      warningsOnly,
      flagsOnly,
    ],
  );
  const groupedRuns = useMemo(() => {
    const groups: { week: string; runs: Run[] }[] = [];
    for (const run of filteredRuns) {
      const date = new Date(`${run.date}T12:00:00`);
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const week = isoDate(monday);
      const group = groups.find((item) => item.week === week);
      if (group) group.runs.push(run);
      else groups.push({ week, runs: [run] });
    }
    return groups;
  }, [filteredRuns]);

  function openEdit(r: Run) {
    setEditingId(r.id);
    setFuelOpen(Number(r.distance_mi) >= 10);
    setDraft({
      date: r.date,
      type: r.type === "Rest" ? "" : r.type,
      distance: String(r.distance_mi),
      duration: r.duration_seconds ? formatDuration(r.duration_seconds) : "",
      notes: r.notes ?? "",
      gels: r.gels != null ? String(r.gels) : "",
      fluids: r.fluids_oz != null ? String(r.fluids_oz) : "",
      stomach: r.stomach != null ? String(r.stomach) : "",
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    if (!distance && !duration) {
      toast.error("Add a distance or a time");
      return;
    }
    const original = d.runs.find((row) => row.id === editingId);
    await update.mutateAsync({
      id: editingId,
      date: draft.date,
      type: draft.type,
      distance_mi: distance,
      duration_seconds: duration,
      avg_pace_seconds: pace,
      notes: draft.notes || null,
      gels: draft.gels === "" ? null : Number(draft.gels),
      fluids_oz: draft.fluids === "" ? null : Number(draft.fluids),
      stomach: draft.stomach === "" ? null : Number(draft.stomach),
    });
    if (original?.date !== draft.date) {
      if (original && d.planDays.some((row) => row.date === original.date)) {
        await planDays.markDate.mutateAsync({ date: original.date, status: "planned" });
      }
      const linked = d.planDays.find((row) => row.date === draft.date);
      if (linked) {
        const min = Number(linked.min_miles ?? 0);
        const max = Number(linked.max_miles ?? linked.target_miles);
        await planDays.markDate.mutateAsync({
          date: draft.date,
          status: distance >= min && distance <= max ? "done" : "modified",
          runId: editingId,
        });
      }
    }
    setEditingId(null);
    toast.success("Run updated");
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-kicker mb-4">
          Run log · {d.runs.length} run{d.runs.length === 1 ? "" : "s"}
        </h3>
      </div>
      <div className="space-y-2" aria-label="Filter runs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">
            Distance
          </span>
          {DISTANCE_FILTERS.map((value) => (
            <FilterPill
              key={value}
              label={value}
              active={distanceFilters.includes(value)}
              onClick={() => setDistanceFilters(toggleValue(distanceFilters, value))}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">
            Pace
          </span>
          {PACE_FILTERS.map((value) => (
            <FilterPill
              key={value}
              label={effortRangeLabel(value)}
              dot={
                value === "Easy"
                  ? "bg-success"
                  : value === "Moderate"
                    ? "bg-chart-4"
                    : value === "Fast"
                      ? "bg-caution"
                      : value === "Tempo"
                        ? "bg-primary"
                        : "bg-destructive"
              }
              active={paceFilters.includes(value)}
              onClick={() => setPaceFilters(toggleValue(paceFilters, value))}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">
            Other
          </span>
          {["Strava", "Manual"].map((value) => (
            <FilterPill
              key={value}
              label={value}
              active={sourceFilters.includes(value)}
              onClick={() => setSourceFilters(toggleValue(sourceFilters, value))}
            />
          ))}
          <div className="flex flex-wrap gap-2 md:ml-auto">
            <FilterPill
              label="With warnings"
              active={warningsOnly}
              onClick={() => setWarningsOnly(!warningsOnly)}
            />
            <FilterPill
              label="With flags"
              active={flagsOnly}
              onClick={() => setFlagsOnly(!flagsOnly)}
            />
            {(distanceFilters.length > 0 ||
              paceFilters.length > 0 ||
              sourceFilters.length > 0 ||
              warningsOnly ||
              flagsOnly) && (
              <button
                type="button"
                className="ml-1 text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setDistanceFilters([]);
                  setPaceFilters([]);
                  setSourceFilters([]);
                  setWarningsOnly(false);
                  setFlagsOnly(false);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span className="text-sm text-muted-foreground tnum">
            Showing {filteredRuns.length} run{filteredRuns.length === 1 ? "" : "s"} ·{" "}
            {filteredRuns.reduce((sum, run) => sum + Number(run.distance_mi), 0).toFixed(1)} mi
          </span>
        </div>
      </div>

      <div className="run-log-scroll relative mt-4 max-h-[520px] overflow-auto rounded-lg border border-border bg-card">
        <div className="hidden sm:block">
          <div role="table" aria-label="Run log" className="min-w-[848px] text-sm">
            <div
              role="row"
              className="sticky top-0 z-30 grid h-9 grid-cols-[140px_minmax(180px,1fr)_80px_96px_132px_80px] items-center gap-x-4 bg-card px-5 text-left text-xs uppercase tracking-widest text-muted-foreground shadow-[0_1px_0_var(--color-border)]"
            >
              <div role="columnheader">Date</div>
              <div role="columnheader">Run</div>
              <div role="columnheader" className="border-l border-border/40 pl-4 text-right">
                Miles
              </div>
              <div role="columnheader" className="text-right">
                Time
              </div>
              <div role="columnheader" className="text-right">
                Pace
              </div>
              <div role="columnheader" className="text-center">
                Actions
              </div>
            </div>
            {groupedRuns.map((group) => (
              <div role="rowgroup" key={group.week} className="tnum">
                <div
                  role="row"
                  className="sticky top-9 z-20 border-y border-border/60 bg-muted px-5 py-2 text-left text-xs font-semibold text-muted-foreground"
                >
                  <div role="cell">
                    Week of {formatRunDate(group.week, false)} ·{" "}
                    {group.runs.reduce((sum, run) => sum + Number(run.distance_mi), 0).toFixed(1)}{" "}
                    mi · {group.runs.length} run{group.runs.length === 1 ? "" : "s"}
                  </div>
                </div>
                {group.runs.map((r) => (
                  <RunTableRow
                    key={r.id}
                    r={r}
                    d={d}
                    open={expandedRunId === r.id}
                    onToggle={() => setExpandedRunId(expandedRunId === r.id ? null : r.id)}
                    onEdit={openEdit}
                    onDelete={() => remove.mutate(r.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5 p-4 sm:hidden">
          {groupedRuns.map((group) => (
            <section key={group.week}>
              <p className="sticky top-0 z-20 bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
                Week of {formatRunDate(group.week, false)} ·{" "}
                {group.runs.reduce((sum, run) => sum + Number(run.distance_mi), 0).toFixed(1)} mi ·{" "}
                {group.runs.length} run{group.runs.length === 1 ? "" : "s"}
              </p>
              <div className="mt-2 space-y-2">
                {group.runs.map((r) => (
                  <RunMobileCard
                    key={r.id}
                    r={r}
                    d={d}
                    open={expandedRunId === r.id}
                    onToggle={() => setExpandedRunId(expandedRunId === r.id ? null : r.id)}
                    onEdit={openEdit}
                    onDelete={() => remove.mutate(r.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        {!filteredRuns.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No matching runs.</p>
        )}
      </div>

      <Dialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit run</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="rdate">Date</Label>
              <Input
                id="rdate"
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rtype">Workout (optional)</Label>
              <select
                id="rtype"
                className="h-10 w-full rounded-md bg-muted/60 px-3 text-sm"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              >
                <option value="">None</option>
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rdist">Miles</Label>
              <Input
                id="rdist"
                inputMode="decimal"
                value={draft.distance}
                onChange={(e) => setDraft({ ...draft, distance: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rdur">Time</Label>
              <Input
                id="rdur"
                placeholder="mm:ss"
                value={draft.duration}
                onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rnotes">Notes</Label>
              <Input
                id="rnotes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <details
              className="sm:col-span-2"
              open={fuelOpen}
              onToggle={(event) => setFuelOpen(event.currentTarget.open)}
            >
              <summary className="cursor-pointer text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Fuelling
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rgels">Gels / chews</Label>
                  <Input
                    id="rgels"
                    inputMode="numeric"
                    value={draft.gels}
                    onChange={(e) => setDraft({ ...draft, gels: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rfluids">Fluids (oz)</Label>
                  <Input
                    id="rfluids"
                    inputMode="numeric"
                    value={draft.fluids}
                    onChange={(e) => setDraft({ ...draft, fluids: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rstomach">Stomach (1–5)</Label>
                  <Input
                    id="rstomach"
                    inputMode="numeric"
                    value={draft.stomach}
                    onChange={(e) => setDraft({ ...draft, stomach: e.target.value })}
                  />
                </div>
              </div>
            </details>
            <div className="flex items-center gap-4 sm:col-span-2">
              <Button type="submit">Save changes</Button>
              {pace && (
                <p className="text-sm text-muted-foreground tnum">Pace {formatPace(pace)}</p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PasteRuns({ d }: { d: Dashboard }) {
  const addRuns = useAddRuns(d.userId);
  const planDays = usePlanDayMutations(d.userId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const rows: PastedRow[] = useMemo(
    () => (text.trim() ? parsePastedRuns(text, d.runs) : []),
    [text, d.runs],
  );
  const fresh = rows.filter((r) => r.status === "new");

  async function save() {
    if (!fresh.length) return;
    setBusy(true);
    try {
      await addRuns.mutateAsync(
        fresh.map((r) => {
          return {
            date: r.date,
            type: "",
            distance_mi: r.miles,
            duration_seconds: r.seconds,
            avg_pace_seconds: Math.round(r.seconds / r.miles),
            source: "strava_import",
            notes: r.notes,
          };
        }),
      );

      // Auto-link imported runs to the plan day they fall on.
      for (const r of fresh) {
        const row = d.planDays.find((p) => p.date === r.date);
        if (!row) continue;
        const min = row.min_miles != null ? Number(row.min_miles) : 0;
        const max = row.max_miles != null ? Number(row.max_miles) : Number(row.target_miles);
        await planDays.markDate.mutateAsync({
          date: r.date,
          status: r.miles >= min && r.miles <= max ? "done" : "modified",
        });
      }

      toast.success(`${fresh.length} run${fresh.length === 1 ? "" : "s"} imported`);
      setText("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" className="h-9 rounded-md" onClick={() => setOpen(true)}>
        Paste runs
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste runs</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            One run per line: date, miles, time, optional note — e.g.{" "}
            <span className="tnum">2026-09-17, 4.1, 36:05, easy loop</span>
          </p>
          <Textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"2026-09-17, 4.1, 36:05\n2026-09-20, 16, 2:35:10, long run"}
          />
          {rows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Miles</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5">{r.date || "—"}</td>
                      <td className="py-1.5">{Number.isFinite(r.miles) ? r.miles : "—"}</td>
                      <td className="py-1.5">{r.seconds ? formatDuration(r.seconds) : "—"}</td>
                      <td className="py-1.5">
                        <span
                          className={
                            r.status === "new"
                              ? "text-success"
                              : r.status === "duplicate"
                                ? "text-muted-foreground"
                                : "text-destructive"
                          }
                        >
                          {r.status}
                          {r.message ? ` — ${r.message}` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-4">
            <Button onClick={save} disabled={busy || !fresh.length}>
              Save {fresh.length || ""} new
            </Button>
            <p className="text-sm text-muted-foreground">Duplicates are skipped.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FuelingNotes({ d }: { d: Dashboard }) {
  const rows = d.runs.filter((r) => r.gels != null || r.fluids_oz != null || r.stomach != null);
  if (!rows.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nothing yet — fueling fields appear when you log a long run.
      </p>
    );
  return (
    <ul className="space-y-2 text-sm tnum">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap gap-x-4 text-muted-foreground">
          <span className="text-foreground">{r.date}</span>
          <span>{Number(r.distance_mi).toFixed(1)} mi</span>
          {r.gels != null && <span>{r.gels} gels</span>}
          {r.fluids_oz != null && <span>{r.fluids_oz} oz</span>}
          {r.stomach != null && <span>stomach {r.stomach}/5</span>}
          {r.notes && <span>{r.notes}</span>}
        </li>
      ))}
    </ul>
  );
}

export function PlanRules() {
  return (
    <ul className="space-y-2 text-sm text-muted-foreground">
      <li>Never make up missed miles; drop an easy run before a long run.</li>
      <li>
        A planned workout counts as done when a run within two days of it, in the same week, covers
        at least 75% of the distance.
      </li>
      <li>
        If a week has no matched long run at all, hold the next long run at the last completed
        distance. A long run moved to another day does not trigger this. Taper and race week never
        change.
      </li>
      <li>Running longer than planned never changes future weeks — the fixed plan stands.</li>
      <li>
        Check-ins only scale down. Legs or sleep at 2 or below, WHOOP under 34%, or pain means the
        minimum or rest.
      </li>
      <li>Pain that changes your stride means stop.</li>
      <li>
        After the Sep 29 16-miler, review average pace and feel. Around 10:00/mi and controlled
        means “On track for 4:15”; a grind means review the target, never change it automatically.
      </li>
      <li>Runs of 14+ miles: gel every 30–45 minutes and practice race shoes.</li>
      <li>Sauna is okay after hard runs. Skip cold plunges after key runs until after the race.</li>
    </ul>
  );
}

const WEEK_STATUS_STYLE: Record<string, string> = {
  complete: "bg-success/15 text-success",
  partial: "bg-caution/20 text-caution-foreground",
  missed: "bg-destructive/10 text-destructive",
  "in progress": "bg-accent/15 text-accent",
};

const WEEK_STATUS_LABEL: Record<string, string> = {
  complete: "✓ Complete",
  partial: "Partial",
  missed: "Missed",
  "in progress": "In progress",
};

function PastWeeks({ d }: { d: Dashboard }) {
  if (!d.pastWeeks.length) return null;
  return (
    <section>
      <h3 className="section-kicker mb-4">Past weeks</h3>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card shadow-card">
        {d.pastWeeks.map(({ week, match, status, done, total }) => (
          <li
            key={week.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">
                Week {week.week_number} · {formatRunDate(match.weekStart, false)}
              </span>
              <span className={`flag-tag ${WEEK_STATUS_STYLE[status] ?? ""}`}>
                {WEEK_STATUS_LABEL[status]}
              </span>
            </span>
            <span className="text-muted-foreground tnum">
              {match.actualMi} / {match.plannedMi} mi · {done} of {total} workouts
              {match.longestRun
                ? ` · longest ${Number(match.longestRun.distance_mi).toFixed(1)} mi`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
