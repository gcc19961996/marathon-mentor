import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const ContextSchema = z.object({
  today: z.string(),
  raceName: z.string(),
  raceDate: z.string(),
  daysToRace: z.number(),
  weeksToRace: z.number(),
  phase: z.string(),
  targetTime: z.string(),
  targetPace: z.string(),
  predictedFinish: z.string(),
  targetCheck: z.string(),
  paceZones: z.string(),
  lastWeekMileage: z.number(),
  thisWeekMileage: z.number(),
  weeklyLimit: z.number(),
  daysAvailable: z.array(z.string()),
  daysPerWeek: z.number().nullable(),
  longRunDay: z.string().nullable(),
  nextMilestone: z.string(),
  longRunTargetMi: z.number().nullable(),
  legFeel: z.number().nullable(),
  sleepQuality: z.number().nullable(),
  whoopRecovery: z.number().nullable(),
  recentRuns: z.string(),
  activeWeek: z.string(),
  todayRange: z.string(),
  notes: z.string().nullable(),
});

type Ctx = z.infer<typeof ContextSchema>;

export type SuggestedWorkout = {
  type: string;
  distance_mi: number;
  pace_zone: string;
  why: string;
};

function contextBlock(c: Ctx) {
  return `Athlete context
Today: ${c.today}
Race: ${c.raceName} on ${c.raceDate} (${c.daysToRace} days / ${c.weeksToRace} weeks away)
Current phase: ${c.phase}
Target time: ${c.targetTime} at ${c.targetPace} (predicted finish from recent race: ${c.predictedFinish}; target check: ${c.targetCheck})
Pace zones: ${c.paceZones}
Last week mileage: ${c.lastWeekMileage} mi. This week so far: ${c.thisWeekMileage} mi. This week's ceiling: ${c.weeklyLimit} mi.
Days available to train: ${c.daysAvailable.join(", ") || "not specified"}
Settings: ${c.daysPerWeek ?? "unspecified"} running days per week; long run on ${c.longRunDay ?? "unspecified"}.
Next milestone: ${c.nextMilestone}${c.longRunTargetMi ? ` (implies a ${c.longRunTargetMi} mile long run)` : ""}
Morning check-in: leg feel ${c.legFeel ?? "n/a"}/5, sleep ${c.sleepQuality ?? "n/a"}/5, WHOOP recovery ${c.whoopRecovery ?? "n/a"}%
Today's computed range: ${c.todayRange}
Active week plan: ${c.activeWeek}
Last 14 days of runs: ${c.recentRuns}
Athlete notes: ${c.notes ?? "none"}`;
}

const MAX_AI_CALLS_PER_DAY = 30;

// Cheap abuse guard for the public URL: 30 coach calls per calendar day.
async function enforceDailyLimit() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc(
    "bump_ai_usage" as never,
    {
      max_per_day: MAX_AI_CALLS_PER_DAY,
    } as never,
  );
  if (error) {
    console.error("[ai] usage counter failed", error);
    return;
  }
  if (data === false) {
    throw new Error(
      `Daily coaching limit reached (${MAX_AI_CALLS_PER_DAY} requests). Try again tomorrow.`,
    );
  }
}

async function runModel(system: string, prompt: string) {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("AI is not configured yet.");
  await enforceDailyLimit();
  const { createGeminiProvider, TRAINING_MODEL } = await import("./ai-gateway.server");
  const gemini = createGeminiProvider(key);
  const result = streamText({ model: gemini(TRAINING_MODEL), system, prompt });
  return await result.text;
}

// At most one question every 10 seconds, on top of the daily cap.
const askTimes: number[] = [];
function checkAskRate() {
  const now = Date.now();
  while (askTimes.length && now - (askTimes[0] as number) > 60_000) askTimes.shift();
  if (askTimes.length >= 6) throw new Error("Slow down a moment, then ask again.");
  askTimes.push(now);
}

export const askCoach = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ question: z.string().min(1).max(500), context: ContextSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    (await import("./gate.server")).requireOwner();
    checkAskRate();
    const { TRAINING_RULES } = await import("./ai-gateway.server");
    const system = `You are the athlete's marathon coach. Be concise and practical: lead with a short recommendation (1-2 sentences), then brief reasoning. Never exceed 120 words.
${TRAINING_RULES}

After your answer, if and only if you are recommending a specific workout for today, append a final line of strict JSON on its own:
SUGGESTED: {"type":string,"distance_mi":number,"pace_zone":string,"why":string}
Otherwise append nothing.`;

    const text = await runModel(
      system,
      `${contextBlock(data.context)}\n\nAthlete asks: ${data.question}`,
    );

    const idx = text.lastIndexOf("SUGGESTED:");
    let answer = text.trim();
    let suggested: SuggestedWorkout | null = null;
    if (idx !== -1) {
      answer = text.slice(0, idx).trim();
      try {
        suggested = JSON.parse(text.slice(idx + "SUGGESTED:".length).trim()) as SuggestedWorkout;
      } catch {
        suggested = null;
      }
    }
    return { answer, suggested } as { answer: string; suggested: SuggestedWorkout | null };
  });
