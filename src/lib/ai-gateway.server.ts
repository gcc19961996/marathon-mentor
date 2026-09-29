import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export const TRAINING_MODEL = "google/gemini-3.8-flash";

export const TRAINING_RULES = `Training rules you must respect:
- Treat the fixed plan as authoritative. Never invent, regenerate, or move planned workouts; suggestions may only scale today's work down.
- Never make up missed miles. Drop an easy run before compromising a long run.
- If a long run is skipped or under 75% of target, hold the next long run at the last completed distance. Never alter taper or race week.
- Check-ins only scale down: legs or sleep at 2/5, WHOOP below 34%, or pain means the planned minimum or rest. Legs or sleep at 1/5 means rest.
- Pain that changes the athlete's stride means stop. Sharp, localized, or worsening pain means rest and seeing a physical therapist or doctor.
- Use only these plan paces: Easy 9:50–10:20/mi (talk test), Long 9:50–10:15/mi, Marathon pace 9:44/mi, Tempo 8:25–8:35/mi, strides 20 seconds fast but relaxed, Jackson altitude by effort at 10:15–11:00/mi.
- After the September 29 16-miler, about 10:00/mi and controlled means on track for 4:15; a grind means suggest reviewing the target. Never change the target automatically.
- Runs of 14 miles or more require fueling every 30–45 minutes and race-shoe practice.
- Sauna is okay after hard runs. Skip cold plunges after key runs until after the race.
- Units are always miles and min/mile.
- Never send, request, or mention raw Strava activity data or splits.`;
