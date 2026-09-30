import { useMemo } from "react";
import type { Dashboard } from "@/lib/dashboard";
import { predictFromTraining } from "@/lib/paceAnalysis";
import { formatDuration, formatPace } from "@/lib/training";

/** Shown on both Pace Analysis and Race Day; recalculates whenever runs change. */
export function TrainingPrediction({ d, compact = false }: { d: Dashboard; compact?: boolean }) {
  const prediction = useMemo(
    () => predictFromTraining(d.runs, d.bestEffortRows, d.today, d.splitsByActivity),
    [d.runs, d.bestEffortRows, d.today, d.splitsByActivity],
  );

  if (!prediction) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough recent splits to predict a finish yet.
      </p>
    );
  }

  const { basis } = prediction;
  return (
    <div className={compact ? "" : "surface-card p-5"}>
      {compact && (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Predicted from training
        </p>
      )}
      <p className="stat-figure text-3xl font-semibold tnum">
        {formatDuration(prediction.seconds)}
      </p>
      <p className="text-sm text-muted-foreground tnum">
        {formatDuration(prediction.low)}–{formatDuration(prediction.high)} range
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Based on: {basis.effort} {formatPace(basis.pace)} on{" "}
        {new Date(`${basis.date}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}{" "}
        · longest run {basis.longestMi} mi · {basis.weeklyMi} mi/week
      </p>
    </div>
  );
}
