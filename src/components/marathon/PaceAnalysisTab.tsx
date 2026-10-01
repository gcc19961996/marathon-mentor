import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dashboard } from "@/lib/dashboard";
import { RunMileDetail, runDetailStats } from "@/components/marathon/RunMileDetail";
import { TrainingPrediction } from "@/components/marathon/TrainingPrediction";
import { WeeklyMilesPace } from "@/components/marathon/WeeklyMilesPace";
import { formatDuration, formatPace } from "@/lib/training";
import {
  RANGE_OPTIONS,
  bestEfforts,
  comparisonWindow,
  fitPaceDistance,
  inRange,
  keyTakeaway,
  longRunCheck,
  paceAtDistance,
  paceSummary,
  predictionTrend,
  rangeStart,
  splitMiles,
  weeklyVolume,
  zoneMix,
  type RangeKey,
  type AnalysisRun,
  type BestEffort,
  type PaceDistanceComparison,
} from "@/lib/paceAnalysis";

const EASY_BAND = { from: 590, to: 620 };

function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return formatDuration(s);
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="section-kicker mb-4">{children}</h3>;
}

const RANGE_PHRASE: Record<RangeKey, string> = {
  "4w": "last 4 weeks",
  "3m": "last 3 months",
  "12m": "last 12 months",
};

function effortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The best on record (every run in the app) beneath a period's best effort. */
function RecordLine({ best, record }: { best: BestEffort; record: BestEffort }) {
  if (!record) return null;
  if (best && best.seconds <= record.seconds) {
    return <p className="mt-2 text-xs font-semibold text-success">Your best on record</p>;
  }
  return (
    <p className="mt-2 text-xs text-muted-foreground tnum">
      Best on record: {formatClock(record.seconds)} · {effortDate(record.date)}
    </p>
  );
}

/** Open on desktop; folded on phones so the tab opens on the takeaway. */
function useFoldedOnPhone(): [boolean, () => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false);
  }, []);
  return [open, () => setOpen((o) => !o)];
}

