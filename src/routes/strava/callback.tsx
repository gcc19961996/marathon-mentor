import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { completeStravaConnect, saveStravaConnectError } from "@/lib/strava.functions";

export const Route = createFileRoute("/strava/callback")({
  ssr: false,
  component: StravaCallback,
  head: () => ({
    meta: [
      { title: "Connecting Strava · Marathon Training Companion" },
      {
        name: "description",
        content: "Finishing the Strava connection for your marathon training plan.",
      },
      { property: "og:title", content: "Connecting Strava" },
      {
        property: "og:description",
        content: "Finishing the Strava connection for your marathon training plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StravaCallback() {
  const complete = useServerFn(completeStravaConnect);
  const saveError = useServerFn(saveStravaConnectError);
  const started = useRef(false);
  const [state, setState] = useState<{ kind: "working" | "ok" | "error"; message: string }>({
    kind: "working",
    message: "Finishing the connection with Strava…",
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");
    const scope = params.get("scope") ?? "";
    const oauthState = params.get("state") ?? "";

    if (error) {
      const message = `Strava said: ${error}. Nothing was changed.`;
      void saveError({ data: { message } });
      setState({ kind: "error", message });
      return;
    }
    if (!code) {
      const message = "Strava did not send a code back. Try connecting again.";
      void saveError({ data: { message } });
      setState({ kind: "error", message });
      return;
    }
    if (!scope.includes("activity:read_all")) {
      const message =
        "Strava needs permission to view your activities — connect again and tick that box.";
      void saveError({ data: { message } });
      setState({
        kind: "error",
        message,
      });
      return;
    }

    complete({ data: { code, scope, state: oauthState } })
      .then((res) => {
        if (!res.ok) {
          setState({ kind: "error", message: res.message ?? "The connection failed." });
          return;
        }
        setState({
          kind: "ok",
          message:
            res.message ??
            `Strava is connected — ${res.imported ?? 0} runs imported, ${res.matched ?? 0} matched to runs you already had.`,
        });
      })
      .catch((err: unknown) => {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "The connection failed.",
        });
      });
  }, [complete]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="font-display text-2xl font-semibold">
        {state.kind === "ok"
          ? "Strava connected"
          : state.kind === "error"
            ? "Strava was not connected"
            : "Connecting Strava"}
      </h1>
      <p className={state.kind === "error" ? "text-destructive" : "text-muted-foreground"}>
        {state.message}
      </p>
      <Link to="/" className="text-primary underline underline-offset-4">
        Back to your training
      </Link>
    </main>
  );
}
