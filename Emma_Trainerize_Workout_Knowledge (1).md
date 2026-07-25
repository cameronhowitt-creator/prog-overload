# Emma Trainerize Workout Knowledge File (Derived from Screen Recordings)

## Scope and notes

- Videos analyzed: **37** MP4 files available in the workspace (you indicated 38 were provided; one file was not accessible in the mounted folder at analysis time).

- Source: screen recordings of Trainerize workouts (exercise list + prescribed sets/reps/rest + logged sets/weights when visible).

- Data extraction method: automated frame sampling + OCR. **Some weights may contain OCR digit-drop errors** (e.g., `135` sometimes read as `13`). Use the ranges as *directional*, and treat obviously-low outliers as OCR noise.


## Programming patterns observed

- Common rep prescriptions seen across workouts (especially primary lifts): **6–10**, **12–15**, **8–12**, **10–12**, **4–8**.

- Rest prescriptions (all movements): **30s** most common, then **60s**; occasional **45s**.

- Typical session structure:

  1) 1 primary compound lift (often squat/deadlift/bench) with 2–4 working sets

  2) 2–4 secondary compounds or large accessories (rows, pulldowns, lunges, presses)

  3) Accessory/isolation + core work; sometimes a short circuit/finisher (e.g., “circuit of 3 rounds”).


## Rep-phase heuristic (for your CustomGPT)

- **Endurance phase:** target prescriptions where max reps ≥ 13 (e.g., 12–15, 15–20)

- **Mid-rep phase (hypertrophy):** max reps 8–12

- **Strength phase:** max reps ≤ 6 (e.g., 3–5, 4–8) and/or explicit “to failure” notes


---

## Movement inventory

Each movement below includes: how often it appeared, common prescription patterns, and logged weight/rep tendencies (where visible).


### Primary movements (main lift focus)

| Movement                     |   Seen in videos (occurrences) |   Prescribed sets (common) | Prescribed rep ranges    |   Rest (common, sec) | Logged weight typical (lb, median)   | Logged weight range   | Logged reps range   |
|:-----------------------------|-------------------------------:|---------------------------:|:-------------------------|---------------------:|:-------------------------------------|:----------------------|:--------------------|
| Barbell Back Squat           |                             13 |                          3 | 10-12, 12-15, 6-10, 8-12 |                   30 | 115                                  | 95-125 (10–90%)       | 4-12 (10–90%)       |
| Barbell Sumo Deadlift        |                              6 |                          3 | 10-12, 6-10              |                   60 | 135                                  | 16-180 (10–90%)       | 6-10 (10–90%)       |
| Barbell Bench Press          |                              5 |                          3 | 12-15, 4-8, 8-12         |                   30 | 85                                   | 57-105 (10–90%)       | 4-12 (10–90%)       |
| Dumbbell Bench Press         |                              3 |                          3 | 10-12, 6-10              |                   60 | 40                                   | 35-46 (10–90%)        | 3-12 (10–90%)       |
| Dumbbell Incline Bench Press |                              3 |                          2 | 12-15, 8-12              |                   30 | 30                                   | 30-35 (10–90%)        | 8-12 (10–90%)       |
| Barbell Incline Bench Press  |                              2 |                          3 | 4-8, 8-12                |                   30 | 75                                   | 65-83 (10–90%)        | 4-8 (10–90%)        |
| Staggered Stance Deadlift    |                              1 |                          3 | 12-15                    |                   30 |                                      |                       |                     |
| Landmine kickstand Deadlift  |                              1 |                          3 | 4-8                      |                  nan | 85                                   | 80-85                 | 4-4                 |


### Secondary movements (supporting compounds / big accessories)

