UPDATE public.profile
SET long_run_day = 'Tue', updated_at = now()
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;

UPDATE public.plan_weeks AS w
SET phase = v.phase,
    target_miles = v.target_miles,
    suggested_ceiling = v.suggested_ceiling,
    updated_at = now()
FROM (VALUES
  (1, 'Build'::text, 33::numeric, 35::numeric),
  (2, 'Build (travel week)'::text, 11::numeric, 13::numeric),
  (3, 'Build'::text, 32::numeric, 35::numeric),
  (4, 'Recovery'::text, 25::numeric, 28::numeric),
  (5, 'Peak'::text, 34::numeric, 37::numeric),
  (6, 'Taper'::text, 26::numeric, 28::numeric),
  (7, 'Race week'::text, 15::numeric, 17::numeric)
) AS v(week_number, phase, target_miles, suggested_ceiling)
WHERE w.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND w.week_number = v.week_number;

UPDATE public.plan_days AS d
SET week_number = v.week_number,
    phase = v.phase,
    workout_type = v.workout_type,
    target_miles = v.target_miles,
    min_miles = v.min_miles,
    max_miles = v.max_miles,
    details = v.details,
    pace_target = v.pace_target,
    purpose = v.purpose,
    updated_at = now()
FROM (VALUES
  ('2026-09-14'::date,1,'Build','easy',7.8::numeric,7::numeric,8.5::numeric,'Easy 9:50–10:20/mi','9:50–10:20/mi','Aerobic base'),
  ('2026-09-15'::date,1,'Build','easy',8.1,7,8.5,'Easy 9:50–10:20/mi','9:50–10:20/mi','Aerobic base'),
  ('2026-09-17'::date,1,'Build','easy',3,2,4,'Easy 9:50–10:20/mi','9:50–10:20/mi','Stay fresh for Sunday''s 14'),
  ('2026-09-20'::date,1,'Build','long',14,12,15,'Fuel every 30–45 min; practice race shoes; rehearse race morning','9:50–10:15/mi','First 14-miler'),
  ('2026-09-22'::date,2,'Build (travel week)','tempo',6,5,6,'1.5 warm-up, 3 @ 8:30, 1.5 cool-down; swap for Easy 4 if stressed or short on sleep','8:25–8:35/mi','Quality before travel'),
  ('2026-09-25'::date,2,'Build (travel week)','easy',5,4,6,'Jackson altitude: run by effort; no pace warnings','By effort · 10:15–11:00/mi','Stay loose while traveling'),
  ('2026-09-28'::date,3,'Build','easy',5,4,6,'Easy 9:50–10:20/mi','9:50–10:20/mi','Easy start to the week'),
  ('2026-09-29'::date,3,'Build','long',16,14,16,'First 16-miler checkpoint; fuel every 30–45 min; practice race shoes','9:50–10:15/mi','First 16-miler + checkpoint'),
  ('2026-10-01'::date,3,'Build','mp',6,5,7,'1 warm-up, 4 @ 9:44, 1 cool-down','9:44/mi','Lock in goal race pace'),
  ('2026-10-03'::date,3,'Build','easy',5,4,6,'Easy 9:50–10:20/mi','9:50–10:20/mi','Aerobic volume'),
  ('2026-10-05'::date,4,'Recovery','easy',4,3,5,'Easy 9:50–10:20/mi','9:50–10:20/mi','Recovery week: absorb training'),
  ('2026-10-06'::date,4,'Recovery','long',12,10,13,'Easy; last 3 @ 9:44; practice fueling and race shoes','9:50–10:15/mi','Marathon pace on tired legs'),
  ('2026-10-08'::date,4,'Recovery','strides',5,4,6,'Easy + 6 × 20-sec fast but relaxed strides','Easy 9:50–10:20/mi · strides relaxed','Keep legs sharp'),
  ('2026-10-10'::date,4,'Recovery','easy',4,3,5,'Easy 9:50–10:20/mi','9:50–10:20/mi','Recovery week'),
  ('2026-10-12'::date,5,'Peak','easy',5,4,6,'Easy 9:50–10:20/mi','9:50–10:20/mi','Easy start to peak week'),
  ('2026-10-13'::date,5,'Peak','long',18,16,20,'20 only if the 16 felt good and nothing hurts; fuel every 30–45 min; practice race shoes','9:50–10:15/mi','Peak long run'),
  ('2026-10-15'::date,5,'Peak','tempo',6,5,7,'1.5 warm-up, 3 @ 8:30, 1.5 cool-down','8:25–8:35/mi','Last hard tempo session'),
  ('2026-10-17'::date,5,'Peak','easy',5,4,6,'Easy 9:50–10:20/mi','9:50–10:20/mi','Aerobic support'),
  ('2026-10-19'::date,6,'Taper','easy',5,4,6,'Easy 9:50–10:20/mi','9:50–10:20/mi','Taper begins'),
  ('2026-10-20'::date,6,'Taper','long',12,10,13,'Miles 6–9 @ 9:44; practice fueling and race shoes','9:50–10:15/mi','Last long run'),
  ('2026-10-22'::date,6,'Taper','mp',5,4,6,'1.5 warm-up, 2 @ 9:44, 1.5 cool-down','9:44/mi','Stay sharp'),
  ('2026-10-24'::date,6,'Taper','easy',4,3,5,'Easy 9:50–10:20/mi','9:50–10:20/mi','Keep the taper easy'),
  ('2026-10-26'::date,7,'Race week','easy',4,3,4,'Easy 9:50–10:20/mi','9:50–10:20/mi','Race week: stay loose'),
  ('2026-10-27'::date,7,'Race week','mp',6,5,6,'2 warm-up, 2 @ 9:44, 2 cool-down','9:44/mi','Rehearse race pace'),
  ('2026-10-29'::date,7,'Race week','strides',3,2,3,'Easy + 4 × 20-sec fast but relaxed strides','Easy 9:50–10:20/mi · strides relaxed','Sharpen, don''t tire'),
  ('2026-10-31'::date,7,'Race week','shakeout',2,1.5,2.5,'Very easy','Very easy','Loosen up'),
  ('2026-11-01'::date,7,'Race week','race',26.2,NULL,NULL,'Target 4:15:00. Miles 1–2 about 10:05; don''t bank time','9:44/mi','Race day')
) AS v(date,week_number,phase,workout_type,target_miles,min_miles,max_miles,details,pace_target,purpose)
WHERE d.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND d.date = v.date;

UPDATE public.milestones AS m
SET target_date = v.target_date,
    criteria = v.criteria,
    updated_at = now()
FROM (VALUES
  ('First 14-miler'::text,'2026-09-20'::date,'day:2026-09-20'::text),
  ('First 16-miler','2026-09-29'::date,'day:2026-09-29'),
  ('Peak long run (18)','2026-10-13'::date,'day:2026-10-13'),
  ('Peak week','2026-10-18'::date,'date'),
  ('Taper begins','2026-10-19'::date,'date'),
  ('Race week','2026-10-26'::date,'date'),
  ('Race day','2026-11-01'::date,'day:2026-11-01')
) AS v(name,target_date,criteria)
WHERE m.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND m.name = v.name;

UPDATE public.checklist_items
SET label = 'Pace plan: first 2 miles ~10:05, then 9:44'
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND key = 'pace';

INSERT INTO public.plan_changes (user_id, what, why)
SELECT '00000000-0000-0000-0000-000000000001'::uuid,
       'Long-run day set to Tue; Week 1 remains Sun (one-time)',
       'Loaded the supplied original fixed plan'
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_changes
  WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND what = 'Long-run day set to Tue; Week 1 remains Sun (one-time)'
);