import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Dashboard } from "@/lib/dashboard";
import { RunMileDetail, runDetailStats } from "@/components/marathon/RunMileDetail";
import { TrainingPrediction } from "@/components/marathon/TrainingPrediction";
import { EFFORT_BANDS } from "@/lib/effort";
import { formatDuration, formatPace } from "@/lib/training";
import {
  RANGE_OPTIONS,
  TREND_COLORS,
  TREND_TYPES,
  bestEfforts,
  comparisonWindow,
  fitPaceDistance,
  inRange,
  keyTakeaway,
  likeForLike,
  longRunCheck,
  paceAtDistance,
  paceDistribution,
  paceDistancePoints,
  paceDistanceTrend,
  paceSummary,
  paceTrend,
  periodRangeLabel,
  predictFromTraining,
  predictionTrend,
  rangeStart,
  splitMiles,
  zoneMix,
  type RangeKey,
  type AnalysisRun,
  type PaceDistanceComparison,
  type PaceDistancePoint,
  type TrendType,
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

function paceDifference(seconds: number): string {
  if (seconds === 0) return "same pace";
  return `${Math.abs(Math.round(seconds))} s/mi ${seconds < 0 ? "faster" : "slower"}`;
}

function PaceDistanceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PaceDistancePoint }>;
}) {
  const point = payload?.find((item) => item.payload?.date)?.payload;
  if (!active || !point) return null;
  const difference = point.trendPace == null ? null : point.pace - point.trendPace;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-card">
      <p className="font-semibold">
        {new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      <p>
        {point.distance.toFixed(1)} mi · {formatPace(point.pace)}
      </p>
      <p>{point.type || (point.race ? "Race" : "Run")}</p>
      {difference != null && (
        <p className="mt-1 text-muted-foreground">{paceDifference(difference)} than your trend</p>
      )}
    </div>
  );
}

function RaceDot(props: any) {
  const { cx, cy, fill, opacity } = props;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <path
      d={`M ${cx} ${cy - 6} L ${cx + 6} ${cy} L ${cx} ${cy + 6} L ${cx - 6} ${cy} Z`}
      fill={fill}
      fillOpacity={opacity}
      stroke="var(--background)"
      strokeWidth={1.5}
    />
  );
}

function SmallDot(props: any) {
  const { cx, cy, fill, opacity } = props;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={2.5} fill={fill} fillOpacity={opacity} />;
}

