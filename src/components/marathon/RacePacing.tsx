import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Dashboard } from "@/lib/dashboard";
import { courseCheckpoints, mileSplits } from "@/lib/nycCourse";
import { MARATHON_MI, formatDuration, formatPace } from "@/lib/training";

const MINUTE = 60;
const roundToMinute = (s: number) => Math.round(s / MINUTE) * MINUTE;

/** Signed seconds against even pace, e.g. "+29s" behind or "−9s" ahead. */
function vsEven(seconds: number): string {
  const s = Math.round(seconds);
  if (s === 0) return "even";
  return `${s > 0 ? "+" : "−"}${Math.abs(s)}s`;
}

/**
 * NYC Marathon pacing for any goal time: a slider that starts on the runner's
 * target, the official 5K/half checkpoints, and every mile with its course note.
 */
export function RacePacing({ d }: { d: Dashboard }) {
  const target = d.activeTarget?.target_seconds ?? null;
  const [override, setOverride] = useState<number | null>(null);
  const goal = override ?? target ?? 4.25 * 3600;
  const min = roundToMinute(Math.min(3.5 * 3600, (target ?? goal) - 30 * MINUTE));
  const max = roundToMinute(Math.max(5.5 * 3600, (target ?? goal) + 30 * MINUTE));

  const miles = useMemo(() => mileSplits(goal), [goal]);
  const checkpoints = useMemo(() => courseCheckpoints(goal), [goal]);

  return (
    <div className="space-y-6">
      <section className="surface-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label
              htmlFor="goal-time"
              className="text-xs font-semibold uppercase text-muted-foreground"
            >
              Goal time
            </label>
            <p className="stat-figure mt-1 text-4xl font-bold tnum">{formatDuration(goal)}</p>
            <p className="text-sm text-muted-foreground tnum">
              {formatPace(goal / MARATHON_MI)} average
            </p>
          </div>
          {target != null && override != null && override !== target && (
            <Button variant="secondary" size="sm" onClick={() => setOverride(null)}>
              Back to my target ({formatDuration(target)})
            </Button>
          )}
        </div>
        <input
          id="goal-time"
          type="range"
          min={min}
          max={max}
          step={MINUTE}
          value={goal}
          onChange={(e) => setOverride(Number(e.target.value))}
          className="mt-4 h-11 w-full cursor-pointer accent-primary"
          aria-valuetext={`${formatDuration(goal)} goal`}
        />
        <div className="flex justify-between text-xs text-muted-foreground tnum">
          <span>{formatDuration(min)}</span>
          <span>{formatDuration(max)}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Even effort on the NYC course: held back up and down the Verrazzano, slower on the
          Queensboro Bridge, the Bronx bridges and Fifth Avenue, a touch quicker on the flat
          Brooklyn miles. Dragging the slider only explores; your target changes in Settings.
        </p>
      </section>

      <section>
        <h3 className="section-kicker mb-4">Checkpoints</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          The official timing points (every 5K and the half) that tracking shows friends.
        </p>
        <table className="w-full text-sm tnum">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <th className="py-2">Point</th>
              <th className="py-2">NYC course</th>
              <th className="py-2">Even pace</th>
              <th className="py-2 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((c) => (
              <tr key={c.label} className="border-t border-border/60">
                <td className="py-1.5 font-medium">{c.label}</td>
                <td className="py-1.5 font-semibold">{formatDuration(c.course)}</td>
                <td className="py-1.5 text-muted-foreground">{formatDuration(c.even)}</td>
                <td className="py-1.5 text-right text-muted-foreground">
                  {vsEven(c.course - c.even)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="section-kicker mb-4">Mile by mile</h3>
        <div className="overflow-hidden rounded-xl bg-card text-sm shadow-card tnum">
          <div className="grid grid-cols-[3rem_4.5rem_5rem_minmax(0,1fr)] gap-x-3 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground max-sm:grid-cols-[2.5rem_4.5rem_5rem]">
            <span>Mile</span>
            <span>Pace</span>
            <span>Time</span>
            <span className="max-sm:hidden">Course</span>
          </div>
          {miles.map((m, i) => (
            <Fragment key={m.mile}>
              {m.borough !== miles[i - 1]?.borough && (
                <div className="bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                  {m.borough}
                </div>
              )}
              <div className="grid grid-cols-[3rem_4.5rem_5rem_minmax(0,1fr)] items-baseline gap-x-3 border-b border-border/50 px-4 py-2 last:border-b-0 max-sm:grid-cols-[2.5rem_4.5rem_5rem]">
                <span className="font-semibold">{m.label}</span>
                <span className={m.factor > 1.015 ? "font-semibold text-caution-foreground" : ""}>
                  {formatPace(m.paceSeconds).replace("/mi", "")}
                </span>
                <span>{formatDuration(m.cumulativeSeconds)}</span>
                <span className="text-muted-foreground max-sm:col-span-3 max-sm:mt-0.5 max-sm:text-xs">
                  {m.note}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Bold paces mark the climbs where the plan budgets extra time.
        </p>
      </section>
    </div>
  );
}
