// Passcode gate: exchange a passcode for a signed device token.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type UnlockResult =
  | { ok: true; token: string; role: "owner" | "viewer"; expiresAt: string }
  | { ok: false; message: string; retryAfterSeconds?: number };

export const unlockDevice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ passcode: z.string().max(200) }).parse(input))
  .handler(async ({ data }): Promise<UnlockResult> => {
    const gate = await import("./gate.server");
    const wait = gate.checkPasscodeThrottle();
    if (wait > 0) {
      return {
        ok: false,
        message: `Too many tries. Wait ${wait} second${wait === 1 ? "" : "s"} and try again.`,
        retryAfterSeconds: wait,
      };
    }
    const role = gate.roleForPasscode(data.passcode);
    if (!role) {
      gate.recordPasscodeFailure();
      return { ok: false, message: "That passcode is not right." };
    }
    gate.clearPasscodeFailures();
    const { token, expiresAt } = gate.mintToken(role);
    return { ok: true, token, role, expiresAt };
  });

/** Confirms the stored token is still valid, and reports its role. */
export const checkDeviceToken = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ unlocked: boolean; role: "owner" | "viewer" | null }> => {
    const gate = await import("./gate.server");
    try {
      const role = gate.requireAnyRole();
      return { unlocked: true, role };
    } catch {
      return { unlocked: false, role: null };
    }
  },
);