function FoldToggle({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 text-left md:pointer-events-none md:min-h-0"
      aria-expanded={open}
      onClick={onToggle}
    >
      {children}
      <ChevronDown
        className={`size-4 transition-transform md:hidden ${open ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );
}

/** A Pace Analysis section that folds on phones; folded content is not rendered. */
function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, toggle] = useFoldedOnPhone();
  return (
    <section>
      <h3 className={`section-kicker ${open ? "mb-4" : ""}`}>
        <FoldToggle open={open} onToggle={toggle}>
          {title}
        </FoldToggle>
      </h3>
      {open && children}
    </section>
  );
}

// The key takeaway compares the selected period with the one before it.
const COMPARISON: PaceDistanceComparison = "previous";

export function PaceAnalysisTab({ d }: { d: Dashboard }) {
  const [range, setRange] = useState<RangeKey>("3m");
  const [expandedLongRunId, setExpandedLongRunId] = useState<string | null>(null);

  const from = rangeStart(d.today, range);
  const runs = useMemo(() => inRange(d.runs, from, d.today), [d.runs, from, d.today]);
  const split = useMemo(() => splitMiles(runs, d.splitsByActivity), [runs, d.splitsByActivity]);
  const miles = split.miles;
  const summary = useMemo(() => paceSummary(runs, miles), [runs, miles]);
  const mix = useMemo(() => zoneMix(miles), [miles]);
  const efforts = useMemo(
    () => bestEfforts(runs, d.bestEffortRows, d.splitsByActivity),
    [runs, d.bestEffortRows, d.splitsByActivity],
  );
  const goalPace = d.goalPace;
  const weeks = useMemo(() => weeklyVolume(d.runs, from, d.today), [d.runs, from, d.today]);

  const targetSeconds = d.activeTarget?.target_seconds ?? null;
  const predTrend = useMemo(
    () =>
      predictionTrend(d.runs, d.bestEffortRows, from, d.today, d.splitsByActivity).map((p) => ({
        ...p,
        band: [p.low, p.high] as [number, number],
      })),
    [d.runs, d.bestEffortRows, from, d.today, d.splitsByActivity],
  );
  const predValues = predTrend.flatMap((p) => [p.low, p.high]);
  if (targetSeconds) predValues.push(targetSeconds);
  if (d.predictedSeconds) predValues.push(d.predictedSeconds);
  const HALF_HOUR = 1800;
  const predDomain: [number, number] = predValues.length
    ? [
        Math.floor(Math.min(...predValues) / HALF_HOUR) * HALF_HOUR,
        Math.ceil(Math.max(...predValues) / HALF_HOUR) * HALF_HOUR,
      ]
    : [0, HALF_HOUR];
  const predTicks: number[] = [];
  for (let t = predDomain[0]; t <= predDomain[1]; t += HALF_HOUR) predTicks.push(t);
  const longRuns = useMemo(
    () => longRunCheck(runs, d.splitsByActivity),
    [runs, d.splitsByActivity],
  );
  const comparisonDates = useMemo(
    () => comparisonWindow(from, d.today, COMPARISON),
    [from, d.today],
  );
  const comparisonRunsRaw = useMemo(
    () => (comparisonDates ? inRange(d.runs, comparisonDates.from, comparisonDates.to) : []),
    [d.runs, comparisonDates],
  );
  const comparisonAvailable =
    comparisonRunsRaw.filter((run) => run.distance_mi > 0 && run.duration_seconds > 0).length >= 3;
  const comparisonRuns = useMemo(
    () => (comparisonAvailable ? comparisonRunsRaw : []),
    [comparisonAvailable, comparisonRunsRaw],
  );
  const currentFit = useMemo(() => fitPaceDistance(runs, false), [runs]);
  const comparisonFit = useMemo(() => fitPaceDistance(comparisonRuns, false), [comparisonRuns]);
  const currentEight = paceAtDistance(currentFit, 8);
  const comparisonEight = paceAtDistance(comparisonFit, 8);
  const longestInRangeRun = useMemo(
    () =>
      runs.reduce<AnalysisRun | null>(
        (best, r) => (!best || Number(r.distance_mi) > Number(best.distance_mi) ? r : best),
        null,
      ),
    [runs],
  );
  const longestAllMi = useMemo(
    () => d.runs.reduce((m, r) => Math.max(m, Number(r.distance_mi || 0)), 0),
    [d.runs],
  );
  const allEfforts = useMemo(
    () => bestEfforts(d.runs, d.bestEffortRows, d.splitsByActivity),
    [d.runs, d.bestEffortRows, d.splitsByActivity],
  );
  const takeaway = useMemo(
    () =>
      keyTakeaway({
        currentEight,
        comparisonEight,
        comparisonLabel: comparisonDates?.label ?? null,
        currentAvgDistance: currentFit?.averageDistance ?? null,
        comparisonAvgDistance: comparisonFit?.averageDistance ?? null,
        pctEasyMiles: summary.pctEasyMiles,
        easyBand: EASY_BAND,
        rangeEfforts: efforts,
        allEfforts,
        rangeFrom: from,
        latestLongRun: longRuns[0] ?? null,
        longestInRangeRun,
        longestAllMi,
        summary,
      }),
    [
      currentEight,
      comparisonEight,
      comparisonDates,
      currentFit,
      comparisonFit,
      summary,
      efforts,
      allEfforts,
      from,
      longRuns,
      longestInRangeRun,
      longestAllMi,
    ],
  );

  return (
    <div className="space-y-6">
      {/* range picker */}
      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setRange(o.key)}
              className={`h-8 rounded-none border-2 px-3 text-[11px] font-extrabold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${range === o.key ? "border-sidebar bg-sidebar text-sidebar-foreground" : "border-foreground bg-transparent text-foreground hover:bg-caution"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {takeaway && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Key takeaway
            </p>
            <p className="mt-1 text-sm leading-relaxed">{takeaway}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          ⓘ Built from your Strava mile splits
          {split.excluded > 0 && (
            <>
              {" "}
              · {split.excluded} suspect {split.excluded === 1 ? "split" : "splits"} excluded
              {split.tooFast > 0 && ` · ${split.tooFast} too fast`}
              {split.tooSlow > 0 && ` · ${split.tooSlow} too slow`} — their miles still count
              towards your totals
            </>
          )}
        </p>
      </section>

      {/* summary */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Avg pace", value: formatPace(summary.avgPace) },
          { label: "Miles", value: summary.miles.toFixed(1) },
          { label: "Runs", value: String(summary.runs) },
          {
            label: "Easy miles",
            value: summary.pctEasyMiles == null ? "—" : `${summary.pctEasyMiles}%`,
          },
          { label: "Longest run", value: `${summary.longestMi.toFixed(1)} mi` },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="stat-figure text-2xl font-semibold tnum">{s.value}</p>
          </div>
        ))}
      </section>

      {/* weekly miles and pace */}
      <Fold title="Weekly miles and pace">
        <WeeklyMilesPace weeks={weeks} goalPace={goalPace} />
      </Fold>

      {/* long-run check */}
      <Fold title="Long-run check">
        {longRuns.length === 0 ? (
          <div className="mt-4">
            <Empty>No long runs (10+ mi) in this period.</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Miles</th>
                  <th className="px-3 py-2 text-right">Avg</th>
                  <th className="px-3 py-2 text-right">1st half</th>
                  <th className="px-3 py-2 text-right">2nd half</th>
                  <th className="px-3 py-2 text-right">Diff</th>
                  <th className="px-3 py-2 text-right">Slowest</th>
                  <th className="px-3 py-2 text-left">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {longRuns.map((r) => {
                  const run = d.runs.find((item) => item.id === r.id);
                  const rows = run?.strava_activity_id
                    ? (d.splitsByActivity.get(Number(run.strava_activity_id)) ?? [])
                    : [];
                  const detail = run ? runDetailStats(run, rows) : null;
                  const cleanAvg = detail?.cleanPace ?? null;
                  const showCleanAvg =
                    cleanAvg != null && r.avgPace != null && Math.abs(cleanAvg - r.avgPace) > 3;
                  const rowId = r.id ?? r.date;
                  const open = expandedLongRunId === rowId;
                  const toggle = () => setExpandedLongRunId(open ? null : rowId);
                  return (
                    <Fragment key={rowId}>
                      <tr
                        key={r.id ?? r.date}
                        className={`border-t border-border ${rows.length ? "cursor-pointer" : ""}`}
                        tabIndex={rows.length ? 0 : undefined}
                        aria-expanded={rows.length ? open : undefined}
                        onClick={() => rows.length && toggle()}
                        onKeyDown={(event) => {
                          if (rows.length && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault();
                            toggle();
                          }
                        }}
                      >
                        <td className="whitespace-nowrap px-3 py-2">
                          {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-2 text-right tnum">{r.miles.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right tnum">
                          {formatPace(r.avgPace)}
                          {showCleanAvg && (
                            <span className="block text-xs text-muted-foreground">
                              ({formatPace(cleanAvg)} excl. stops)
                            </span>
                          )}
                          {r.excluded > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {r.excluded} {r.excluded === 1 ? "split" : "splits"} excluded
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tnum">
                          {r.firstHalf == null ? "—" : formatPace(r.firstHalf)}
                        </td>
                        <td className="px-3 py-2 text-right tnum">
                          {r.secondHalf == null ? "—" : formatPace(r.secondHalf)}
                          {r.rawSecondHalf != null &&
                            r.secondHalf != null &&
                            r.rawSecondHalf !== r.secondHalf && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({formatPace(r.rawSecondHalf)} with stop)
                              </span>
                            )}
                        </td>
                        <td className="px-3 py-2 text-right tnum">
                          {r.diff == null ? "—" : `${r.diff > 0 ? "+" : ""}${r.diff}s`}
                        </td>
                        <td className="px-3 py-2 text-right tnum">
                          {r.slowestMile == null ? "—" : formatPace(r.slowestMile)}
                        </td>
                        <td className="px-3 py-2">
                          {r.verdict === "faded" && (
                            <span className="flag-tag bg-caution text-caution-foreground">
                              Faded
                            </span>
                          )}
                          {r.verdict === "negative" && (
                            <span className="flag-tag bg-accent text-accent-foreground">
                              Negative split
                            </span>
                          )}
                          {r.verdict === "even" && (
                            <span className="flag-tag bg-accent text-accent-foreground">Even</span>
                          )}
                          {run && rows.length > 0 && (
                            <RunMileDetail
                              run={run}
                              rows={rows}
                              open={false}
                              onToggle={toggle}
                              labelledBy={`long-${r.id}`}
                            />
                          )}
                        </td>
                      </tr>
                      {open && run && rows.length > 0 && (
                        <tr className="border-t border-border">
                          <td colSpan={8} className="px-3 pb-4">
                            <RunMileDetail
                              run={run}
                              rows={rows}
                              open
                              onToggle={toggle}
                              labelledBy={`long-${r.id}`}
                              showToggle={false}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Plan long-run pace: 9:50–10:15</p>
        {longRuns.some((r) => r.excluded > 0) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {longRuns.reduce((s, r) => s + r.excluded, 0)} suspect{" "}
            {longRuns.reduce((s, r) => s + r.excluded, 0) === 1 ? "split" : "splits"} excluded from
            halves and slowest mile
          </p>
        )}
      </Fold>

      {/* zone mix */}
      <Fold title="Zone mix">
        {miles.length === 0 ? (
          <div className="mt-4">
            <Empty>No per-mile splits in this period.</Empty>
          </div>
        ) : (
          <>
            <div className="flex h-6 w-full overflow-hidden">
              {mix
                .filter((s) => s.miles > 0)
                .map((s) => (
                  <div
                    key={s.zone}
                    style={{ width: `${s.pct}%`, background: s.color }}
                    title={`${s.zone} · ${s.miles} mi · ${s.pct}%`}
                  />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {mix
                .filter((s) => s.miles > 0)
                .map((s) => (
                  <span key={s.zone} className="flex items-center gap-1.5">
                    <span className="size-2.5" style={{ background: s.color }} />
                    {s.zone} {s.miles} mi · {s.pct}%
                  </span>
                ))}
            </div>
            {(mix.find((s) => s.zone === "Easy")?.pct ?? 0) < 70 && (
              <p className="mt-3 text-sm text-caution-foreground">
                Most miles are faster than easy. The plan asks for 9:50–10:20.
              </p>
            )}
          </>
        )}
      </Fold>

      {/* best efforts */}
      <Fold title="Best efforts">
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Fastest in the {RANGE_PHRASE[range]}: Strava's quickest continuous stretch with the clock
          running, so a mile with a stop in it doesn't count.
        </p>
        {efforts.every((e) => !e) ? (
          <div className="mt-4">
            <Empty>No per-mile splits in this period.</Empty>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {efforts.map((e, i) =>
              e ? (
                <div key={e.label} className="surface-card p-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {e.label}
                  </p>
                  <p className="stat-figure text-2xl font-semibold tnum">
                    {formatClock(e.seconds)}
                  </p>
                  <p className="text-sm text-muted-foreground tnum">
                    {formatPace(e.pace)} · {effortDate(e.date)}
                  </p>
                  <RecordLine best={e} record={allEfforts[i] ?? null} />
                </div>
              ) : (
                <div key={i} className="surface-card p-4">
                  <p className="text-sm text-muted-foreground">None in this period.</p>
                  <RecordLine best={null} record={allEfforts[i] ?? null} />
                </div>
              ),
            )}
          </div>
        )}
      </Fold>

      <section>
        <SectionTitle>Predicted finish from training</SectionTitle>
        <div>
          <TrainingPrediction d={d} />
        </div>
      </section>

      {/* predicted finish over time */}
      <Fold title="Predicted finish over time">
        {predTrend.length === 0 ? (
          <div className="mt-4">
            <Empty>Not enough data to predict a finish in this period.</Empty>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={predTrend} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  domain={predDomain}
                  ticks={predTicks}
                  tickFormatter={(v: number) =>
                    `${Math.floor(v / 3600)}:${String(Math.floor((v % 3600) / 60)).padStart(2, "0")}`
                  }
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  fontSize={12}
                />
                <Area
                  dataKey="band"
                  stroke="none"
                  fill="var(--chart-2)"
                  fillOpacity={0.15}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="seconds"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
                {targetSeconds && (
                  <ReferenceLine
                    y={targetSeconds}
                    stroke="var(--foreground)"
                    strokeDasharray="6 4"
                  />
                )}
                {d.predictedSeconds && (
                  <ReferenceLine
                    y={d.predictedSeconds}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="2 4"
                  />
                )}
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof predTrend)[number];
                    return (
                      <div className="rounded-xl border border-border bg-popover p-3 text-xs shadow-md">
                        <p className="font-semibold">Week of {p.label}</p>
                        <p className="tnum">
                          {formatDuration(p.seconds)} · {formatDuration(p.low)}–
                          {formatDuration(p.high)}
                        </p>
                        <p className="mt-1 text-muted-foreground tnum">
                          {p.basis.effort} {formatPace(p.basis.pace)} · longest {p.basis.longestMi}{" "}
                          mi · {p.basis.weeklyMi} mi/week
                        </p>
                      </div>
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Dashed line: 4:15:00 target
          {d.predictedSeconds
            ? ` · dotted line: ${formatDuration(d.predictedSeconds)} from your recent race`
            : ""}
        </p>
      </Fold>
    </div>
  );
}