| Movement                                |   Seen in videos (occurrences) |   Prescribed sets (common) | Prescribed rep ranges    |   Rest (common, sec) | Logged weight typical (lb, median)   | Logged weight range   | Logged reps range   |
|:----------------------------------------|-------------------------------:|---------------------------:|:-------------------------|---------------------:|:-------------------------------------|:----------------------|:--------------------|
| Angled Machine Leg Press                |                              9 |                          3 | 10-12, 4-8, 6-10, 8-12   |                   60 | 320                                  | 250-348 (10–90%)      | 6-10 (10–90%)       |
| Dumbbell Seated Shoulder Press          |                              8 |                          2 | 10-12, 12-15, 6-10, 8-12 |                   30 | 35                                   | 35-36 (10–90%)        | 5-10 (10–90%)       |
| Barbell Reverse Lunge                   |                              6 |                          3 | 10-12, 6-10              |                   60 | 75                                   | 45-95 (10–90%)        | 6-10 (10–90%)       |
| Barbell Bench Dumbbell Machine          |                              6 |                        nan |                          |                  nan |                                      |                       |                     |
| Close Neutral Grip Lat Pulldown         |                              5 |                          3 | 10-12, 12-15, 6-10, 8-12 |                   30 | 85                                   | 40-105 (10–90%)       | 6-12 (10–90%)       |
| Cable Seated Wide Grip Row              |                              4 |                          3 | 6-10                     |                  nan | 100                                  | 95-110 (10–90%)       | 6-7 (10–90%)        |
| Barbell Overhead Press                  |                              4 |                          3 | 12-15, 4-8, 6-10, 8-12   |                   30 | 65                                   | 23-70 (10–90%)        | 4-12 (10–90%)       |
| Machine Assisted Dip                    |                              4 |                          3 | 12-15, 4-8, 6-10, 8-12   |                   30 | 0                                    | 0-0                   | 12-12               |
| Mini Band Forward Backward Zig          |                              3 |                          3 | 20                       |                   30 | 15                                   | 15-20 (10–90%)        | 8-15 (10–90%)       |
| Seated Wide Grip Cable Row              |                              3 |                          3 | 12-15, 8-12              |                   30 | 65                                   | 60-76 (10–90%)        | 8-12 (10–90%)       |
| Double Miniband Lateral Walk            |                              3 |                          3 | 20                       |                   30 |                                      |                       |                     |
| Barbell Narrow Grip Bicep Curl          |                              3 |                          3 | 10-12, 6-10              |                   60 | 45                                   | 40-55 (10–90%)        | 6-12 (10–90%)       |
| Weight Machine                          |                              2 |                        nan |                          |                  nan |                                      |                       |                     |
| Medicine Ball Sit-Up To Press           |                              2 |                          3 | 6, 8                     |                   45 | 15                                   | 15-15 (10–90%)        | 12-15 (10–90%)      |
| Barbell Bench Cable Dumbbell            |                              1 |                        nan |                          |                  nan |                                      |                       |                     |
| Body Cable Dumbbell Machine Medicine    |                              1 |                          3 | 4-8                      |                  nan |                                      |                       |                     |
| Slt} Seated Wide Grip Cable Row         |                              1 |                          3 | 8-12                     |                   30 | 85                                   | 80-85                 | 8-8                 |
| Barbell Dumbbell Machine                |                              1 |                        nan |                          |                  nan |                                      |                       |                     |
| bg) Double Miniband Lateral Walk        |                              1 |                          3 | 20                       |                   30 |                                      |                       |                     |
| Barbell Cable Machine                   |                              1 |                          2 | 12                       |                   30 | 44                                   | 44-75                 | 12-12               |
| Meee Machine Assisted Dip               |                              1 |                          3 | 12-15                    |                   30 | 0                                    | 0-0                   | 12-12               |
| Bands Barbell Cable Dumbbell Machine Pu |                              1 |                        nan |                          |                  nan |                                      |                       |                     |
| Barbell Overhead Press 4                |                              1 |                        nan |                          |                  nan | 15                                   | 15-15                 | 12-12               |
| Machine Seated Neutral Grip Row         |                              1 |                          3 | 6-10                     |                  nan | 95                                   | 95-95                 | 6-7                 |
| Machine Assisted Close Grip Pull        |                              1 |                        nan |                          |                  nan | 15                                   | 15-15                 | 6-6                 |
| Dumbbell Single Arm Row                 |                              1 |                          3 | 6-10                     |                  nan | 55                                   | 55-55                 | 6-7                 |
| Borbell Reverse Lunge                   |                              1 |                          3 | 6-10                     |                  nan | 80                                   | 75-80                 | 6-6                 |
| Barbell Bench Dumbbell                  |                              1 |                        nan |                          |                  nan |                                      |                       |                     |
| Barbell Body Dumbbell EZ Bar Machine Si |                              1 |                        nan |                          |                  nan |                                      |                       |                     |
| Barbell Bench Body Cable Dumbbell       |                              1 |                        nan |                          |                  nan |                                      |                       |                     |
| Barbell Dumbbell Landmine Machine       |                              1 |                        nan |                          |                  nan |                                      |                       |                     |


