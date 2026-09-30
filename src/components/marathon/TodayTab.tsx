import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AskBar } from "./AskBar";
import {
  useAddCrossTraining,
  useChecklist,
  useChecklistMutations,
  usePlanDayMutations,
  useRunMutations,
  useSaveCheckin,
} from "@/lib/data";
import type { Dashboard } from "@/lib/dashboard";
import { typeLabel } from "@/lib/fixedPlan";
import { longRunHold } from "@/lib/tracking";
import {
  formatPace,
  isoDate,
  parseDuration,
  startOfWeek,
  workoutPaceVerdict,
} from "@/lib/training";

export function TodayTab({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-10">
      <TodayCard d={d} />
      <RaceWeekChecklist d={d} />
      <CheckinRow d={d} />
      {d.todayRange.rest ? <CrossTrainingRow d={d} /> : <QuickLog d={d} />}
      <AskBar d={d} daysAvailable={[]} />
    </div>
  );
}

function TodayCard({ d }: { d: Dashboard }) {
  const r = d.todayRange;
  const row = d.todayRow;
  const type = row ? typeLabel(row.workout_type) : "Rest";

  // A short or missed long run last week carries a hold suggestion into the next one.
  const hold =
    row?.workout_type === "long" && d.lastWeekDays.some((x) => (x.distance_mi ?? 0) > 0)
      ? longRunHold({
          runs: d.runs,
          lastWeekPlan: d.lastWeekDays,
          lastWeekStart: d.lastWeekStart,
          activeDays: d.activeDays,
          taper: d.phaseLabel === "Taper" || d.phaseLabel === "Race week",
        })
      : null;

  return (
    <section className="rounded-2xl bg-muted/40 p-6">
      <h2 className="font-display text-2xl font-semibold">
        {r.rest ? "Rest today" : `${type} · ${r.headlineMi} mi`}
      </h2>

      {!r.rest && (
        <p className="mt-2 text-sm text-muted-foreground tnum">
          {r.minMi}–{r.maxMi} mi{row?.pace_target ? ` · ${row.pace_target}` : ""}
        </p>
      )}

      {row?.details && <p className="mt-3 text-sm">{row.details}</p>}

      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        {d.todayBullets.map((b, i) => (
          <li key={i}>• {b}</li>
        ))}
      </ul>

      {hold && (
        <p className="mt-4 rounded-lg bg-caution/15 px-3 py-2 text-sm text-foreground">
          {hold.message} Change it on the Week tab.
        </p>
      )}
    </section>
  );
}

function CheckinRow({ d }: { d: Dashboard }) {
  const save = useSaveCheckin(d.userId);
  const c = d.checkin;
  const [legFeel, setLegFeel] = useState(String(c?.leg_feel ?? 3));
  const [sleep, setSleep] = useState(String(c?.sleep_quality ?? 3));
  const [pain, setPain] = useState(c?.pain_note ?? "");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!c) return;
    setLegFeel(String(c.leg_feel ?? 3));
    setSleep(String(c.sleep_quality ?? 3));
    setPain(c.pain_note ?? "");
  }, [c?.id]);

  function persist(next: { legFeel?: string; sleep?: string; pain?: string }) {
    void save.mutateAsync({
      leg_feel: Number(next.legFeel ?? legFeel),
      sleep_quality: Number(next.sleep ?? sleep),
      pain_note: (next.pain ?? pain) || null,
      computed_min_mi: d.todayRange.minMi,
      computed_max_mi: d.todayRange.maxMi,
      rest_recommended: d.todayRange.rest,
    });
  }

  return (
    <section>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Morning check-in
      </h3>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-24 space-y-1.5">
          <Label htmlFor="leg">Legs</Label>
          <select
            id="leg"
            className="h-10 w-full rounded-md bg-muted/60 px-3 text-sm"
            value={legFeel}
            onChange={(e) => {
              setLegFeel(e.target.value);
              persist({ legFeel: e.target.value });
            }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}/5
              </option>
            ))}
          </select>
        </div>
        <div className="w-24 space-y-1.5">
          <Label htmlFor="sleep">Sleep</Label>
          <select
            id="sleep"
            className="h-10 w-full rounded-md bg-muted/60 px-3 text-sm"
            value={sleep}
            onChange={(e) => {
              setSleep(e.target.value);
              persist({ sleep: e.target.value });
            }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}/5
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="pain">Note</Label>
          <Input
            id="pain"
            value={pain}
            onChange={(e) => {
              const v = e.target.value;
              setPain(v);
              if (noteTimer.current) clearTimeout(noteTimer.current);
              noteTimer.current = setTimeout(() => persist({ pain: v }), 800);
            }}
            placeholder="optional — aches, sleep, anything"
          />
        </div>
      </div>
    </section>
  );
}

