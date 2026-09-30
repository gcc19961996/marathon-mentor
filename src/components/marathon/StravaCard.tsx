import { useState } from "react";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  relativeTime,
  useStravaConnect,
  useStravaDisconnect,
  useStravaStatus,
  useStravaSync,
} from "@/lib/strava";
import { useServerFn } from "@tanstack/react-start";
import { saveStravaCredentials } from "@/lib/strava.functions";

export function StravaCard() {
  const status = useStravaStatus();
  const connect = useStravaConnect();
  const disconnect = useStravaDisconnect();
  const sync = useStravaSync();
  const saveKeys = useServerFn(saveStravaCredentials);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const s = status.data;

  async function syncNow() {
    const res = await sync.mutateAsync();
    if (res.status === "ok") {
      toast.success(
        res.imported || res.matched
          ? `Synced — ${res.imported} new, ${res.matched} matched`
          : "Synced — nothing new",
      );
    } else if (res.status === "not-connected") {
      toast.error("Strava is not connected");
    } else {
      toast.error(
        res.message ? `Strava sync failed — ${res.message}` : "Strava sync failed — reconnect",
      );
    }
  }

  async function saveAndConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Paste both the Client ID and Client Secret");
      return;
    }
    setSaving(true);
    try {
      await saveKeys({ data: { clientId, clientSecret } });
      await connect.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the Strava connection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card space-y-3 p-5">
      <h3 className="section-kicker">Strava</h3>
      <div>
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden />
          <p className="font-medium">Strava sync</p>
        </div>

        {!s ? (
          <p className="mt-2 text-sm text-muted-foreground">Checking…</p>
        ) : !s.configured ? (
          <form className="mt-3 space-y-3" onSubmit={saveAndConnect}>
            <p className="text-sm text-muted-foreground">
              Paste the Client ID and Client Secret from your Strava API settings page once. They
              are stored on the server only. Set the app&apos;s Authorization Callback Domain to{" "}
              <span className="font-medium">{s.callbackDomain}</span>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="stravaClientId">Client ID</Label>
                <Input
                  id="stravaClientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stravaClientSecret">Client Secret</Label>
                <Input
                  id="stravaClientSecret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={saving || connect.isPending}>
              {saving || connect.isPending ? "Connecting…" : "Connect Strava"}
            </Button>
          </form>
        ) : !s.connected ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Your keys are saved. Approve access on Strava to pull your runs in automatically.
            </p>
            {s.lastError && <p className="mt-1 text-sm text-destructive">{s.lastError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
                {s.lastError ? "Reconnect Strava" : "Connect Strava"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setClientId("");
                  setClientSecret("");
                  disconnect.mutate();
                  toast.message("Use Reconnect to approve access again");
                }}
              >
                Reset connection
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Connected{s.athleteName ? ` as ${s.athleteName}` : ""} · last synced{" "}
              {relativeTime(s.lastSyncedAt)} · {s.runCount} runs
            </p>
            <p className="mt-1 text-sm font-medium tnum">
              Splits: {s.splitsCount}/{s.runCount} runs
            </p>
            {s.lastError && <p className="mt-1 text-sm text-destructive">{s.lastError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="h-9 rounded-md"
                onClick={syncNow}
                disabled={sync.isPending}
              >
                {sync.isPending ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="secondary" onClick={() => connect.mutate()}>
                Reconnect
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await disconnect.mutateAsync();
                  toast.success("Disconnected — your imported runs stay");
                }}
                disabled={disconnect.isPending}
              >
                Disconnect
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
