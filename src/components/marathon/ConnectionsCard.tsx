import { Button } from "@/components/ui/button";
import { Activity, HeartPulse } from "lucide-react";

const TILES = [
  {
    name: "Strava",
    description: "Pull runs in automatically instead of logging them by hand.",
    icon: Activity,
  },
  {
    name: "WHOOP",
    description: "Fill your morning recovery, sleep and strain automatically each day.",
    icon: HeartPulse,
  },
];

export function ConnectionsCard() {
  return (
    <section className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold">Connections</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {TILES.map((t) => (
          <div key={t.name} className="rounded-lg border border-border p-4">
            <t.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-2 font-medium">{t.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            <Button className="mt-3" size="sm" variant="secondary" disabled>
              Connect · coming soon
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
