import { createMiddleware } from "@tanstack/react-start";
import { getDeviceToken } from "./deviceToken";

/** Sends the signed device token with every server call. */
export const attachDeviceToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getDeviceToken();
  return next({ headers: token ? { "x-app-token": token } : {} });
});
