import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Run, RunSplit } from "@/lib/data";
import { effortColor, effortFor } from "@/lib/effort";
import {
  flagLabel,
  flagSplits,
  formatStop,
  stoppedSeconds,
  usableSplits,
  type FlaggedSplit,
} from "@/lib/splitFlags";
import { formatPace } from "@/lib/training";

const LONG_MIN = 590;
const LONG_MAX = 615;
const GOAL_PACE = 584;

type DetailProps = {
  run: Run;
  rows: RunSplit[];
  open: boolean;
  onToggle: () => void;
  labelledBy: string;
  showToggle?: boolean;
};

function weightedPace(splits: Pick<FlaggedSplit, "distance" | "moving">[]): number | null {
  const distance = splits.reduce((sum, split) => sum + split.distance, 0);
  if (!distance) return null;
  return Math.round(splits.reduce((sum, split) => sum + split.moving, 0) / distance);
}

function sectionPaces(splits: FlaggedSplit[], sections: number): number[] {
  const totalDistance = splits.reduce((sum, split) => sum + split.distance, 0);
  if (!totalDistance) return [];
  const sectionDistance = totalDistance / sections;
  const times = Array.from({ length: sections }, () => 0);
  const distances = Array.from({ length: sections }, () => 0);
  let cursor = 0;
  for (const split of splits) {
    let remaining = split.distance;
    while (remaining > 0.0001) {
      const section = Math.min(sections - 1, Math.floor(cursor / sectionDistance));
      const boundary = (section + 1) * sectionDistance;
      const used = Math.min(remaining, Math.max(0.0001, boundary - cursor));
      times[section] = (times[section] ?? 0) + split.pace * used;
      distances[section] = (distances[section] ?? 0) + used;
      cursor += used;
      remaining -= used;
    }
  }
  return times.map((time, index) => Math.round(time / Math.max(0.0001, distances[index] ?? 0)));
}

function summaryValue(label: string, value: React.ReactNode) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tnum">{value}</dd>
    </div>
  );
}

function splitReason(split: FlaggedSplit): string | null {
  if (!split.flag) return null;
  if (split.elapsed != null && split.elapsed - split.moving > 60) {
    return `stop · ${formatStop(split.elapsed)} elapsed vs ${formatStop(split.moving)} moving`;
  }
  return split.reason
    ? `${flagLabel(split.flag)?.replace("Suspect split · ", "")} · ${split.reason}`
    : flagLabel(split.flag);
}

function splitLabel(split: FlaggedSplit, run: Run): string {
  if (split.partial)
    return `${Number(run.distance_mi).toFixed(1)} (${split.distance.toFixed(2)} mi)`;
  return String(split.mile);
}

export function runDetailStats(run: Run, rows: RunSplit[]) {
  const flagged = flagSplits(run, rows);
  const clean = usableSplits(flagged);
  const cleanPace = weightedPace(clean);
  const halves = sectionPaces(clean, 2);
  const quarters = sectionPaces(clean, 4);
  const includedPaces = clean.map((split) => split.pace);
  const fastest = includedPaces.length ? Math.min(...includedPaces) : null;
  const slowest = includedPaces.length ? Math.max(...includedPaces) : null;
  const excluded = flagged.filter((split) => split.flag).length;
  return { flagged, clean, cleanPace, halves, quarters, fastest, slowest, excluded };
}

