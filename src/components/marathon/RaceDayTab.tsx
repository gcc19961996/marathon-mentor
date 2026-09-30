import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Dashboard } from "@/lib/dashboard";
import { formatPace } from "@/lib/training";
import { Collapsible, FuelingNotes, PlanRules, Splits, TargetSummary } from "./ProgressTab";
import { TrainingPrediction } from "./PaceAnalysisTab";

const CHECKPOINT_DATE = "2026-09-29";

export function RaceDayTab({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-6">
      <TargetSummary d={d} />
      <section className="surface-card p-5">
        <TrainingPrediction d={d} compact />
      </section>

      <section>
        <h3 className="section-kicker mb-4">Race-day splits</h3>
        <div>
          <Splits d={d} />
        </div>
      </section>
      <Collapsible title="Fueling notes">
        <FuelingNotes d={d} />
      </Collapsible>
      <section id="plan-rules" className="scroll-mt-6">
        <h3 className="section-kicker mb-4">Plan rules</h3>
        <div>
          <PlanRules />
        </div>
      </section>
      <SixteenMileCheckpoint d={d} />
    </div>
  );
}

const BENCHMARK_PACE = 600; // ~10:00/mi at 16 miles keeps 4:15 on the table

function SixteenMileCheckpoint({ d }: { d: Dashboard }) {
  // Any run that reaches the 16-mile checkpoint distance, whatever day it happened.
  const run =
    [...d.runs]
      .filter((r) => Number(r.distance_mi) >= 15.8)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const [felt, setFelt] = useState<"controlled" | "grind" | null>(null);
  const pace = run?.avg_pace_seconds ?? null;

  if (!run) {
    return (
      <section className="surface-card p-5">
        <p className="text-xs font-semibold uppercase text-muted-foreground">16-miler checkpoint</p>
        <p className="mt-2 text-sm font-medium">Coming up · Tue Sep 29</p>
        <p className="mt-1 text-sm text-muted-foreground">
          After the run, check the average pace and how it felt. Around 10:00/mi and controlled
          means on track for 4:15.
        </p>
      </section>
    );
  }

  const ahead = pace != null && pace < BENCHMARK_PACE - 20;
  const dateLabel = new Date(`${run.date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="surface-card p-5">
      <p className="text-xs font-semibold uppercase text-muted-foreground">16-miler checkpoint</p>
      <p className="mt-2 text-sm font-medium">
        {dateLabel} · {Number(run.distance_mi).toFixed(1)} mi · {formatPace(pace)} vs the ~10:00/mi
        benchmark
      </p>
      <p className={`mt-1 text-sm font-semibold ${ahead ? "text-success" : ""}`}>
        {ahead
          ? `Ahead of the 4:15 checkpoint — consider reviewing the target after the ${new Date(`${CHECKPOINT_DATE}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} long run`
          : pace != null && Math.abs(pace - BENCHMARK_PACE) <= 20
            ? "On track for 4:15"
            : "Behind the 4:15 checkpoint — keep the plan and reassess after the next long run"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">The target never changes on its own.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={felt === "controlled" ? "default" : "secondary"}
          onClick={() => setFelt("controlled")}
        >
          Controlled
        </Button>
        <Button
          size="sm"
          variant={felt === "grind" ? "default" : "secondary"}
          onClick={() => setFelt("grind")}
        >
          A grind
        </Button>
        <Button
          variant="secondary"
          className="h-9 rounded-md"
          onClick={() => document.getElementById("open-settings")?.click()}
        >
          Review target
        </Button>
      </div>
      {felt === "grind" && (
        <p className="mt-3 text-sm text-caution-foreground">
          Review the target before the next key workout. It will not change automatically.
        </p>
      )}
    </section>
  );
}