### Accessory movements (isolation / core / conditioning)

| Movement                        |   Seen in videos (occurrences) |   Prescribed sets (common) | Prescribed rep ranges          |   Rest (common, sec) | Logged weight typical (lb, median)   | Logged weight range   | Logged reps range   |
|:--------------------------------|-------------------------------:|---------------------------:|:-------------------------------|---------------------:|:-------------------------------------|:----------------------|:--------------------|
| Dumbbell Bicep Curl             |                              8 |                          3 | 10-12, 12-15, 6-10, 8-10, 8-12 |                   60 | 20                                   | 20-25 (10–90%)        | 6-12 (10–90%)       |
| Cable Straight Bar Tricep       |                              7 |                          3 | 10-12, 12-15, 6-10, 8-12       |                   30 | 45                                   | 35-46 (10–90%)        | 6-12 (10–90%)       |
| Standing Hamstring Curl         |                              4 |                          3 | 10-12, 6-10                    |                   60 | 30                                   | 20-70 (10–90%)        | 5-10 (10–90%)       |
| Suspension Body Saw with Crunch |                              4 |                          3 | 10, 10-15                      |                   60 |                                      |                       |                     |
| Smith Machine Tricep Dip        |                              4 |                          3 | 10-12, 6-10                    |                   60 |                                      |                       |                     |
| Dumbbell Isometric Bicep Curl   |                              2 |                          3 | 10-12, 6-10                    |                   60 | 17                                   | 15-20                 | 6-12                |
| Side Plank w/ Hip Dips          |                              2 |                        nan |                                |                  nan |                                      |                       |                     |
| Reverse Crunches                |                              2 |                        nan |                                |                  nan |                                      |                       |                     |
| Dumbbell Lateral Raise          |                              2 |                          2 | 6-10                           |                  nan | 20                                   | 20-20 (10–90%)        | 6-7 (10–90%)        |
| Machine Seated Hip Adduction    |                              2 |                          3 | 4-8, 8-12                      |                   30 | 47                                   | 45-55 (10–90%)        | 4-9 (10–90%)        |
| Seam Reverse Crunches           |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| Meee Reverse Crunches           |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| fama Side Plank w/ Hip Dips     |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| Slider High Plank Body Saw      |                              1 |                          3 | 10-15                          |                   60 |                                      |                       |                     |
| i@ ., Cable Straight Bar Tricep |                              1 |                          2 | 6-10                           |                  nan | 50                                   | 50-50                 | 6-6                 |
| Meme Reverse Crunches           |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| Meee Side Plank w/ Hip Dips     |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| Mame Side Plank w/ Hip Dips     |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| Mame Reverse Crunches           |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| Same Side Plank w/ Hip Dips     |                              1 |                        nan |                                |                  nan |                                      |                       |                     |
| Smee Side Plank w/ Hip Dips     |                              1 |                          3 | 8-12                           |                   60 |                                      |                       |                     |
| Dumbbell Incline Bicep Curl     |                              1 |                          2 | 12-15                          |                   30 | 20                                   | 20-20                 | 12-12               |


---
## Appendix: Per-video extracted workout snapshots

- **ScreenRecording_02-07-2026 10-13-06_1.MP4**
  - Barbell Back Squat (3x10-12; rest 60s; logged 10@90lb, 10@90lb…)
  - Barbell Reverse Lunge (2x10-12; rest 60s; logged 10@65lb, 10@65lb)
  - Close Neutral Grip Lat Pulldown (3x10-12; rest 60s; logged 10@85lb, 10@85lb…)
  - Dumbbell Isometric Bicep Curl (3x10-12; rest 60s; logged 12@15lb, 12@15lb)
  - 4 Cable Straight Bar Tricep (3x10-12; rest 60s; logged 12@35lb, 10@40lb)
