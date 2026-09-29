// The original fixed plan. Settings → "Reset plan to original" restores these rows.

export type SeedDay = {
  date: string;
  week_number: number;
  phase: string;
  workout_type: string;
  target_miles: number;
  min_miles: number | null;
  max_miles: number | null;
  details: string;
  pace_target: string;
  purpose: string;
};

export type SeedWeek = {
  week_number: number;
  start_date: string;
  phase: string;
  target_miles: number;
  suggested_ceiling: number;
};

export const SEED_WEEKS: SeedWeek[] = [
  { week_number: 1, start_date: "2026-09-14", phase: "Build", target_miles: 33, suggested_ceiling: 35 },
  { week_number: 2, start_date: "2026-09-21", phase: "Build (travel week)", target_miles: 11, suggested_ceiling: 13 },
  { week_number: 3, start_date: "2026-09-28", phase: "Build", target_miles: 32, suggested_ceiling: 35 },
  { week_number: 4, start_date: "2026-10-05", phase: "Recovery", target_miles: 25, suggested_ceiling: 28 },
  { week_number: 5, start_date: "2026-10-12", phase: "Peak", target_miles: 34, suggested_ceiling: 37 },
  { week_number: 6, start_date: "2026-10-19", phase: "Taper", target_miles: 26, suggested_ceiling: 28 },
  { week_number: 7, start_date: "2026-10-26", phase: "Race week", target_miles: 15, suggested_ceiling: 17 },
];