function QuickLog({ d }: { d: Dashboard }) {
  const { add } = useRunMutations(d.userId);
  const planDays = usePlanDayMutations(d.userId);
  const [miles, setMiles] = useState("");
  const [time, setTime] = useState("");
  const [fast, setFast] = useState("");
  const [gels, setGels] = useState("");
  const [fluids, setFluids] = useState("");
  const [stomach, setStomach] = useState("");
  const [busy, setBusy] = useState(false);

  const row = d.todayRow;
  const type = row ? typeLabel(row.workout_type) : "Easy Run";
  const distance = Number(miles);
  const duration = parseDuration(time) ?? 0;
  const pace = distance > 0 && duration > 0 ? Math.round(duration / distance) : null;

  // Tempo and marathon-pace days get an optional fast-segment pace check.
  const fastTarget = row?.workout_type === "tempo" ? 510 : row?.workout_type === "mp" ? 550 : null;
  const fastSeconds = parseDuration(fast);
  const verdict = fastTarget && fastSeconds ? workoutPaceVerdict(fastSeconds, fastTarget) : null;

  // Long days (or anything 12+ mi) get the fueling fields.
  const showFuel = row?.workout_type === "long" || distance >= 12;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!distance) {
      toast.error("Add the miles you ran");
      return;
    }
    setBusy(true);
    try {
      await add.mutateAsync({
        date: d.today,
        type,
        distance_mi: distance,
        duration_seconds: duration,
        avg_pace_seconds: pace,
        source: "manual",
        fast_segment_pace_seconds: fastSeconds ?? null,
        gels: gels === "" ? null : Number(gels),
        fluids_oz: fluids === "" ? null : Number(fluids),
        stomach: stomach === "" ? null : Number(stomach),
      } as never);
      if (row) {
        const min = row.min_miles != null ? Number(row.min_miles) : 0;
        const max = row.max_miles != null ? Number(row.max_miles) : Number(row.target_miles);
        const within = distance >= min && distance <= max;
        await planDays.markDate.mutateAsync({
          date: d.today,
          status: within ? "done" : "modified",
        });
      }
      setMiles("");
      setTime("");
      setFast("");
      setGels("");
      setFluids("");
      setStomach("");
      toast.success("Logged");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Log today&apos;s run
      </h3>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={submit}>
        <div className="w-28 space-y-1.5">
          <Label htmlFor="qmiles">Miles</Label>
          <Input
            id="qmiles"
            inputMode="decimal"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
          />
        </div>
        <div className="w-32 space-y-1.5">
          <Label htmlFor="qtime">Time</Label>
          <Input
            id="qtime"
            placeholder="mm:ss"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        {fastTarget && (
          <div className="w-40 space-y-1.5">
            <Label htmlFor="qfast">Fast-segment pace</Label>
            <Input
              id="qfast"
              placeholder={formatPace(fastTarget)}
              value={fast}
              onChange={(e) => setFast(e.target.value)}
            />
          </div>
        )}
        {showFuel && (
          <>
            <div className="w-24 space-y-1.5">
              <Label htmlFor="qgels">Gels</Label>
              <Input
                id="qgels"
                inputMode="numeric"
                value={gels}
                onChange={(e) => setGels(e.target.value)}
              />
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="qfluids">Fluids (oz)</Label>
              <Input
                id="qfluids"
                inputMode="numeric"
                value={fluids}
                onChange={(e) => setFluids(e.target.value)}
              />
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="qstomach">Stomach</Label>
              <Input
                id="qstomach"
                inputMode="numeric"
                placeholder="1–5"
                value={stomach}
                onChange={(e) => setStomach(e.target.value)}
              />
            </div>
          </>
        )}
        <Button type="submit" disabled={busy}>
          Log run
        </Button>
        {pace && <p className="pb-2 text-sm text-muted-foreground tnum">{formatPace(pace)}</p>}
        {verdict && (
          <p className="pb-2 text-sm text-muted-foreground tnum">
            Fast segment: {verdict} vs {formatPace(fastTarget)}
          </p>
        )}
      </form>
    </section>
  );
}