- **ScreenRecording_02-07-2026 10-13-33_1.MP4**
  - Barbell Bench Body Cable Dumbbell (prescription n/a)
  - Barbell Sumo Deadlift (3x10-12; rest 60s; logged 10@135lb, 10@135lb…)
  - Side Plank w/ Hip Dips (prescription n/a)
  - Dumbbell Bicep Curl (3x8-10; rest 60s; logged 10@20lb, 10@20lb…)
- **ScreenRecording_02-07-2026 10-13-52_1.MP4**
  - Angled Machine Leg Press (3x10-12; rest 60s; logged 10@240lb, 10@250lb…)
  - Standing Hamstring Curl (3x10-12; rest 60s; logged 12@15lb, 10@20lb…)
  - Barbell Overhead Press 4 (prescription n/a; logged 12@15lb, 12@15lb…)
  - Suspension Body Saw with Crunch (3x10; rest 60s)
  - Barbell Narrow Grip Bicep Curl (3x10-12; rest 60s; logged 12@40lb, 12@40lb…)
  - Smith Machine Tricep Dip (4x10-12; rest 60s)
- **ScreenRecording_02-08-2026 08-17-39_1.MP4**
  - Barbell Back Squat (3x10-12; rest 60s; logged 10@95lb, 11@95lb…)
  - Barbell Reverse Lunge (3x10-12; rest 60s; logged 10@50lb)
  - Dumbbell Bench Press (3x10-12; rest 60s; logged 11@35lb, 12@35lb…)
  - Reverse Crunches (prescription n/a)
- **ScreenRecording_02-08-2026 08-17-57_1.MP4**
  - Barbell Sumo Deadlift (3x10-12; rest 60s; logged 12@135lb, 10@145lb…)
  - Dumbbell Seated Shoulder Press (2x10-12; rest 60s; logged 10@35lb, 10@35lb)
  - Side Plank w/ Hip Dips (prescription n/a)
  - Dumbbell Bicep Curl (3x10-12; rest 60s; logged 12@20lb, 12@20lb…)
- **ScreenRecording_02-08-2026 08-18-17_1.MP4**
  - Barbell Body Dumbbell EZ Bar Machine Si (prescription n/a)
  - Angled Machine Leg Press (2x10-12; rest 60s; logged 12@250lb)
  - Suspension Body Saw with Crunch (3x10; rest 60s)
  - Barbell Narrow Grip Bicep Curl (3x10-12; rest 60s; logged 12@45lb, 12@45lb…)
  - Smith Machine Tricep Dip (3x10-12; rest 60s)
- **ScreenRecording_02-08-2026 18-08-04_1.MP4**
  - Barbell Back Squat (3x6-10; logged 6@115lb, 6@115lb…)
  - Barbell Reverse Lunge (3x6-10; logged 6@75lb, 6@75lb…)
  - Dumbbell Isometric Bicep Curl (2x6-10; logged 6@20lb, 6@20lb)
  - Cable Straight Bar Tricep (3x6-10; logged 6@45lb, 6@45lb)
- **ScreenRecording_02-08-2026 18-08-56_1.MP4**
  - Dumbbell Seated Shoulder Press (3x6-10; logged 6@35lb, 7@35lb…)
  - Smee Side Plank w/ Hip Dips (3x8-12; rest 60s)
- **ScreenRecording_02-08-2026 18-09-15_1.MP4**
  - Weight Machine (prescription n/a)
  - Angled Machine Leg Press (3x6-10; logged 6@300lb, 8@300lb…)
  - Standing Hamstring Curl (3x6-10; logged 6@25lb)
- **ScreenRecording_02-08-2026 18-09-38_1.MP4**
  - Barbell Bench Dumbbell (prescription n/a)
  - Barbell Back Squat (3x6-10; logged 6@115lb, 5@115lb…)
  - Borbell Reverse Lunge (3x6-10; logged 6@75lb, 6@80lb…)
  - Dumbbell Single Arm Row (3x6-10; logged 6@55lb, 7@55lb)
  - Dumbbell Bench Press (3x6-10; logged 7@40lb, 7@40lb…)
  - Meme Reverse Crunches (prescription n/a)
- **ScreenRecording_02-08-2026 18-10-01_1.MP4**
  - Cable Seated Wide Grip Row (3x6-10; logged 6@95lb, 6@95lb…)
  - Same Side Plank w/ Hip Dips (prescription n/a)
  - Dumbbell Bicep Curl (3x8-12; rest 60s; logged 6@25lb, 6@25lb)