export const SEED_DAYS: SeedDay[] = [
  { date: "2026-09-14", week_number: 1, phase: "Build", workout_type: "easy", target_miles: 7.8, min_miles: 7, max_miles: 8.5, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Aerobic base" },
  { date: "2026-09-15", week_number: 1, phase: "Build", workout_type: "easy", target_miles: 8.1, min_miles: 7, max_miles: 8.5, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Aerobic base" },
  { date: "2026-09-17", week_number: 1, phase: "Build", workout_type: "easy", target_miles: 3, min_miles: 2, max_miles: 4, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Stay fresh for Sunday's 14" },
  { date: "2026-09-20", week_number: 1, phase: "Build", workout_type: "long", target_miles: 14, min_miles: 12, max_miles: 15, details: "Fuel every 30–45 min; practice race shoes; rehearse race morning", pace_target: "9:50–10:15/mi", purpose: "First 14-miler" },
  { date: "2026-09-22", week_number: 2, phase: "Build (travel week)", workout_type: "tempo", target_miles: 6, min_miles: 5, max_miles: 6, details: "1.5 warm-up, 3 @ 8:30, 1.5 cool-down; swap for Easy 4 if stressed or short on sleep", pace_target: "8:25–8:35/mi", purpose: "Quality before travel" },
  { date: "2026-09-25", week_number: 2, phase: "Build (travel week)", workout_type: "easy", target_miles: 5, min_miles: 4, max_miles: 6, details: "Jackson altitude: run by effort; no pace warnings", pace_target: "By effort · 10:15–11:00/mi", purpose: "Stay loose while traveling" },
  { date: "2026-09-28", week_number: 3, phase: "Build", workout_type: "easy", target_miles: 5, min_miles: 4, max_miles: 6, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Easy start to the week" },
  { date: "2026-09-29", week_number: 3, phase: "Build", workout_type: "long", target_miles: 16, min_miles: 14, max_miles: 16, details: "First 16-miler checkpoint; fuel every 30–45 min; practice race shoes", pace_target: "9:50–10:15/mi", purpose: "First 16-miler + checkpoint" },
  { date: "2026-10-01", week_number: 3, phase: "Build", workout_type: "mp", target_miles: 6, min_miles: 5, max_miles: 7, details: "1 warm-up, 4 @ 9:44, 1 cool-down", pace_target: "9:44/mi", purpose: "Lock in goal race pace" },
  { date: "2026-10-03", week_number: 3, phase: "Build", workout_type: "easy", target_miles: 5, min_miles: 4, max_miles: 6, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Aerobic volume" },
  { date: "2026-10-05", week_number: 4, phase: "Recovery", workout_type: "easy", target_miles: 4, min_miles: 3, max_miles: 5, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Recovery week: absorb training" },
  { date: "2026-10-06", week_number: 4, phase: "Recovery", workout_type: "long", target_miles: 12, min_miles: 10, max_miles: 13, details: "Easy; last 3 @ 9:44; practice fueling and race shoes", pace_target: "9:50–10:15/mi", purpose: "Marathon pace on tired legs" },
  { date: "2026-10-08", week_number: 4, phase: "Recovery", workout_type: "strides", target_miles: 5, min_miles: 4, max_miles: 6, details: "Easy + 6 × 20-sec relaxed strides", pace_target: "9:50–10:20/mi", purpose: "Keep legs sharp" },
  { date: "2026-10-10", week_number: 4, phase: "Recovery", workout_type: "easy", target_miles: 4, min_miles: 3, max_miles: 5, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Recovery week" },
  { date: "2026-10-12", week_number: 5, phase: "Peak", workout_type: "easy", target_miles: 5, min_miles: 4, max_miles: 6, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Easy start to peak week" },
  { date: "2026-10-13", week_number: 5, phase: "Peak", workout_type: "long", target_miles: 18, min_miles: 16, max_miles: 20, details: "20 only if the 16 felt good and nothing hurts; fuel every 30–45 min; practice race shoes", pace_target: "9:50–10:15/mi", purpose: "Peak long run" },
  { date: "2026-10-15", week_number: 5, phase: "Peak", workout_type: "tempo", target_miles: 6, min_miles: 5, max_miles: 7, details: "1.5 warm-up, 3 @ 8:30, 1.5 cool-down", pace_target: "8:25–8:35/mi", purpose: "Last hard session" },
  { date: "2026-10-17", week_number: 5, phase: "Peak", workout_type: "easy", target_miles: 5, min_miles: 4, max_miles: 6, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Aerobic support" },
  { date: "2026-10-19", week_number: 6, phase: "Taper", workout_type: "easy", target_miles: 5, min_miles: 4, max_miles: 6, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Taper begins" },
  { date: "2026-10-20", week_number: 6, phase: "Taper", workout_type: "long", target_miles: 12, min_miles: 10, max_miles: 13, details: "Miles 6–9 @ 9:44; practice fueling and race shoes", pace_target: "9:50–10:15/mi", purpose: "Last long run" },
  { date: "2026-10-22", week_number: 6, phase: "Taper", workout_type: "mp", target_miles: 5, min_miles: 4, max_miles: 6, details: "1.5 warm-up, 2 @ 9:44, 1.5 cool-down", pace_target: "9:44/mi", purpose: "Stay sharp" },
  { date: "2026-10-24", week_number: 6, phase: "Taper", workout_type: "easy", target_miles: 4, min_miles: 3, max_miles: 5, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Keep the taper easy" },
  { date: "2026-10-26", week_number: 7, phase: "Race week", workout_type: "easy", target_miles: 4, min_miles: 3, max_miles: 4, details: "Easy 9:50–10:20/mi", pace_target: "9:50–10:20/mi", purpose: "Race week: stay loose" },
  { date: "2026-10-27", week_number: 7, phase: "Race week", workout_type: "mp", target_miles: 6, min_miles: 5, max_miles: 6, details: "2 warm-up, 2 @ 9:44, 2 cool-down", pace_target: "9:44/mi", purpose: "Rehearse race pace" },
  { date: "2026-10-29", week_number: 7, phase: "Race week", workout_type: "strides", target_miles: 3, min_miles: 2, max_miles: 3, details: "Easy + 4 × 20-sec fast but relaxed strides", pace_target: "Easy 9:50–10:20/mi · strides relaxed", purpose: "Sharpen, don't tire" },
  { date: "2026-10-31", week_number: 7, phase: "Race week", workout_type: "shakeout", target_miles: 2, min_miles: 1.5, max_miles: 2.5, details: "Very easy", pace_target: "very easy", purpose: "Loosen up" },
  { date: "2026-11-01", week_number: 7, phase: "Race week", workout_type: "race", target_miles: 26.2, min_miles: null, max_miles: null, details: "Target 4:15 (9:44/mi). Miles 1–2 (Verrazzano) ~10:05; don't bank time", pace_target: "9:44/mi", purpose: "Race day" },
];
