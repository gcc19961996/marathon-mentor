import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { clearDeviceToken } from "@/lib/deviceToken";
import { exportAllData } from "@/lib/db.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useLogPlanChange,
  usePlanChanges,
  usePlanDayMutations,
  useSaveProfile,
  useSetTarget,
} from "@/lib/data";
import { SEED_DAYS } from "@/lib/seedPlan";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Dashboard } from "@/lib/dashboard";
import { StravaCard } from "./StravaCard";
import {
  DAY_NAMES,
  MARATHON_MI,
  formatDuration,
  formatPace,
  isoDate,
  parseDuration,
} from "@/lib/training";

const DISTANCES = [
  { label: "5K", mi: 3.10686 },
  { label: "10K", mi: 6.21371 },
  { label: "10 mile", mi: 10 },
  { label: "Half marathon", mi: 13.1094 },
  { label: "Marathon", mi: 26.2188 },
];

function SettingsForm({ d }: { d: Dashboard }) {
  const save = useSaveProfile(d.userId);
  const setTarget = useSetTarget(d.userId);
  const logChange = useLogPlanChange(d.userId);
  const p = d.profile;

  const [raceName, setRaceName] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [dist, setDist] = useState("13.1094");
  const [recentRaceDate, setRecentRaceDate] = useState("2026-04-26");
  const [time, setTime] = useState("");
  const [mileage, setMileage] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("");
  const [longDay, setLongDay] = useState("Sun");
  const [target, setTargetValue] = useState("");
  const [targetNote, setTargetNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!p) return;
    setRaceName(p.race_name);
    setRaceDate(p.race_date);
    setDist(String(p.recent_race_distance_mi ?? 13.1094));
    setRecentRaceDate(p.recent_race_date ?? "2026-04-26");
    setTime(p.recent_race_seconds ? formatDuration(p.recent_race_seconds) : "1:47:00");
    setMileage(p.typical_weekly_mileage != null ? String(p.typical_weekly_mileage) : "");
    setDaysPerWeek(p.days_per_week != null ? String(p.days_per_week) : "");
    setLongDay(p.long_run_day ?? "Sun");
    // Seed the form only when a different profile loads; refetches of the same
    // record must not overwrite what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  useEffect(() => {
    if (d.activeTarget) setTargetValue(formatDuration(d.activeTarget.target_seconds));
    // Seed the form only when a different target loads; refetches of the same
    // record must not overwrite what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.activeTarget?.id]);

  const liveSeconds = parseDuration(time);
  const predicted =
    liveSeconds && Number(dist)
      ? Math.round(liveSeconds * Math.pow(MARATHON_MI / Number(dist), 1.06))
      : null;

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    const seconds = parseDuration(time);
    if (time && seconds == null) {
      toast.error("Enter the race time as h:mm:ss");
      return;
    }
    const targetSeconds = target ? parseDuration(target) : null;
    if (target && targetSeconds == null) {
      toast.error("Enter the target as h:mm:ss");
      return;
    }
    setBusy(true);
    try {
      await save.mutateAsync({
        race_name: raceName,
        race_date: raceDate,
        recent_race_distance_mi: Number(dist),
        recent_race_date: recentRaceDate || null,
        recent_race_seconds: seconds,
        typical_weekly_mileage: mileage === "" ? null : Number(mileage),
        days_per_week: daysPerWeek === "" ? null : Number(daysPerWeek),
        long_run_day: longDay,
      });
      const changed = targetSeconds && targetSeconds !== (d.activeTarget?.target_seconds ?? null);
      if (changed) {
        await setTarget.mutateAsync({
          target_seconds: targetSeconds,
          target_pace_seconds: Math.round(targetSeconds / MARATHON_MI),
          note: targetNote || "",
        });
        setTargetNote("");
        await logChange.mutateAsync({
          what: `Target changed to ${formatDuration(targetSeconds)}`,
          why: targetNote || "Target updated in Settings",
        });
      }
      toast.success("Saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id="profile-settings"
      className="scroll-mt-6 grid gap-4 sm:grid-cols-2"
      onSubmit={saveAll}
    >
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="raceName">Race name</Label>
        <Input id="raceName" value={raceName} onChange={(e) => setRaceName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="raceDate">Race date</Label>
        <Input
          id="raceDate"
          type="date"
          value={raceDate}
          onChange={(e) => setRaceDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sdist">Recent race</Label>
        <select
          id="sdist"
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
        <Label htmlFor="stime">Finish time</Label>
        <Input id="stime" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sracedate">Recent race date</Label>
        <Input
          id="sracedate"
          type="date"
          value={recentRaceDate}
          onChange={(e) => setRecentRaceDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="smileage">Starting weekly mileage (used until runs are logged)</Label>
        <Input
          id="smileage"
          inputMode="decimal"
          value={mileage}
          onChange={(e) => setMileage(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sdpw">Days per week</Label>
        <Input
          id="sdpw"
          inputMode="numeric"
          value={daysPerWeek}
          onChange={(e) => setDaysPerWeek(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sday">Long-run day</Label>
        <select
          id="sday"
          className="h-10 w-full rounded-md bg-muted/60 px-3 text-sm"
          value={longDay}
          onChange={(e) => setLongDay(e.target.value)}
        >
          {DAY_NAMES.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Week 1: Sun (one-time)</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="starget">Target marathon time</Label>
        <Input id="starget" value={target} onChange={(e) => setTargetValue(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="snote">Why the change? (optional)</Label>
        <Input id="snote" value={targetNote} onChange={(e) => setTargetNote(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          Save
        </Button>
        <p className="text-sm text-muted-foreground">
          Predicted finish:{" "}
          <span className="font-medium text-foreground tnum">
            {predicted ? formatDuration(predicted) : "—"}
          </span>{" "}
          {predicted && <span className="tnum">({formatPace(predicted / MARATHON_MI)})</span>}
        </p>
      </div>

      {d.targets.length > 1 && (
        <ul className="space-y-1 text-sm text-muted-foreground tnum sm:col-span-2">
          {d.targets.slice(1).map((t) => (
            <li key={t.id}>
              {new Date(t.set_at).toLocaleDateString()} · {formatDuration(t.target_seconds)}
              {t.note ? ` · ${t.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function SettingsPanel({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-5">
      <section className="surface-card p-5">
        <h3 className="section-kicker mb-4">Race &amp; profile</h3>
        <SettingsForm d={d} />
      </section>
      <StravaCard />
      <SafetyNet d={d} />
    </div>
  );
}

function SafetyNet({ d }: { d: Dashboard }) {
  const changes = usePlanChanges(d.userId);
  const planDays = usePlanDayMutations(d.userId);
  const logChange = useLogPlanChange(d.userId);
  const [confirming, setConfirming] = useState(false);
  const exportData = useServerFn(exportAllData);

  async function downloadBackup() {
    try {
      const snapshot = await exportData();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marathon-backup-${isoDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch {
      toast.error("Backup failed — try again");
    }
  }

  async function reset() {
    await planDays.resetToSeed.mutateAsync(SEED_DAYS as never);
    await logChange.mutateAsync({ what: "Plan reset to the original plan", why: "Manual reset" });
    setConfirming(false);
    toast.success("Plan reset — your logged runs are untouched");
  }

  return (
    <div className="space-y-5">
      <section className="surface-card p-5">
        <h3 className="section-kicker">Plan change log</h3>
        {(changes.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No changes yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm tnum">
            {(changes.data ?? []).map((c) => (
              <li key={c.id} className="text-muted-foreground">
                <span className="text-foreground">
                  {new Date(c.changed_at).toLocaleDateString()}
                </span>{" "}
                · {c.what}
                {c.why ? ` · ${c.why}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card p-5">
        <h3 className="section-kicker">Reset plan</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Puts every day back to the original plan. Your logged runs stay exactly as they are.
        </p>
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogTrigger asChild>
            <Button className="mt-3 h-9 rounded-md" variant="secondary">
              Reset plan to original
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset the plan to the original?</AlertDialogTitle>
              <AlertDialogDescription>
                Every day goes back to the original plan. Nothing you&apos;ve logged is deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={reset}>Reset plan</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <section className="surface-card p-5">
        <h3 className="section-kicker">Backup</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Download everything — runs, plan, check-ins, milestones and settings — as a dated file you
          can keep or restore from.
        </p>
        <Button className="mt-3 h-9 rounded-md" variant="secondary" onClick={downloadBackup}>
          Download backup (JSON)
        </Button>
      </section>

      <section className="surface-card p-5">
        <h3 className="section-kicker">Device</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This device is remembered for 90 days. Lock it to require the passcode again.
        </p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => {
            clearDeviceToken();
            window.location.reload();
          }}
        >
          Lock this device
        </Button>
      </section>
    </div>
  );
}