- **ScreenRecording_02-08-2026 18-10-48_1.MP4**
  - Barbell Back Squat (3x6-10; logged 6@115lb, 7@115lb)
  - Barbell Reverse Lunge (3x6-10; logged 6@85lb, 6@85lb)
  - Close Neutral Grip Lat Pulldown (3x6-10; logged 6@105lb, 7@105lb…)
  - Mame Reverse Crunches (prescription n/a)
  - 4 Cable Straight Bar Tricep (3x6-10; logged 8@45lb, 8@45lb)
- **ScreenRecording_02-08-2026 18-11-05_1.MP4**
  - Barbell Sumo Deadlift (3x6-10; logged 6@175lb, 7@175lb…)
  - Machine Assisted Close Grip Pull (prescription n/a; logged 6@15lb, 6@15lb)
  - Cable Seated Wide Grip Row (3x6-10; logged 6@100lb, 7@100lb…)
  - Dumbbell Seated Shoulder Press (prescription n/a; logged 7@35lb, 8@35lb…)
  - Mame Side Plank w/ Hip Dips (prescription n/a)
- **ScreenRecording_02-08-2026 18-11-25_1.MP4**
  - Weight Machine (prescription n/a)
  - Angled Machine Leg Press (3x6-10; logged 8@310lb, 6@320lb…)
  - Machine Seated Neutral Grip Row (3x6-10; logged 6@95lb, 6@95lb…)
  - Dumbbell Lateral Raise (2x6-10; logged 6@20lb, 6@20lb)
  - Suspension Body Saw with Crunch (3x10-15; rest 60s)
  - Smith Machine Tricep Dip (3x6-10)
- **ScreenRecording_02-08-2026 18-11-45_1.MP4**
  - Barbell Sumo Deadlift (3x6-10; logged 7@175lb, 8@175lb…)
  - Cable Seated Wide Grip Row (2x6-10; logged 6@100lb, 7@100lb)
  - Dumbbell Seated Shoulder Press (prescription n/a; logged 8@35lb, 8@35lb…)
  - Meee Side Plank w/ Hip Dips (prescription n/a)
- **ScreenRecording_02-08-2026 18-12-12_1.MP4**
  - Barbell Back Squat (3x6-10; logged 6@115lb, 6@120lb…)
  - Barbell Reverse Lunge (3x6-10; logged 6@95lb, 6@95lb…)
  - Seam Reverse Crunches (prescription n/a)
  - “4 Cable Straight Bar Tricep (prescription n/a; logged 6@50lb)
- **ScreenRecording_02-08-2026 18-12-33_1.MP4**
  - Angled Machine Leg Press (3x6-10; logged 8@320lb, 8@330lb)
  - Standing Hamstring Curl (3x6-10; logged 6@30lb, 5@70lb…)
  - Suspension Body Saw with Crunch (3x10-15; rest 60s)
  - Barbell Narrow Grip Bicep Curl (3x6-10; logged 6@55lb, 6@55lb…)
  - Smith Machine Tricep Dip (3x6-10)
- **ScreenRecording_02-08-2026 18-12-55_1.MP4**
  - Barbell Bench Dumbbell Machine (prescription n/a)
  - Barbell Sumo Deadlift (3x6-10; logged 6@180lb, 6@180lb…)
- **ScreenRecording_02-08-2026 18-13-43_1.MP4**
  - Barbell Bench Cable Dumbbell (prescription n/a)
  - Barbell Back Squat (3x6-10; logged 4@125lb, 3@125lb…)
  - Barbell Reverse Lunge (2x6-10; logged 6@95lb, 6@45lb…)
  - Reverse Crunches (prescription n/a)
  - i@ ., Cable Straight Bar Tricep (2x6-10; logged 6@50lb)
- **ScreenRecording_02-08-2026 18-14-03_1.MP4**
  - Angled Machine Leg Press (3x6-10; logged 8@330lb, 6@340lb…)
  - Standing Hamstring Curl (3x6-10; logged 7@30lb, 7@30lb…)
  - Barbell Overhead Press (3x6-10; logged 6@70lb, 6@70lb…)
  - Dumbbell Lateral Raise (3x6-10; logged 6@20lb, 7@20lb…)
  - Slider High Plank Body Saw (3x10-15; rest 60s)
  - Machine Assisted Dip (2x6-10)
