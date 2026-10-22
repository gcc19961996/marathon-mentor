import type { Dashboard } from "@/lib/dashboard";
import { PlanRules, TargetSummary } from "./ProgressTab";
import { RaceFuelingNotes } from "./RaceFuelingNotes";
import { RacePacing } from "./RacePacing";
import { TrainingPrediction } from "./TrainingPrediction";

export function RaceDayTab({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-6">
      <TargetSummary d={d} />
      <section className="surface-card p-5">
        <TrainingPrediction d={d} compact />
      </section>

      <RacePacing d={d} />
      <RaceFuelingNotes d={d} />
      <section id="plan-rules" className="scroll-mt-6">
        <h3 className="section-kicker mb-4">Plan rules</h3>
        <div>
          <PlanRules />
        </div>
      </section>
    </div>
  );
}
