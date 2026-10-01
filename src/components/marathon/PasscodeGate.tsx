import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { unlockDevice, checkDeviceToken } from "@/lib/gate.functions";
import { clearDeviceToken, getDeviceToken, saveDeviceToken, type AppRole } from "@/lib/deviceToken";

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
    <main className="leaf-field flex min-h-screen p-7 sm:p-11">
      <form
        onSubmit={submit}
        className="poster-field flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"
      >
        <Moon className="size-16 -rotate-12 fill-current" strokeWidth={0} aria-hidden />
        <h1 className="mt-6 font-display text-4xl font-black uppercase leading-[0.95] sm:text-6xl">
          Marathon
          <br />
          Training
          <br />
          Companion
        </h1>
        <p className="mt-6 max-w-xs text-sm font-semibold text-muted-foreground">
          This training dashboard is private. Enter the passcode; this device stays unlocked for 90
          days.
        </p>
        <Input
          className="mt-6 max-w-xs bg-card text-center text-foreground placeholder:text-foreground/60"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          aria-label="Passcode"
        />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="mt-4 w-full max-w-xs font-bold uppercase"
          disabled={busy || !passcode}
        >
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
