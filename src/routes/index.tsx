import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/marathon/Dashboard";
import { PasscodeGate } from "@/components/marathon/PasscodeGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Marathon Training Companion — NYC Marathon Dashboard" },
      {
        name: "description",
        content:
          "A calm personal NYC Marathon dashboard with a fixed weekly plan, pace zones, daily check-ins, Strava sync and a run log.",
      },
      { property: "og:title", content: "Marathon Training Companion" },
      {
        property: "og:description",
        content:
          "Race countdown, fixed weekly training plan, pace guidance, Strava sync and progress tracking for the NYC Marathon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <PasscodeGate>{(role) => <Dashboard role={role} />}</PasscodeGate>;
}