- **ScreenRecording_02-08-2026 18-14-21_1.MP4**
  - Barbell Sumo Deadlift (3x6-10; logged 6@180lb, 6@180lb…)
  - Cable Seated Wide Grip Row (3x6-10; logged 6@110lb, 6@110lb…)
  - fama Side Plank w/ Hip Dips (prescription n/a)
  - Dumbbell Bicep Curl (3x6-10; logged 6@25lb, 6@25lb)
- **ScreenRecording_02-08-2026 18-14-39_1.MP4**
  - Barbell Back Squat (3x6-10; logged 5@125lb, 6@115lb…)
  - Dumbbell Bench Press (3x6-10; logged 3@50lb, 7@45lb…)
  - Meee Reverse Crunches (prescription n/a)
- **ScreenRecording_02-08-2026 18-15-08_1.MP4**
  - Double Miniband Lateral Walk (3x20; rest 30s)
  - Mini Band Forward Backward Zig (3x20; rest 30s; logged 12@15lb, 12@15lb…)
  - Medicine Ball Sit-Up To Press (3x6; rest 45s; logged 12@15lb, 12@15lb…)
- **ScreenRecording_02-08-2026 18-15-36_1.MP4**
  - Barbell Bench Dumbbell Machine (prescription n/a)
  - Barbell Back Squat (3x12-15; rest 30s; logged 12@95lb, 12@95lb…)
  - Seated Wide Grip Cable Row (3x12-15; rest 30s; logged 12@60lb, 12@60lb…)
  - Dumbbell Seated Shoulder Press (2x12-15; rest 30s; logged 7@35lb, 10@30lb)
  - Dumbbell Incline Bench Press (2x12-15; rest 30s; logged 8@30lb)
  - Machine Assisted Dip (3x12-15; rest 30s; logged 12@0lb)
- **ScreenRecording_02-08-2026 18-15-54_1.MP4**
  - Bands Barbell Cable Dumbbell Machine Pu (prescription n/a)
  - Staggered Stance Deadlift (3x12-15; rest 30s)
  - Barbell Bench Press (3x12-15; rest 30s; logged 12@55lb, 12@55lb…)
  - Dumbbell Bicep Curl (3x12-15; rest 30s)
  - Cable Straight Bar Tricep (3x12-15; rest 30s)
- **ScreenRecording_02-08-2026 18-16-39_1.MP4**
  - Close Neutral Grip Lat Pulldown (3x12-15; rest 30s; logged 12@85lb, 12@85lb…)
  - Double Miniband Lateral Walk (3x20; rest 30s)
- **ScreenRecording_02-08-2026 18-17-20_1.MP4**
  - Barbell Bench Dumbbell Machine (prescription n/a)
  - Barbell Back Squat (3x12-15; rest 30s; logged 12@95lb, 12@100lb)
  - Seated Wide Grip Cable Row (prescription n/a; logged 12@65lb, 12@65lb…)
  - Dumbbell Incline Bench Press (2x12-15; rest 30s; logged 12@30lb, 12@30lb)
  - Dumbbell Incline Bicep Curl (2x12-15; rest 30s; logged 12@20lb, 12@20lb)
  - Meee Machine Assisted Dip (3x12-15; rest 30s; logged 12@0lb)
- **ScreenRecording_02-08-2026 18-17-42_1.MP4**
  - Barbell Cable Machine (2x12; rest 30s; logged 12@44lb, 12@44lb…)
  - Barbell Overhead Press (2x12-15; rest 30s; logged 12@55lb, 12@55lb…)
  - Barbell Bench Press (3x12-15; rest 30s; logged 12@60lb, 12@65lb…)
  - . Cable Straight Bar Tricep (2x12-15; rest 30s; logged 12@35lb)
- **ScreenRecording_02-08-2026 18-18-41_1.MP4**
  - Close Neutral Grip Lat Pulldown (2x8-12; rest 30s; logged 8@90lb, 8@90lb)
  - Double Miniband Lateral Walk (3x20; rest 30s)
  - Mini Band Forward Backward Zig (2x20; logged 8@20lb, 8@20lb…)
  - Medicine Ball Sit-Up To Press (3x8; rest 45s; logged 15@15lb, 15@15lb…)
