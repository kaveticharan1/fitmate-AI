export type Equipment = 'none' | 'mat' | 'dumbbells' | 'band' | 'gym';
export type Category = 'strength' | 'cardio' | 'stretch' | 'mobility';
export type Joint = 'knee' | 'back' | 'shoulder' | 'wrist';

export interface Exercise {
  id: string;
  name: string;
  nameTe: string;
  category: Category;
  equipment: Equipment;
  /** 1 beginner, 2 intermediate, 3 advanced. */
  level: 1 | 2 | 3;
  muscles: string[];
  /** Counted in repetitions or held/performed for seconds. */
  mode: 'reps' | 'time';
  steps: string[];
  safety: string;
  /** Easier version to swap in. */
  easier?: string;
  /** Joints this exercise loads; skipped for people who report problems there. */
  stresses?: Joint[];
  /** Metabolic equivalent, for calorie estimates. */
  met: number;
}

const ex = (e: Exercise) => e;

export const EXERCISES: Exercise[] = [
  // ── Strength, no equipment ───────────────────────────────────────────────
  ex({ id: 'wall_pushup', name: 'Wall push-up', nameTe: 'గోడ పుష్-అప్', category: 'strength', equipment: 'none', level: 1, muscles: ['chest', 'shoulders', 'triceps'], mode: 'reps', met: 3, steps: ['Stand an arm’s length from a wall, hands on it at shoulder height.', 'Bend your elbows to bring your chest towards the wall.', 'Push back to the start, keeping your body straight.'], safety: 'Keep your neck in line with your back.', stresses: ['wrist'] }),
  ex({ id: 'knee_pushup', name: 'Knee push-up', nameTe: 'మోకాళ్ళ పుష్-అప్', category: 'strength', equipment: 'mat', level: 1, muscles: ['chest', 'shoulders', 'triceps'], mode: 'reps', met: 3.8, easier: 'wall_pushup', steps: ['Start on hands and knees, hands slightly wider than shoulders.', 'Keep a straight line from knees to head.', 'Lower your chest towards the floor, then push back up.'], safety: 'Stop if you feel shoulder pain.', stresses: ['wrist', 'shoulder'] }),
  ex({ id: 'pushup', name: 'Push-up', nameTe: 'పుష్-అప్', category: 'strength', equipment: 'none', level: 2, muscles: ['chest', 'shoulders', 'triceps', 'core'], mode: 'reps', met: 3.8, easier: 'knee_pushup', steps: ['Start in a plank, hands under shoulders.', 'Lower your body as one unit until your chest nearly touches the floor.', 'Push back up without letting your hips sag.'], safety: 'Keep your core tight; don’t let your lower back sag.', stresses: ['wrist', 'shoulder'] }),
  ex({ id: 'chair_squat', name: 'Chair squat', nameTe: 'కుర్చీ స్క్వాట్', category: 'strength', equipment: 'none', level: 1, muscles: ['thighs', 'glutes'], mode: 'reps', met: 3.5, steps: ['Stand in front of a chair, feet shoulder-width apart.', 'Sit back slowly until you lightly touch the chair.', 'Stand up by pushing through your heels.'], safety: 'Knees follow the direction of your toes.', stresses: ['knee'] }),
  ex({ id: 'squat', name: 'Bodyweight squat', nameTe: 'స్క్వాట్', category: 'strength', equipment: 'none', level: 2, muscles: ['thighs', 'glutes', 'core'], mode: 'reps', met: 5, easier: 'chair_squat', steps: ['Stand with feet shoulder-width apart.', 'Push your hips back and bend your knees as if sitting.', 'Go as low as comfortable, then stand up.'], safety: 'Keep your heels on the floor and chest up.', stresses: ['knee'] }),
  ex({ id: 'lunge', name: 'Reverse lunge', nameTe: 'లంజ్', category: 'strength', equipment: 'none', level: 2, muscles: ['thighs', 'glutes'], mode: 'reps', met: 4, easier: 'chair_squat', steps: ['Stand tall, step one foot back.', 'Lower until both knees bend about 90°.', 'Push back to standing; alternate legs.'], safety: 'Hold a wall for balance if needed.', stresses: ['knee'] }),
  ex({ id: 'glute_bridge', name: 'Glute bridge', nameTe: 'గ్లూట్ బ్రిడ్జ్', category: 'strength', equipment: 'mat', level: 1, muscles: ['glutes', 'hamstrings', 'lower back'], mode: 'reps', met: 3, steps: ['Lie on your back, knees bent, feet flat.', 'Squeeze your glutes and lift your hips.', 'Hold a second at the top, then lower slowly.'], safety: 'Don’t arch your lower back at the top.' }),
  ex({ id: 'plank_knee', name: 'Knee plank', nameTe: 'మోకాళ్ళ ప్లాంక్', category: 'strength', equipment: 'mat', level: 1, muscles: ['core'], mode: 'time', met: 3, steps: ['Rest on forearms and knees.', 'Keep a straight line from knees to head.', 'Breathe normally and hold.'], safety: 'Stop if your lower back hurts.', stresses: ['shoulder'] }),
  ex({ id: 'plank', name: 'Plank', nameTe: 'ప్లాంక్', category: 'strength', equipment: 'mat', level: 2, muscles: ['core', 'shoulders'], mode: 'time', met: 3.8, easier: 'plank_knee', steps: ['Rest on forearms and toes, elbows under shoulders.', 'Keep your body in a straight line.', 'Hold while breathing steadily.'], safety: 'Don’t let your hips sag or rise.', stresses: ['shoulder', 'back'] }),
  ex({ id: 'dead_bug', name: 'Dead bug', nameTe: 'డెడ్ బగ్', category: 'strength', equipment: 'mat', level: 1, muscles: ['core'], mode: 'reps', met: 3, steps: ['Lie on your back, arms up, knees bent at 90° above hips.', 'Slowly lower the opposite arm and leg towards the floor.', 'Return and switch sides.'], safety: 'Keep your lower back pressed to the floor.' }),
  ex({ id: 'calf_raise', name: 'Calf raise', nameTe: 'కాఫ్ రైజ్', category: 'strength', equipment: 'none', level: 1, muscles: ['calves'], mode: 'reps', met: 2.8, steps: ['Stand tall, hold a wall for balance.', 'Rise onto your toes.', 'Lower slowly.'], safety: 'Move slowly; no bouncing.' }),
  ex({ id: 'superman', name: 'Superman hold', nameTe: 'సూపర్‌మ్యాన్', category: 'strength', equipment: 'mat', level: 2, muscles: ['lower back', 'glutes'], mode: 'time', met: 3, easier: 'glute_bridge', steps: ['Lie face down, arms stretched forward.', 'Lift arms, chest and legs a little off the floor.', 'Hold, then relax.'], safety: 'Lift only a few centimetres; stop if your back hurts.', stresses: ['back'] }),

  // ── Strength, dumbbells / band / gym ─────────────────────────────────────
  ex({ id: 'db_goblet_squat', name: 'Goblet squat (dumbbell)', nameTe: 'డంబెల్ స్క్వాట్', category: 'strength', equipment: 'dumbbells', level: 2, muscles: ['thighs', 'glutes', 'core'], mode: 'reps', met: 5, easier: 'squat', steps: ['Hold one dumbbell at your chest.', 'Squat down keeping your chest up.', 'Stand up through your heels.'], safety: 'Use a weight you can control for all reps.', stresses: ['knee'] }),
  ex({ id: 'db_row', name: 'One-arm dumbbell row', nameTe: 'డంబెల్ రో', category: 'strength', equipment: 'dumbbells', level: 2, muscles: ['back', 'biceps'], mode: 'reps', met: 3.5, easier: 'band_row', steps: ['Support one hand and knee on a bench or chair.', 'Pull the dumbbell to your hip.', 'Lower slowly; switch sides after the set.'], safety: 'Keep your back flat, not rounded.', stresses: ['back'] }),
  ex({ id: 'db_press', name: 'Dumbbell shoulder press', nameTe: 'డంబెల్ షోల్డర్ ప్రెస్', category: 'strength', equipment: 'dumbbells', level: 2, muscles: ['shoulders', 'triceps'], mode: 'reps', met: 3.5, steps: ['Sit or stand, dumbbells at shoulder height.', 'Press them overhead.', 'Lower with control.'], safety: 'Don’t lean back; skip if you have shoulder pain.', stresses: ['shoulder'] }),
  ex({ id: 'db_curl', name: 'Dumbbell curl', nameTe: 'డంబెల్ కర్ల్', category: 'strength', equipment: 'dumbbells', level: 1, muscles: ['biceps'], mode: 'reps', met: 3, steps: ['Stand with dumbbells by your sides.', 'Bend your elbows to lift the weights.', 'Lower slowly.'], safety: 'Keep elbows close to your body; don’t swing.' }),
  ex({ id: 'band_row', name: 'Resistance band row', nameTe: 'బ్యాండ్ రో', category: 'strength', equipment: 'band', level: 1, muscles: ['back', 'biceps'], mode: 'reps', met: 3, steps: ['Anchor the band at chest height.', 'Pull the handles to your ribs, squeezing shoulder blades.', 'Return slowly.'], safety: 'Check the band for tears before use.' }),
  ex({ id: 'leg_press', name: 'Leg press (machine)', nameTe: 'లెగ్ ప్రెస్', category: 'strength', equipment: 'gym', level: 2, muscles: ['thighs', 'glutes'], mode: 'reps', met: 5, easier: 'chair_squat', steps: ['Sit with feet shoulder-width on the platform.', 'Lower the weight until knees are about 90°.', 'Press back without locking your knees.'], safety: 'Never lock your knees at the top.', stresses: ['knee'] }),
  ex({ id: 'lat_pulldown', name: 'Lat pulldown (machine)', nameTe: 'లాట్ పుల్‌డౌన్', category: 'strength', equipment: 'gym', level: 2, muscles: ['back', 'biceps'], mode: 'reps', met: 3.5, easier: 'band_row', steps: ['Grip the bar wider than shoulders.', 'Pull it to your upper chest.', 'Return slowly.'], safety: 'Pull to the front, never behind the neck.', stresses: ['shoulder'] }),
  ex({ id: 'chest_press', name: 'Chest press (machine)', nameTe: 'చెస్ట్ ప్రెస్', category: 'strength', equipment: 'gym', level: 2, muscles: ['chest', 'shoulders', 'triceps'], mode: 'reps', met: 3.5, easier: 'knee_pushup', steps: ['Adjust the seat so handles are at chest level.', 'Press forward until arms are almost straight.', 'Return slowly.'], safety: 'Keep your back against the pad.', stresses: ['shoulder'] }),
  ex({ id: 'seated_row', name: 'Seated cable row', nameTe: 'సీటెడ్ రో', category: 'strength', equipment: 'gym', level: 2, muscles: ['back', 'biceps'], mode: 'reps', met: 3.5, easier: 'band_row', steps: ['Sit tall, feet on the platform.', 'Pull the handle to your stomach.', 'Return with control.'], safety: 'Don’t round your back.', stresses: ['back'] }),

  // ── Cardio ───────────────────────────────────────────────────────────────
  ex({ id: 'march', name: 'Marching in place', nameTe: 'ఉన్నచోటే నడక', category: 'cardio', equipment: 'none', level: 1, muscles: ['legs', 'heart'], mode: 'time', met: 3.5, steps: ['Stand tall and march, lifting knees to a comfortable height.', 'Swing your arms naturally.'], safety: 'Wear shoes on hard floors.' }),
  ex({ id: 'brisk_walk', name: 'Brisk walk', nameTe: 'వేగమైన నడక', category: 'cardio', equipment: 'none', level: 1, muscles: ['legs', 'heart'], mode: 'time', met: 4.3, steps: ['Walk fast enough that talking is possible but singing is not.', 'Keep your shoulders relaxed and arms swinging.'], safety: 'Walk on even ground; carry water in summer.' }),
  ex({ id: 'step_jacks', name: 'Step jacks (low impact)', nameTe: 'స్టెప్ జాక్స్', category: 'cardio', equipment: 'none', level: 1, muscles: ['legs', 'shoulders', 'heart'], mode: 'time', met: 4.5, easier: 'march', steps: ['Step one foot out while raising both arms.', 'Step back in and lower arms; alternate sides.'], safety: 'A no-jump version of jumping jacks — easy on knees.' }),
  ex({ id: 'jumping_jacks', name: 'Jumping jacks', nameTe: 'జంపింగ్ జాక్స్', category: 'cardio', equipment: 'none', level: 2, muscles: ['legs', 'shoulders', 'heart'], mode: 'time', met: 8, easier: 'step_jacks', steps: ['Jump feet apart while raising arms overhead.', 'Jump back to the start.'], safety: 'Land softly; skip if your knees hurt.', stresses: ['knee'] }),
  ex({ id: 'high_knees', name: 'High knees', nameTe: 'హై నీస్', category: 'cardio', equipment: 'none', level: 3, muscles: ['legs', 'core', 'heart'], mode: 'time', met: 8, easier: 'march', steps: ['Run in place lifting knees to hip height.', 'Pump your arms.'], safety: 'Stay on the balls of your feet; stop if dizzy.', stresses: ['knee'] }),
  ex({ id: 'mountain_climber', name: 'Mountain climbers', nameTe: 'మౌంటెన్ క్లైంబర్స్', category: 'cardio', equipment: 'mat', level: 3, muscles: ['core', 'shoulders', 'heart'], mode: 'time', met: 8, easier: 'march', steps: ['Start in a high plank.', 'Drive knees towards your chest one at a time, quickly.'], safety: 'Keep hips level; slow down if form breaks.', stresses: ['wrist', 'shoulder'] }),

  // ── Stretching and mobility ──────────────────────────────────────────────
  ex({ id: 'neck_rolls', name: 'Neck and shoulder rolls', nameTe: 'మెడ, భుజాల రోల్స్', category: 'mobility', equipment: 'none', level: 1, muscles: ['neck', 'shoulders'], mode: 'time', met: 2.3, steps: ['Slowly tilt your head side to side.', 'Roll your shoulders backwards, then forwards.'], safety: 'Move gently; no full head circles.' }),
  ex({ id: 'cat_cow', name: 'Cat-cow', nameTe: 'క్యాట్-కౌ', category: 'mobility', equipment: 'mat', level: 1, muscles: ['spine'], mode: 'time', met: 2.3, steps: ['On hands and knees, arch your back up like a cat.', 'Then let your belly drop and look up.', 'Move slowly with your breath.'], safety: 'Stay within a comfortable range.' }),
  ex({ id: 'hamstring_stretch', name: 'Seated hamstring stretch', nameTe: 'హామ్‌స్ట్రింగ్ స్ట్రెచ్', category: 'stretch', equipment: 'mat', level: 1, muscles: ['hamstrings'], mode: 'time', met: 2.3, steps: ['Sit with one leg straight, the other bent.', 'Lean forward from your hips towards the straight leg.', 'Hold, then switch legs.'], safety: 'Feel a stretch, not pain. Don’t bounce.' }),
  ex({ id: 'quad_stretch', name: 'Standing quad stretch', nameTe: 'క్వాడ్ స్ట్రెచ్', category: 'stretch', equipment: 'none', level: 1, muscles: ['thighs'], mode: 'time', met: 2.3, steps: ['Hold a wall, bend one knee and hold your ankle behind you.', 'Keep knees together; hold, then switch.'], safety: 'Use a towel around the ankle if you can’t reach.', stresses: ['knee'] }),
  ex({ id: 'child_pose', name: 'Child’s pose', nameTe: 'బాలాసనం', category: 'stretch', equipment: 'mat', level: 1, muscles: ['back', 'hips'], mode: 'time', met: 2.3, steps: ['Kneel, sit back on your heels.', 'Stretch your arms forward and rest your forehead down.', 'Breathe slowly.'], safety: 'Put a pillow under your knees if needed.' }),
  ex({ id: 'chest_opener', name: 'Doorway chest stretch', nameTe: 'ఛాతీ స్ట్రెచ్', category: 'stretch', equipment: 'none', level: 1, muscles: ['chest', 'shoulders'], mode: 'time', met: 2.3, steps: ['Place forearms on a door frame at shoulder height.', 'Step gently forward until you feel a stretch.', 'Hold.'], safety: 'Keep it gentle if you have shoulder problems.' }),
];

const byId = new Map(EXERCISES.map((e) => [e.id, e]));
export const getExercise = (id: string) => byId.get(id);
export function requireExercise(id: string): Exercise {
  const e = byId.get(id);
  if (!e) throw new Error(`Unknown exercise: ${id}`);
  return e;
}
