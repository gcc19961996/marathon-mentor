// Race fueling notes: general recommendations written once (by Claude, in
// Claude Code) and kept in the app as plain content. No AI call at runtime.
// The in-race gel times come from the NYC course pacing for the goal time.

import { courseTimeAt } from "./nycCourse";
import { MARATHON_MI } from "./training";

/** Start wave isn't known yet; times below assume this and say so. */
export const START_MINUTES = 10 * 60; // 10:00 AM
export const START_LABEL = "10:00 AM";

/** Gel every ~4 miles: about every 40 minutes at a 4:15 goal. */
export const GEL_MILES = [4, 8, 12, 16, 20] as const;
/** Optional extra gel for the last 10K if the stomach is happy. */
export const OPTIONAL_GEL_MILE = 23;

export type FuelingNote = { title: string; when: string; points: string[] };

/* ---------- training weeks ---------- */

export const TRAINING_MEALS: FuelingNote = {
  title: "Everyday meals",
  when: "Training weeks",
  points: [
    "Build each meal from three parts: a carb (rice, pasta, potatoes, oats, bread, fruit), a protein (eggs, chicken, fish, beans, yogurt, tofu) and vegetables or fruit.",
    "Match carbs to the day: bigger portions on long-run and workout days, smaller on rest days.",
    "Protein at every meal, about a palm-sized portion (20 to 30 g), spread through the day rather than all at dinner.",
    "Some healthy fat each day (olive oil, nuts, avocado), but keep it modest near runs.",
    "Runners often run low on iron and calcium: include red meat or beans and leafy greens, and dairy or a fortified alternative.",
    "Drink through the day, not just around runs. Pale-yellow pee is the check.",
    "If you're tired, always hungry or getting slower, you're probably under-eating for the mileage. Eat more, especially carbs.",
  ],
};

export const LONG_RUN_BEFORE: FuelingNote = {
  title: "Before a long run",
  when: "Night before and morning of",
  points: [
    "Night before: a normal dinner with an extra portion of carbs. Familiar food, not too late, light on fiber, fat and spice.",
    "Morning, 1½ to 3 hours before: 300 to 600 calories, mostly carbs. For example toast or a bagel with peanut butter or honey and a banana, or oatmeal if it sits well.",
    "Drink 12 to 16 oz of water or sports drink with breakfast. Coffee is fine if it's your routine.",
    "Short on time? A banana or a gel 30 to 60 minutes before is enough.",
    "On runs over about 75 minutes, take a gel every 30 to 45 minutes, starting around 45 minutes in, with water.",
    "Use long runs to rehearse race day: same breakfast, same gels, same timing.",
  ],
};

export const LONG_RUN_AFTER: FuelingNote = {
  title: "After a long run",
  when: "The rest of the day",
  points: [
    "Within 30 to 60 minutes: a snack with carbs and some protein, for example chocolate milk, a smoothie, yogurt with fruit and granola, or a bagel with eggs.",
    "A full meal within about 2 hours: a big carb portion, a protein and vegetables.",
    "Rehydrate over the next few hours. Add salt or an electrolyte drink if it was hot or you finished salty.",
    "Keep eating normally the rest of the day. Long-run days need more food, not less.",
    "Eat and rehydrate before any alcohol.",
  ],
};

export const ALCOHOL: FuelingNote = {
  title: "Alcohol",
  when: "Before the race",
  points: [
    "Alcohol disrupts sleep, slows how fast you refuel your muscles and adds to dehydration, so it costs the most in the last weeks.",
    "During the taper (the last 2 to 3 weeks), keep it to an occasional single drink with food, and none the night before a long run.",
    "Stop completely at least 3 days before the race, by Wednesday night for a Sunday race. A dry race week, from Monday, is better still.",
    "Celebrate after the finish, once you've eaten and had plenty of water.",
  ],
};

export const TRAINING_NOTES: FuelingNote[] = [
  TRAINING_MEALS,
  LONG_RUN_BEFORE,
  LONG_RUN_AFTER,
  ALCOHOL,
];

/* ---------- race weekend ---------- */

export const DAY_BEFORE: FuelingNote = {
  title: "The day before",
  when: "Saturday",
  points: [
    "Make carbs the main part of every meal and snack: bagels, rice, pasta, potatoes, bread, fruit, juice.",
    "From lunch on, go easy on fiber, fat, spicy food and big salads.",
    "Eat dinner early, around 6:00 PM: a pasta or rice dish you've had before, a modest piece of protein. Satisfied, not stuffed.",
    "Sip water through the day, with one bottle of sports drink or electrolytes. Aim for pale-yellow pee. Skip alcohol.",
    "A small bedtime snack is fine if you're hungry: pretzels, or toast with honey.",
    "Nothing new: only foods you've already eaten before a long run.",
  ],
};

export const RACE_MORNING: FuelingNote = {
  title: "Race morning",
  when: `Before a ${START_LABEL} start`,
  points: [
    "About 6:30 AM, 3 to 3½ hours out: your usual long-run breakfast. For example a bagel or white toast with peanut butter or honey, plus a banana and about 16 oz of water or sports drink. Coffee only if you normally have it.",
    "Pack a backup snack for the start village (a bar, banana or pretzels). The ferry or bus and the wait can take 2 to 3 hours.",
    "In the start village, sip water or Gatorade to thirst, about 8 oz an hour. Stop big drinks about 45 minutes before the start and make your last bathroom stop.",
    "About 15 minutes before the start: one gel with a few sips of water, if you've done this before a long run.",
  ],
};

export const DURING_RACE: FuelingNote = {
  title: "During the race",
  when: "Gels and fluids",
  points: [
    "Take each gel with water, not Gatorade, so the sugar doesn't stack up in your stomach.",
    "Between gels, take a few sips (4 to 6 oz) of Gatorade at about every other fluid station, and water when you're thirsty.",
    "Fluid stations come roughly every mile from about mile 3. Pinch the cup, sip, and keep moving, or walk a few steps if that's easier.",
    "Warm day: lean toward more Gatorade and drink a little more. Cool day: drink to thirst.",
    "If your stomach sloshes, ease off the fluids for a station or two. If you feel flat late, take the extra gel at mile 23.",
  ],
};

export type GelStop = { mile: number; elapsed: number; clock: string; optional: boolean };

/** "10:42 AM" for a number of seconds after the assumed start. */
export function clockAfterStart(elapsedSeconds: number, startMinutes = START_MINUTES): string {
  const total = Math.round(startMinutes + elapsedSeconds / 60);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** When each gel falls for a goal time, paced the NYC course at even effort. */
export function gelSchedule(goalSeconds: number): GelStop[] {
  return [...GEL_MILES, OPTIONAL_GEL_MILE]
    .filter((mile) => mile < MARATHON_MI)
    .map((mile) => {
      const elapsed = courseTimeAt(mile, goalSeconds);
      return {
        mile,
        elapsed,
        clock: clockAfterStart(elapsed),
        optional: mile === OPTIONAL_GEL_MILE,
      };
    });
}
