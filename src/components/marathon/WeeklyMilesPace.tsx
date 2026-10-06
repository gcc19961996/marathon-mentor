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

const asDate = (week: string) => new Date(`${week}T12:00:00`);
const shortDate = (week: string) =>
  asDate(week).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const weekOf = (week: unknown) => `Week of ${shortDate(String(week))}`;

/**
 * Which weeks get a date under the charts, shared by both so they line up.
 * Up to 9 weeks: every week ("Sep 14"). Longer: the first week of each month
 * ("Oct"), with the year on January and on the first label when it spans years.
 */
export function weekTicks(weeks: string[]): { ticks: string[]; format: (week: string) => string } {
  if (weeks.length <= 9) return { ticks: weeks, format: shortDate };
  const ticks = weeks.filter((w, i) => i === 0 || w.slice(5, 7) !== weeks[i - 1]?.slice(5, 7));
  // Drop a first label that would sit right next to the next month's label.
  if (ticks.length > 1 && weeks.indexOf(ticks[1] ?? "") < 2) ticks.shift();
  const multiYear = weeks[0]?.slice(0, 4) !== weeks[weeks.length - 1]?.slice(0, 4);
  return {
    ticks,
    format: (w) => {
      const d = asDate(w);
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const withYear = multiYear && (d.getMonth() === 0 || w === ticks[0]);
      return withYear ? `${month} '${String(d.getFullYear()).slice(2)}` : month;
    },
  };
}

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
  const { ticks, format } = weekTicks(weeks.map((w) => w.week));
  const xAxis = {
    dataKey: "week",
    ticks,
    interval: 0 as const,
    tickFormatter: format,
    tickLine: false,
    axisLine: false,
    fontSize: 11,
  };

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
              <XAxis {...xAxis} xAxisId="week" />
              {/* Same weeks again, hidden, so the longest-run bar sits inside the weekly bar. */}
              <XAxis dataKey="week" xAxisId="inside" hide />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
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
                labelFormatter={weekOf}
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
              {/* Band scale centres each point over its bar in the chart above. */}
              <XAxis {...xAxis} scale="band" />
              <YAxis
                reversed
                domain={[lo, hi]}
                ticks={paceTicks}
                tickLine={false}
                axisLine={false}
                width={48}
                fontSize={11}
                tickFormatter={clock}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${clock(v)}/mi`, "Average pace"]}
                labelFormatter={weekOf}
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