function CrossTrainingRow({ d }: { d: Dashboard }) {
  const addCross = useAddCrossTraining(d.userId);
  const [minutes, setMinutes] = useState("30");

  async function log(activity: string) {
    await addCross.mutateAsync({ date: d.today, activity, minutes: Number(minutes) || 0 });
    toast.success(`${activity} logged`);
  }

  return (
    <section>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Cross-training
      </h3>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-28 space-y-1.5">
          <Label htmlFor="xmin">Minutes</Label>
          <Input
            id="xmin"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        {["Yoga", "Gym", "Bike", "Other"].map((a) => (
          <Button key={a} type="button" variant="secondary" onClick={() => log(a)}>
            {a}
          </Button>
        ))}
        <p className="pb-2 text-sm text-muted-foreground">Doesn&apos;t count towards mileage.</p>
      </div>
    </section>
  );
}

const CHECKLIST_DEFAULTS = [
  { key: "expo", label: "Expo bib pickup" },
  { key: "transport", label: "Transport to the start · start-village time" },
  { key: "bag", label: "Bag check or poncho" },
  { key: "outfit", label: "Outfit tested on a long run" },
  { key: "fuel", label: "Fueling plan" },
  { key: "breakfast", label: "Breakfast plan and timing" },
  { key: "pace", label: "Pace plan: first 2 miles ~9:30, then 9:10" },
];

function RaceWeekChecklist({ d }: { d: Dashboard }) {
  const items = useChecklist(d.userId);
  const { seed, update } = useChecklistMutations(d.userId);
  const seeded = useRef(false);

  // Race week starts on the Monday six days before the race.
  const raceWeekStart = useMemo(
    () => isoDate(startOfWeek(new Date(`${d.raceDate}T00:00:00`))),
    [d.raceDate],
  );
  const active = d.today >= raceWeekStart;

  // Prefill the fueling line from what actually worked on long runs.
  const fuelNote = useMemo(() => {
    const last = [...d.runs]
      .filter((r) => r.gels != null || r.fluids_oz != null)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!last) return "";
    const parts: string[] = [];
    if (last.gels != null) parts.push(`${last.gels} gels`);
    if (last.fluids_oz != null) parts.push(`${last.fluids_oz} oz fluids`);
    return parts.join(", ");
  }, [d.runs]);

  useEffect(() => {
    if (!active || seeded.current || items.isLoading) return;
    if ((items.data ?? []).length) return;
    seeded.current = true;
    void seed.mutateAsync(
      CHECKLIST_DEFAULTS.map((c, i) => ({
        key: c.key,
        label: c.label,
        sort_order: i,
        note: c.key === "fuel" ? fuelNote : "",
        item_date: null,
        checked: false,
      })),
    );
  }, [active, items.isLoading, items.data?.length]);

  if (!active || !(items.data ?? []).length) return null;

  return (
    <section>
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Race week checklist
      </h3>
      <ul className="mt-3 space-y-2">
        {(items.data ?? []).map((it) => (
          <li
            key={it.id}
            className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
          >
            <Checkbox
              checked={it.checked}
              onCheckedChange={(v) => update.mutate({ id: it.id, checked: !!v })}
              aria-label={it.label}
            />
            <span
              className={`flex-1 text-sm ${it.checked ? "text-muted-foreground line-through" : ""}`}
            >
              {it.label}
            </span>
            <Input
              type="date"
              className="w-40"
              value={it.item_date ?? ""}
              onChange={(e) => update.mutate({ id: it.id, item_date: e.target.value || null })}
            />
            <Input
              className="w-56"
              placeholder="note"
              defaultValue={it.note ?? ""}
              onBlur={(e) => update.mutate({ id: it.id, note: e.target.value || null })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