export function PaceAnalysisTab({ d }: { d: Dashboard }) {
  const [range, setRange] = useState<RangeKey>("3m");
  const [types, setTypes] = useState<TrendType[]>(["Short", "Medium", "Long"]);
  const [expandedLongRunId, setExpandedLongRunId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<PaceDistanceComparison>("previous");
  const [effortNormalized, setEffortNormalized] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [showPaceHelp, setShowPaceHelp] = useState(false);
  const [paceVsDistanceOpen, togglePaceVsDistance] = useFoldedOnPhone();

  const from = rangeStart(d.today, range);
  const runs = useMemo(() => inRange(d.runs, from, d.today), [d.runs, from, d.today]);
  const split = useMemo(() => splitMiles(runs, d.splitsByActivity), [runs, d.splitsByActivity]);
  const miles = split.miles;
  const summary = useMemo(() => paceSummary(runs, miles), [runs, miles]);
  const trend = useMemo(
    () => paceTrend(runs, range, types, from, d.today),
    [runs, range, types, from, d.today],
  );
  const buckets = useMemo(() => paceDistribution(miles), [miles]);
  const mix = useMemo(() => zoneMix(miles), [miles]);
  const efforts = useMemo(
    () => bestEfforts(runs, d.bestEffortRows, d.splitsByActivity),
    [runs, d.bestEffortRows, d.splitsByActivity],
  );
  const goalPace = d.goalPace;

  const chartData = trend.map((p) => {
    const row: Record<string, string | number | null> = { label: p.label };
    for (const t of TREND_TYPES) {
      const v = p.values[t];
      row[t] = v ? v.pace : null;
      row[`${t}__runs`] = v ? v.runs : null;
      row[`${t}__miles`] = v ? v.miles : null;
    }
    return row;
  });

  const paces = trend.flatMap(
    (p) => TREND_TYPES.map((t) => p.values[t]?.pace).filter(Boolean) as number[],
  );
  // Always keep the easy band (9:50-10:20) and goal pace in view.
  const fastest = Math.min(goalPace - 20, ...(paces.length ? paces : [goalPace]));
  const slowest = Math.max(630, EASY_BAND.to + 10, ...(paces.length ? paces : []));
  const lo = Math.floor((fastest - 10) / 30) * 30;
  const hi = Math.ceil((slowest + 10) / 30) * 30;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 30) ticks.push(t);

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
    () => comparisonWindow(from, d.today, comparison),
    [from, d.today, comparison],
  );
  const comparisonRunsRaw = useMemo(
    () => (comparisonDates ? inRange(d.runs, comparisonDates.from, comparisonDates.to) : []),
    [d.runs, comparisonDates],
  );
  const comparisonAvailable =
    comparison !== "off" &&
    comparisonRunsRaw.filter((run) => run.distance_mi > 0 && run.duration_seconds > 0).length >= 3;
  const comparisonRuns = useMemo(
    () => (comparisonAvailable ? comparisonRunsRaw : []),
    [comparisonAvailable, comparisonRunsRaw],
  );
  const currentFit = useMemo(
    () => fitPaceDistance(runs, effortNormalized),
    [runs, effortNormalized],
  );
  const comparisonFit = useMemo(
    () => fitPaceDistance(comparisonRuns, effortNormalized),
    [comparisonRuns, effortNormalized],
  );
  const currentPoints = useMemo(
    () => paceDistancePoints(runs, effortNormalized, "current", currentFit),
    [runs, effortNormalized, currentFit],
  );
  const comparisonPoints = useMemo(
    () => paceDistancePoints(comparisonRuns, effortNormalized, "comparison", comparisonFit),
    [comparisonRuns, effortNormalized, comparisonFit],
  );
  const currentTrend = useMemo(() => paceDistanceTrend(currentFit), [currentFit]);
  const comparisonTrend = useMemo(() => paceDistanceTrend(comparisonFit), [comparisonFit]);
  const distanceRows = useMemo(() => likeForLike(runs, comparisonRuns), [runs, comparisonRuns]);
  const paceDistanceValues = [...currentPoints, ...comparisonPoints];
  const distanceValues = paceDistanceValues.map((point) => point.distance);
  const minDistance = distanceValues.length ? Math.min(...distanceValues) : 1;
  const maxDistance = distanceValues.length ? Math.max(...distanceValues) : 16;
  const distanceRatio = maxDistance / Math.max(minDistance, 0.1);
  const xPad = Math.max(0.08, Math.pow(distanceRatio, 0.1) - 1);
  const paceValues = [
    ...paceDistanceValues.map((point) => point.pace),
    EASY_BAND.from,
    EASY_BAND.to,
    goalPace,
  ];
  const paceMin = Math.min(...paceValues);
  const paceMax = Math.max(...paceValues);
  const pacePad = Math.max(15, (paceMax - paceMin) * 0.1);
  const paceTickStep = 30;
  const paceDomain: [number, number] = [
    Math.floor((paceMin - pacePad) / paceTickStep) * paceTickStep,
    Math.ceil((paceMax + pacePad) / paceTickStep) * paceTickStep,
  ];
  const paceDistanceTicks: number[] = [];
  for (let tick = paceDomain[0]; tick <= paceDomain[1]; tick += paceTickStep)
    paceDistanceTicks.push(tick);
  const distanceTicks = [2, 3, 4, 6, 8, 12, 16].filter(
    (tick) => tick >= minDistance / (1 + xPad) && tick <= maxDistance * (1 + xPad),
  );
  const currentEight = paceAtDistance(currentFit, 8);
  const comparisonEight = paceAtDistance(comparisonFit, 8);
  const currentLabel = periodRangeLabel(from, d.today);
  const currentTrendEnd = currentTrend.at(-1)?.pace ?? null;
  const comparisonTrendEnd = comparisonTrend.at(-1)?.pace ?? null;
  const showEightGuide =
    currentFit != null &&
    comparisonFit != null &&
    currentEight != null &&
    comparisonEight != null &&
    8 >= currentFit.minDistance &&
    8 <= currentFit.maxDistance &&
    8 >= comparisonFit.minDistance &&
    8 <= comparisonFit.maxDistance;
  const eightGap = showEightGuide
    ? Math.round((currentEight as number) - (comparisonEight as number))
    : null;
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
      <p className="text-sm text-muted-foreground">
        Beta — pace analysis from your Strava splits. More coming.
      </p>

      {/* range picker */}
      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setRange(o.key)}
              className={`h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${range === o.key ? "border-sidebar bg-sidebar text-sidebar-foreground" : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"}`}
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
        {split.excluded > 0 && (
          <p className="text-xs text-muted-foreground">
            {split.excluded} suspect {split.excluded === 1 ? "split" : "splits"} excluded
            {split.tooFast > 0 && ` · ${split.tooFast} too fast`}
            {split.tooSlow > 0 && ` · ${split.tooSlow} too slow`} — their miles still count towards
            your totals
          </p>
        )}
      </section>

      {/* pace key */}
      <section>
        <SectionTitle>Pace key</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {EFFORT_BANDS.map((band) => {
            const slice = mix.find((m) => m.zone === band.key);
            return (
              <div
                key={band.key}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-3 rounded-full" style={{ background: band.color }} />
                  {band.label}
                </span>
                <span className="text-sm font-semibold tnum">{slice ? `${slice.pct}%` : "—"}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="h-0 w-3 border-t-2 border-dashed border-foreground" />
              Goal race pace
            </span>
            <span className="text-sm font-semibold tnum">{formatPace(goalPace)}</span>
          </div>
        </div>
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

      {/* pace trend */}
      <Fold title="Pace trend by run type">
        <div className="flex flex-wrap gap-2">
          {TREND_TYPES.map((t) => {
            const on = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])}
                className={`flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${on ? "border-sidebar bg-sidebar text-sidebar-foreground" : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"}`}
              >
                <span className="size-2.5 rounded-full" style={{ background: TREND_COLORS[t] }} />
                {t}
              </button>
            );
          })}
        </div>
        {chartData.length === 0 ? (
          <div className="mt-4">
            <Empty>No runs in this period.</Empty>
          </div>
        ) : (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  reversed
                  domain={[lo, hi]}
                  ticks={ticks}
                  tickFormatter={(v: number) => formatPace(v).replace("/mi", "")}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  fontSize={12}
                />
                <ReferenceArea
                  y1={EASY_BAND.from}
                  y2={EASY_BAND.to}
                  fill="var(--chart-1)"
                  fillOpacity={0.1}
                />
                <ReferenceLine y={goalPace} stroke="var(--foreground)" strokeDasharray="4 4" />
                <Tooltip
                  formatter={(value: number, name: string, item: any) => {
                    const runs = item?.payload?.[`${name}__runs`];
                    const miles = item?.payload?.[`${name}__miles`];
                    return [`${formatPace(value)} · ${runs} runs · ${miles} mi`, name];
                  }}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                {types.map((t) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    stroke={TREND_COLORS[t]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {types
          .filter((t) => !trend.some((p) => p.values[t]))
          .map((t) => (
            <p key={t} className="mt-2 text-sm text-muted-foreground">
              No {t === "All runs" ? "runs" : `${t.toLowerCase()} runs`} in this period
            </p>
          ))}
      </Fold>

      {/* pace vs distance */}
      <section>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <FoldToggle open={paceVsDistanceOpen} onToggle={togglePaceVsDistance}>
                Pace vs distance
              </FoldToggle>
              <button
                type="button"
                onClick={() => setShowPaceHelp((v) => !v)}
                aria-expanded={showPaceHelp}
                aria-label="How to read this chart"
                className="relative inline-flex size-5 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground after:absolute after:-inset-3 after:content-[''] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                ?
              </button>
            </span>
          </SectionTitle>
          <div
            className={`flex shrink-0 flex-wrap items-center gap-4 ${paceVsDistanceOpen ? "" : "hidden"}`}
          >
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
              Show range
              <Switch
                checked={showRange}
                onCheckedChange={setShowRange}
                aria-label="Show confidence range"
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
              Effort-normalized
              <Switch
                checked={effortNormalized}
                onCheckedChange={setEffortNormalized}
                aria-label="Effort-normalized pace"
              />
            </label>
          </div>
        </div>
        {paceVsDistanceOpen && (
          <>
            <p className="-mt-3 mb-2 text-sm text-muted-foreground">
              Each dot is a run. Lines show your typical pace at that distance.
            </p>
            {showPaceHelp && (
              <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <p>Longer runs are naturally slower. This compares runs of the same distance.</p>
                <p>
                  If the whole line moves up over time at the same distances, you're getting faster.
                </p>
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Comparison period">
              {(
                [
                  ["previous", "vs previous period"],
                  ["last-year", "vs same period last year"],
                  ["off", "off"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={comparison === key ? "default" : "outline"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setComparison(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div
              className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
              aria-label="Chart key"
            >
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rotate-45 bg-chart-2" />
                Race
              </span>
            </div>
            {currentPoints.length === 0 ? (
              <Empty>No runs in this period.</Empty>
            ) : (
              <div>
                <div
                  className="mb-1 text-xs leading-tight text-muted-foreground"
                  aria-hidden="true"
                >
                  <p className="font-medium text-foreground">Pace (faster ↑)</p>
                  <p>min/mile</p>
                </div>
                <div className="h-80 w-full" data-pace-distance-chart>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart margin={{ top: 10, right: 92, bottom: 8, left: 4 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                        strokeOpacity={0.6}
                      />
                      <XAxis
                        type="number"
                        dataKey="distance"
                        scale="log"
                        domain={[Math.max(0.1, minDistance / (1 + xPad)), maxDistance * (1 + xPad)]}
                        ticks={distanceTicks}
                        tickFormatter={(value: number) => `${value}`}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis
                        type="number"
                        dataKey="pace"
                        reversed
                        domain={paceDomain}
                        ticks={paceDistanceTicks}
                        tickFormatter={(value: number) => formatPace(value).replace("/mi", "")}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        fontSize={12}
                      />
                      <ReferenceArea
                        y1={EASY_BAND.from}
                        y2={EASY_BAND.to}
                        fill="var(--chart-1)"
                        fillOpacity={0.1}
                        label={{
                          value: "Plan easy range 9:50–10:20",
                          position: "insideTopLeft",
                          fontSize: 11,
                          fill: "var(--muted-foreground)",
                        }}
                      />
                      <ReferenceLine
                        y={goalPace}
                        stroke="var(--foreground)"
                        strokeDasharray="4 4"
                      />
                      {showRange && comparisonFit?.standardError != null && (
                        <Area
                          data={comparisonTrend}
                          dataKey="band"
                          fill="var(--muted-foreground)"
                          fillOpacity={0.1}
                          stroke="none"
                          isAnimationActive={false}
                        />
                      )}
                      {showRange && currentFit?.standardError != null && (
                        <Area
                          data={currentTrend}
                          dataKey="band"
                          fill="var(--chart-2)"
                          fillOpacity={0.12}
                          stroke="none"
                          isAnimationActive={false}
                        />
                      )}
                      {comparisonFit && (
                        <Line
                          data={comparisonTrend}
                          dataKey="pace"
                          stroke="var(--muted-foreground)"
                          strokeWidth={2}
                          strokeOpacity={0.55}
                          dot={false}
                          isAnimationActive={false}
                        />
                      )}
                      {currentFit && (
                        <Line
                          data={currentTrend}
                          dataKey="pace"
                          stroke="var(--chart-2)"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      )}
                      {comparisonFit && comparisonTrendEnd != null && comparisonDates && (
                        <ReferenceDot
                          x={comparisonFit.maxDistance}
                          y={comparisonTrendEnd}
                          r={3}
                          fill="var(--muted-foreground)"
                          stroke="none"
                          label={{
                            value: comparisonDates.label,
                            position: "right",
                            fontSize: 11,
                            fill: "var(--muted-foreground)",
                          }}
                        />
                      )}
                      {currentFit && currentTrendEnd != null && (
                        <ReferenceDot
                          x={currentFit.maxDistance}
                          y={currentTrendEnd}
                          r={3}
                          fill="var(--chart-2)"
                          stroke="none"
                          label={{
                            value: currentLabel,
                            position: "right",
                            fontSize: 11,
                            fontWeight: 600,
                            fill: "var(--chart-2)",
                          }}
                        />
                      )}
                      {showEightGuide && (
                        <ReferenceLine
                          x={8}
                          stroke="var(--muted-foreground)"
                          strokeOpacity={0.4}
                          strokeWidth={1}
                          label={{
                            value: `${(eightGap as number) >= 0 ? "+" : "−"}${Math.abs(eightGap as number)} s/mi`,
                            position: "insideBottomRight",
                            fontSize: 11,
                            fill: "var(--muted-foreground)",
                          }}
                        />
                      )}
                      {showEightGuide && (
                        <ReferenceDot
                          x={8}
                          y={comparisonEight as number}
                          r={3.5}
                          fill="var(--muted-foreground)"
                          stroke="var(--background)"
                          strokeWidth={1}
                          label={{
                            value: `${formatPace(comparisonEight as number).replace("/mi", "")} before`,
                            position: "top",
                            fontSize: 11,
                            fill: "var(--muted-foreground)",
                          }}
                        />
                      )}
                      {showEightGuide && (
                        <ReferenceDot
                          x={8}
                          y={currentEight as number}
                          r={3.5}
                          fill="var(--chart-2)"
                          stroke="var(--background)"
                          strokeWidth={1}
                          label={{
                            value: `${formatPace(currentEight as number).replace("/mi", "")} now`,
                            position: "right",
                            fontSize: 11,
                            fontWeight: 600,
                            fill: "var(--chart-2)",
                          }}
                        />
                      )}
                      <Scatter
                        data={comparisonPoints.filter((point) => !point.race)}
                        fill="var(--muted-foreground)"
                        fillOpacity={0.28}
                        shape={<SmallDot />}
                        isAnimationActive={false}
                      />
                      <Scatter
                        data={comparisonPoints.filter((point) => point.race)}
                        fill="var(--muted-foreground)"
                        fillOpacity={0.32}
                        shape={<RaceDot />}
                        isAnimationActive={false}
                      />
                      <Scatter
                        data={currentPoints.filter((point) => !point.race)}
                        fill="var(--chart-2)"
                        isAnimationActive={false}
                      />
                      <Scatter
                        data={currentPoints.filter((point) => point.race)}
                        fill="var(--chart-2)"
                        shape={<RaceDot />}
                        isAnimationActive={false}
                      />
                      <Tooltip content={<PaceDistanceTooltip />} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 text-center text-xs text-muted-foreground" aria-hidden="true">
                  Run distance (miles)
                </p>
              </div>
            )}
            <div className="mt-3 space-y-2 text-sm">
              {!currentFit && currentPoints.length > 0 && (
                <p className="text-muted-foreground">
                  Current period: not enough runs to fit a trend.
                </p>
              )}
              {comparison !== "off" && !comparisonAvailable && (
                <p className="text-muted-foreground">
                  Comparison hidden — fewer than 3 runs in that period.
                </p>
              )}
              {comparisonAvailable && !comparisonFit && (
                <p className="text-muted-foreground">
                  Comparison period: not enough runs to fit a trend.
                </p>
              )}
              {currentFit &&
                comparisonFit &&
                currentEight != null &&
                comparisonEight != null &&
                comparisonDates && (
                  <p>
                    At 8 mi, your trend pace is {formatPace(currentEight)} now vs{" "}
                    {formatPace(comparisonEight)} in {comparisonDates.label} (
                    {currentEight - comparisonEight >= 0 ? "+" : "−"}
                    {Math.abs(Math.round(currentEight - comparisonEight))} s/mi). Average run
                    distance {currentFit.averageDistance.toFixed(1)} mi vs{" "}
                    {comparisonFit.averageDistance.toFixed(1)} mi.
                  </p>
                )}
              {effortNormalized && (
                <p className="text-muted-foreground">
                  Assumes similar effort on every run. Easy runs will look slower, so read the
                  trend, not the level.
                </p>
              )}
            </div>
            {distanceRows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="px-3 py-2 text-left">Distance</th>
                      <th className="px-3 py-2 text-right">Current</th>
                      <th className="px-3 py-2 text-right">Comparison</th>
                      <th className="px-3 py-2 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distanceRows.map((row) => (
                      <tr key={row.label} className="border-b border-border/70">
                        <th className="px-3 py-2 text-left font-medium">{row.label}</th>
                        <td className="px-3 py-2 text-right tnum">
                          {row.currentPace == null
                            ? "—"
                            : `${formatPace(row.currentPace)} · ${row.currentCount} ${row.currentCount === 1 ? "run" : "runs"}`}
                        </td>
                        <td className="px-3 py-2 text-right tnum">
                          {row.comparisonPace == null
                            ? "—"
                            : `${formatPace(row.comparisonPace)} · ${row.comparisonCount} ${row.comparisonCount === 1 ? "run" : "runs"}`}
                        </td>
                        <td className="px-3 py-2 text-right tnum">
                          {row.difference == null
                            ? "—"
                            : `${row.difference > 0 ? "+" : row.difference < 0 ? "−" : ""}${Math.abs(row.difference)} s/mi`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

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
                            <span className="rounded-full bg-caution px-2 py-0.5 text-xs font-semibold text-caution-foreground">
                              Faded
                            </span>
                          )}
                          {r.verdict === "negative" && (
                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-emphasis">
                              Negative split
                            </span>
                          )}
                          {r.verdict === "even" && (
                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-emphasis">
                              Even
                            </span>
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

      {/* distribution */}
      <Fold title="Pace distribution">
        {buckets.length === 0 ? (
          <div className="mt-4">
            <Empty>No per-mile splits in this period.</Empty>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  fontSize={12}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v: number) => [`${v} mi`, "Miles"]}
                  labelFormatter={(l) => `${l}/mi`}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <ReferenceLine
                  x={`${Math.floor((Math.floor(goalPace / 15) * 15) / 60)}:${String((Math.floor(goalPace / 15) * 15) % 60).padStart(2, "0")}`}
                  stroke="var(--foreground)"
                  strokeDasharray="4 4"
                />
                <Bar dataKey="miles" radius={[4, 4, 0, 0]}>
                  {buckets.map((b) => (
                    <Cell key={b.pace} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
            <div className="flex h-6 w-full overflow-hidden rounded-full">
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
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
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
                    {formatPace(e.pace)} ·{" "}
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ) : (
                <div key={i} className="surface-card p-4">
                  <p className="text-sm text-muted-foreground">Not enough splits yet.</p>
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
