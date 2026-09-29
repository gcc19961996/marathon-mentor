import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveProfile, useSetTarget } from "@/lib/data";
import type { Dashboard } from "@/lib/dashboard";
import {
  DAY_NAMES,
  MARATHON_MI,
  formatDuration,
  formatPace,
  isoDate,
  parseDuration,
  riegel,
} from "@/lib/training";

const DISTANCES = [
  { label: "5K", mi: 3.10686 },
  { label: "10K", mi: 6.21371 },
  { label: "10 mile", mi: 10 },
  { label: "Half marathon", mi: 13.1094 },
  { label: "Marathon", mi: 26.2188 },
];

export function SetupScreen({ d }: { d: Dashboard }) {
  const saveProfile = useSaveProfile(d.userId);
  const setTarget = useSetTarget(d.userId);

  const [dist, setDist] = useState("13.1094");
  const [raceTime, setRaceTime] = useState("1:47:00");
  const [weekly, setWeekly] = useState("");
  const [longest, setLongest] = useState("");
  const [longestDate, setLongestDate] = useState(isoDate());
  const [daysPerWeek, setDaysPerWeek] = useState("4");
  const [longDay, setLongDay] = useState("Sun");
  const [target, setTargetValue] = useState("");
  const [busy, setBusy] = useState(false);

  const predicted = useMemo(() => {
    const secs = parseDuration(raceTime);
    if (!secs || !Number(dist)) return null;
    return riegel(Number(dist), secs, MARATHON_MI);
  }, [dist, raceTime]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const raceSeconds = parseDuration(raceTime);
    if (!raceSeconds) {
      toast.error("Enter your recent race time as h:mm:ss");
      return;
    }
    const targetSeconds = target ? parseDuration(target) : Math.round(predicted ?? 0);
    if (!targetSeconds) {
      toast.error("Enter a target time as h:mm:ss, or use Suggest one");
      return;
    }
    setBusy(true);
    try {
      await saveProfile.mutateAsync({
        recent_race_distance_mi: Number(dist),
        recent_race_seconds: raceSeconds,
        typical_weekly_mileage: weekly === "" ? null : Number(weekly),
        longest_run_mi: longest === "" ? null : Number(longest),
        longest_run_date: longest === "" ? null : longestDate,
        days_per_week: Number(daysPerWeek) || null,
        long_run_day: longDay,
        setup_complete: true,
      });
      await setTarget.mutateAsync({
        target_seconds: targetSeconds,
        target_pace_seconds: Math.round(targetSeconds / MARATHON_MI),
      });
      toast.success("You're set up — your plan is ready");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        {d.profile?.race_name ?? "Your race"}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Let&apos;s set your training up</h1>
      <p className="mt-2 text-muted-foreground">
        Six quick answers and your plan, paces and milestones are ready.
      </p>

      <form className="mt-10 space-y-8" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dist">Recent race</Label>
            <select
              id="dist"
              className="h-10 w-full rounded-md bg-muted/60 px-3 text-sm"
              value={dist}
              onChange={(e) => setDist(e.target.value)}
            >
              {DISTANCES.map((x) => (
                <option key={x.label} value={x.mi}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rt">Finish time</Label>
            <Input id="rt" value={raceTime} onChange={(e) => setRaceTime(e.target.value)} />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Predicted marathon:{" "}
          <span className="font-medium text-foreground tnum">
            {predicted ? formatDuration(predicted) : "—"}
          </span>{" "}
          {predicted && <span className="tnum">({formatPace(predicted / MARATHON_MI)})</span>}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="weekly">Current weekly mileage</Label>
            <Input
              id="weekly"
              inputMode="decimal"
              placeholder="e.g. 25"
              value={weekly}
              onChange={(e) => setWeekly(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dpw">Days per week you can run</Label>
            <Input
              id="dpw"
              inputMode="numeric"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="longest">Longest run this cycle (mi)</Label>
            <Input
              id="longest"
              inputMode="decimal"
              placeholder="e.g. 14"
              value={longest}
              onChange={(e) => setLongest(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="longestDate">When was it?</Label>
            <Input
              id="longestDate"
              type="date"
              value={longestDate}
              onChange={(e) => setLongestDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="longDay">Preferred long-run day</Label>
            <select
              id="longDay"
              className="h-10 w-full rounded-md bg-muted/60 px-3 text-sm"
              value={longDay}
              onChange={(e) => setLongDay(e.target.value)}
            >
              {DAY_NAMES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target">Target marathon time</Label>
            <div className="flex gap-2">
              <Input
                id="target"
                placeholder="3:45:00"
                value={target}
                onChange={(e) => setTargetValue(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  predicted
                    ? setTargetValue(formatDuration(Math.round(predicted)))
                    : toast.error("Add your recent race time first")
                }
              >
                Suggest one
              </Button>
            </div>
          </div>
        </div>

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Building your week…" : "Start training"}
        </Button>
      </form>
    </main>
  );
}
