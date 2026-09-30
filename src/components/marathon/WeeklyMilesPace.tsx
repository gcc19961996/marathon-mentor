import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeekVolume } from "@/lib/paceAnalysis";
import { formatPace } from "@/lib/training";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

const tooltipStyle = { borderRadius: 12, fontSize: 12 };

/**
 * Two charts on one weekly timeline: miles (with the week's longest run drawn
 * inside each bar) and average pace underneath, faster at the top.
 */
export function WeeklyMilesPace({ weeks, goalPace }: { weeks: WeekVolume[]; goalPace: number }) {
  const paces = weeks.map((w) => w.pace).filter((p): p is number => p != null);
  const lo = Math.floor((Math.min(goalPace, ...paces) - 15) / 30) * 30;
  const hi = Math.ceil((Math.max(goalPace, ...paces) + 15) / 30) * 30;
  const paceTicks: number[] = [];
  for (let t = lo; t <= hi; t += 30) paceTicks.push(t);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-muted-foreground/35" />
            Weekly miles
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            Longest run
          </span>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                xAxisId="week"
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              {/* Same weeks again, hidden, so the longest-run bar sits inside the weekly bar. */}
              <XAxis dataKey="label" xAxisId="inside" hide />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                fontSize={11}
                tickFormatter={(v: number) => `${v} mi`}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [
                  `${v} mi`,
                  name === "miles" ? "Weekly miles" : "Longest run",
                ]}
                labelFormatter={(l) => `Week of ${l}`}
              />
              <Bar
                isAnimationActive={false}
                dataKey="miles"
                xAxisId="week"
                maxBarSize={28}
                radius={[4, 4, 0, 0]}
                fill="var(--muted-foreground)"
                fillOpacity={0.35}
              />
              <Bar
                isAnimationActive={false}
                dataKey="longest"
                xAxisId="inside"
                maxBarSize={12}
                radius={[3, 3, 0, 0]}
                fill="var(--primary)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          Average pace, faster at the top · dashed line: goal {formatPace(goalPace)}
        </p>
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeks} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                reversed
                domain={[lo, hi]}
                ticks={paceTicks}
                tickLine={false}
                axisLine={false}
                width={40}
                fontSize={11}
                tickFormatter={clock}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${clock(v)}/mi`, "Average pace"]}
                labelFormatter={(l) => `Week of ${l}`}
              />
              <ReferenceLine y={goalPace} stroke="var(--foreground)" strokeDasharray="4 4" />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="pace"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--accent)" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
