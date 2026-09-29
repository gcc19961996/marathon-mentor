import { createFileRoute } from "@tanstack/react-router";

/** Legacy callback address — forwards to the page that finishes the connection. */
export const Route = createFileRoute("/api/public/strava/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return new Response(null, {
          status: 302,
          headers: { location: `/strava/callback${url.search}` },
        });
      },
    },
  },
});
