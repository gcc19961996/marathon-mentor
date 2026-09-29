import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unlockDevice, checkDeviceToken } from "@/lib/gate.functions";
import {
  clearDeviceToken,
  getDeviceToken,
  saveDeviceToken,
  type AppRole,
} from "@/lib/deviceToken";

export function PasscodeGate({ children }: { children: (role: AppRole) => React.ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [checked, setChecked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!getDeviceToken()) {
        if (active) setChecked(true);
        return;
      }
      try {
        const res = await checkDeviceToken();
        if (!active) return;
        if (res.unlocked && res.role) setRole(res.role);
        else clearDeviceToken();
      } catch {
        if (active) clearDeviceToken();
      }
      if (active) setChecked(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await unlockDevice({ data: { passcode } });
      if (res.ok) {
        saveDeviceToken(res.token, res.role);
        setRole(res.role);
        setPasscode("");
      } else {
        setError(res.message);
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (role) return <>{children(role)}</>;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="surface-card w-full max-w-sm p-6">
        <h1 className="font-display text-2xl font-bold">Enter passcode</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This training dashboard is private. This device stays unlocked for 90 days.
        </p>
        <Input
          className="mt-5"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          aria-label="Passcode"
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={busy || !passcode}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