- **ScreenRecording_02-08-2026 18-19-03_1.MP4**
  - Barbell Bench Dumbbell Machine (prescription n/a)
  - Barbell Back Squat (3x8-12; rest 30s; logged 8@110lb, 8@110lb)
  - Seated Wide Grip Cable Row (3x8-12; rest 30s; logged 8@70lb, 8@75lb…)
  - Dumbbell Seated Shoulder Press (2x8-12; rest 30s; logged 8@35lb, 8@35lb)
  - Dumbbell Incline Bench Press (2x8-12; rest 30s; logged 8@35lb, 8@35lb)
  - Machine Assisted Dip (3x8-12; rest 30s)
- **ScreenRecording_02-08-2026 18-19-31_1.MP4**
  - Angled Machine Leg Press (2x8-12; rest 30s; logged 8@340lb, 8@340lb…)
  - Barbell Bench Press (3x8-12; rest 30s; logged 8@85lb, 9@85lb…)
  - Dumbbell Bicep Curl (2x8-12; rest 30s; logged 8@20lb, 8@20lb)
  - Cable Straight Bar Tricep (2x8-12; rest 30s)
- **ScreenRecording_02-08-2026 18-19-49_1.MP4**
  - Close Neutral Grip Lat Pulldown (3x8-12; rest 30s; logged 8@90lb, 8@90lb…)
  - bg) Double Miniband Lateral Walk (3x20; rest 30s)
  - Mini Band Forward Backward Zig (3x20)
- **ScreenRecording_02-08-2026 18-20-13_1.MP4**
  - Barbell Dumbbell Machine (prescription n/a)
  - Angled Machine Leg Press (3x8-12; rest 30s; logged 8@340lb, 8@350lb)
  - Barbell Overhead Press (2x8-12; rest 30s; logged 6@65lb, 6@65lb…)
  - Barbell Bench Press (3x8-12; rest 30s; logged 8@90lb, 8@90lb…)
  - Dumbbell Bicep Curl (2x8-12; rest 30s; logged 8@20lb)
- **ScreenRecording_02-08-2026 18-20-33_1.MP4**
  - Barbell Bench Dumbbell Machine (prescription n/a)
  - Barbell Back Squat (3x8-12; rest 30s; logged 6@115lb, 6@115lb)
  - Machine Seated Hip Adduction (3x8-12; rest 30s; logged 9@45lb, 9@45lb…)
  - Slt} Seated Wide Grip Cable Row (3x8-12; rest 30s; logged 8@80lb, 8@85lb…)
  - Dumbbell Seated Shoulder Press (3x8-12; rest 30s; logged 8@35lb, 8@35lb)
  - Barbell Incline Bench Press (3x8-12; rest 30s; logged 8@65lb, 8@75lb)
- **ScreenRecording_03-01-2026 12-36-00_1.MP4**
  - Body Cable Dumbbell Machine Medicine (3x4-8)
- **ScreenRecording_03-01-2026 12-36-19_1.MP4**
  - Barbell Bench Dumbbell Machine (prescription n/a)
  - Barbell Back Squat (prescription n/a; logged 6@95lb, 4@130lb…)
  - Barbell Incline Bench Press (3x4-8; logged 4@65lb, 4@80lb…)
  - Dumbbell Seated Shoulder Press (prescription n/a; logged 4@40lb, 4@40lb)
  - Machine Seated Hip Adduction (3x4-8; logged 4@50lb, 4@55lb…)
  - Machine Assisted Dip (3x4-8)
- **ScreenRecording_03-01-2026 12-36-35_1.MP4**
  - Barbell Dumbbell Landmine Machine (prescription n/a)
  - Angled Machine Leg Press (3x4-8; logged 4@375lb, 4@380lb)
  - Landmine kickstand Deadlift (3x4-8; logged 4@80lb, 4@85lb…)
  - Barbell Overhead Press (3x4-8; logged 4@70lb, 4@70lb…)
  - Barbell Bench Press (3x4-8; logged 4@105lb, 4@105lb…)
  - Dumbbell Bicep Curl (2x8-10; rest 60s; logged 8@25lb)