export function RunMileDetail({
  run,
  rows,
  open,
  onToggle,
  labelledBy,
  showToggle = true,
}: DetailProps) {
  const stats = runDetailStats(run, rows);
  if (!rows.length) return null;
  const stopped = stoppedSeconds(run);
  const paceDiffers =
    stats.cleanPace != null &&
    run.avg_pace_seconds != null &&
    Math.abs(stats.cleanPace - run.avg_pace_seconds) > 3;
  const quarterDiff =
    stats.quarters.length === 4 ? (stats.quarters[3] ?? 0) - (stats.quarters[0] ?? 0) : null;
  const halfDiff =
    stats.halves.length === 2 ? (stats.halves[1] ?? 0) - (stats.halves[0] ?? 0) : null;
  const inRange = stats.clean.filter(
    (split) => split.pace >= LONG_MIN && split.pace <= LONG_MAX,
  ).length;
  const elevations = new Map(
    rows.map((row) => [row.mile_number, row.elevation_difference ?? null]),
  );
  const hasElevation = [...elevations.values()].some((value) => value != null);
  const scalePaces = stats.clean.map((split) => split.pace);
  const minPace = scalePaces.length ? Math.min(...scalePaces) : 480;
  const maxPace = scalePaces.length ? Math.max(...scalePaces) : 660;
  const padding = Math.max(12, Math.round((maxPace - minPace) * 0.1));
  const scaleFast = minPace - padding;
  const scaleSlow = maxPace + padding;
  const widthFor = (pace: number) =>
    Math.max(8, Math.min(100, ((scaleSlow - pace) / Math.max(1, scaleSlow - scaleFast)) * 100));
  const bandLeft = Math.min(widthFor(LONG_MIN), widthFor(LONG_MAX));
  const bandWidth = Math.abs(widthFor(LONG_MIN) - widthFor(LONG_MAX));
  let cumulative = 0;

  return (
    <div className="text-left">
      {showToggle && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-7 px-2 text-xs text-muted-foreground"
          aria-expanded={open}
          aria-controls={`${labelledBy}-detail`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          {open ? "Hide mile detail" : "Mile detail"}
        </Button>
      )}
      {open && (
        <div
          id={`${labelledBy}-detail`}
          className="mt-3 rounded-lg border border-border bg-muted/20 p-4"
          onClick={(event) => event.stopPropagation()}
        >
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {summaryValue("Distance", `${Number(run.distance_mi).toFixed(1)} mi`)}
            {summaryValue(
              "Moving pace",
              <>
                {formatPace(run.avg_pace_seconds)}
                {paceDiffers && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {formatPace(stats.cleanPace)} excl. stops
                  </span>
                )}
              </>,
            )}
            {summaryValue("Stopped", stopped != null && stopped > 60 ? formatStop(stopped) : "—")}
            {summaryValue(
              "Halves",
              stats.halves.length === 2
                ? `${formatPace(stats.halves[0])} · ${formatPace(stats.halves[1])}`
                : "—",
            )}
            {summaryValue("Fastest mile", formatPace(stats.fastest))}
            {summaryValue("Slowest mile", formatPace(stats.slowest))}
            {summaryValue(
              "Elevation gain",
              run.elevation_gain_ft != null ? `${Math.round(run.elevation_gain_ft)} ft` : "—",
            )}
          </dl>

          {stats.quarters.length === 4 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Quarters
              </p>
              <p className="mt-1 text-sm font-semibold tnum">
                {stats.quarters.map((pace) => formatPace(pace)).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                First to last quarter: {quarterDiff != null && quarterDiff > 0 ? "+" : ""}
                {quarterDiff ?? 0}s/mi
              </p>
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[540px] text-xs tnum">
              <thead>
                <tr className="border-b border-border text-left uppercase tracking-widest text-muted-foreground">
                  <th className="pb-2 pr-3">Mile</th>
                  <th className="pb-2 pr-3">Pace</th>
                  <th className="w-full pb-2 pr-3">Pace profile</th>
                  {hasElevation && <th className="pb-2 pr-3 text-right">Elev.</th>}
                  <th className="pb-2 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {stats.flagged.map((split) => {
                  cumulative += split.moving;
                  const reason = splitReason(split);
                  const color = effortColor(effortFor(split.pace) ?? "Easy");
                  const fastest = !split.flag && !split.partial && split.pace === stats.fastest;
                  const slowest = !split.flag && !split.partial && split.pace === stats.slowest;
                  const elevation = elevations.get(split.mile);
                  return (
                    <tr
                      key={split.mile}
                      className={`border-b border-border/50 align-top ${split.flag ? "text-muted-foreground opacity-65" : ""}`}
                    >
                      <td className="py-2 pr-3 font-semibold">{splitLabel(split, run)}</td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        {formatPace(split.pace)}
                        {fastest && (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-success-emphasis">
                            Fastest
                          </span>
                        )}
                        {slowest && (
                          <span className="ml-1 text-[10px] font-semibold uppercase text-caution-foreground">
                            Slowest
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="relative h-5 min-w-56 overflow-hidden rounded-sm bg-muted">
                          <span
                            className="absolute inset-y-0 bg-primary/10"
                            style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
                            aria-hidden="true"
                          />
                          <span
                            className="absolute inset-y-0 w-px bg-foreground/70"
                            style={{ left: `${widthFor(GOAL_PACE)}%` }}
                            aria-hidden="true"
                          />
                          <span
                            className={`absolute inset-y-1 left-0 rounded-r-sm ${split.flag ? "border border-muted-foreground bg-transparent" : ""}`}
                            style={{
                              width: `${widthFor(split.pace)}%`,
                              background: split.flag ? undefined : color,
                            }}
                            aria-hidden="true"
                          />
                        </div>
                        {reason && (
                          <p className="mt-1 font-sans text-[11px] normal-case tracking-normal">
                            {reason}
                          </p>
                        )}
                        {split.partial && (
                          <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                            Final partial mile · not ranked
                          </p>
                        )}
                      </td>
                      {hasElevation && (
                        <td className="whitespace-nowrap py-2 pr-3 text-right">
                          {elevation == null
                            ? "—"
                            : `${elevation > 0 ? "+" : ""}${Math.round(elevation)} ft`}
                        </td>
                      )}
                      <td className="whitespace-nowrap py-2 text-right">
                        {formatStop(cumulative)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {inRange} of {stats.clean.length} miles in the 9:50–10:15 range
            {halfDiff != null
              ? ` · second half ${Math.abs(halfDiff)} s/mi ${halfDiff < 0 ? "faster" : "slower"} than the first`
              : ""}
            .
          </p>
          {stats.excluded > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.excluded} {stats.excluded === 1 ? "split" : "splits"} excluded
            </p>
          )}
        </div>
      )}
    </div>
  );
}
