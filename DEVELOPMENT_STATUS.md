# Development status

_Last updated: 10 November 2026_

## Plan

Stage 1 (personal, ₹0, Android APK) in 7 phases, then optional Stage 2 (public launch). Full plan: the "FitMate AI — Implementation Plan" document.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: encrypted storage, app lock, consent, onboarding, calculations, dashboard, backup | **Done (v0.1.1), installed on device** |
| 2 | Nutrition: Indian food database, food diary, oil/family-pot logging, meal planner, grocery list | **Done (v0.2.0), automated tests passing; awaiting on-device test** |
| 3 | AI coach: chat, personalities, memory, Telugu, voice | **Done (v0.7.0)**, automated tests passing; committed locally, not pushed yet. Needs a real Gemini key test on the phone |
| 4 | Workouts: exercise library, plans, timers | **Done (v0.6.0)**, automated tests passing; committed locally, not pushed yet |
| 5 | Progress: weight/waist trends, water, sleep, habits, weekly reports | **Done (v0.4.0 + v0.5.0)**: weight/waist charts, water, sleep, habits with forgiving streaks, weekly/monthly report |
| 6 | Health: step counter, Activity Recognition, Health Connect, step validation | **Done (v0.8.0)**, automated tests passing; committed locally, not pushed yet. Needs a real-phone check of Health Connect |
| 7 | Advanced: food photos, kitchen assistant, barcode, notifications | **Done (v0.9.0 – v1.0.0)**, automated tests passing; committed locally, not pushed yet |

## Phase 1 report

### 1. Completed features
- Monorepo with npm workspaces: `apps/mobile`, `packages/core`, `packages/validation`.
- Encrypted SQLite database (SQLCipher); app refuses to run if encryption is missing (e.g. in Expo Go).
- Random 256-bit database key, wrapped with a scrypt-derived PIN key (AES-256-GCM) and stored in SecureStore (Android Keystore). Optional biometric unlock via a second Keystore-bound copy.
- Lock screen with custom PIN pad, wrong-PIN delays (30 s → 30 min), optional auto-wipe after 10 wrong PINs, auto-lock (immediately / 1 min / 5 min), screenshot blocking (on by default), Android auto-backup disabled.
- Welcome + privacy notice + 18+ check; consent records with notice version.
- 5-step onboarding wizard and profile editing (shared component), with Zod validation and translated error messages.
- Calculation engine: BMI (Asian-Indian and WHO categories), BMR, maintenance, target, macros, water, weekly change, weeks to target, safety flags.
- Dashboard with targets, macros, weight card with daily weight logging, BMI card, safety banners.
- Encrypted backup/restore (`.fmbak`, scrypt + AES-256-GCM), readable JSON export, delete all data.
- Dark/light/system theme; English and Telugu UI with bundled Noto Sans Telugu.
- CI workflow: checks + release APK build with signature verification.

### 2. Files created
See `git show --stat` for the first commit. Main areas: `packages/core/src/*`, `packages/validation/src/*`, `apps/mobile/src/{app,components,db,features,i18n,lib,security,theme}`, `apps/mobile/plugins/withReleaseSigning.js`, `.github/workflows/ci.yml`, docs.

### 3. Files modified
Expo template files: `apps/mobile/app.json`, `package.json`, `tsconfig.json` (template `App.tsx`/`index.ts` removed in favour of Expo Router).

### 4. Database changes
Migration v1: `profile`, `consents`, `weight_logs`, `body_measurements`, `app_settings`. See [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

### 5. APIs implemented
No network APIs (Stage 1 has no server). Internal module APIs: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

### 6. Tests executed
60 automated tests, all passing (25 core, 13 validation, 22 app). Details: [docs/TESTING_REPORT.md](docs/TESTING_REPORT.md).

### 7. Bugs fixed during the phase
- Two React versions installed (19.3.0 and 19.3.1) broke hooks → pinned one version with npm `overrides`.
- Screens could unmount mid-setup when the session switched to "unlocked" → consent/biometric saving now runs before the switch (`setup(pin, beforeReady)`).
- Pregnancy answer could stay on after switching sex to male → reset automatically.
- Lint: impure `Date.now()` during render, ref written during render → fixed.

### 8. Remaining issues
See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md). Most important: not yet tested on a real phone; release key must be added to GitHub secrets; Telugu needs native review.

### 9. Environment variables
None for the app. CI secrets for signing: `FITMATE_KEYSTORE_BASE64`, `FITMATE_KEYSTORE_PASSWORD`, `FITMATE_KEY_ALIAS`, `FITMATE_KEY_PASSWORD`.

### 10. Setup and run commands
See [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

### 11. Next phase
Phase 2 — Nutrition (Indian food database from IFCT 2017, food diary, oil adjustment, family pot mode, one-tap logging, meal planner, grocery list).

## Phase 2 report (v0.2.0)

### 1. Completed features
- `@fitmate/food-data`: 133 foods (Indian-first: rice, idli, dosa, pesarattu, pappu, sambar, curries, biryani, eggs, dairy, fruits, snacks, raw staples) with per-100 g nutrition, household measures (piece, katori, cup, glass, tbsp, ladle…), Telugu names and Roman-Telugu aliases, diet and allergen tags, typical cooking oil, raw-ingredient breakdown.
- Search in English, Telugu script and Roman Telugu (e.g. "annam", "kodi kura", "majjiga").
- Food diary: date navigation, 4 meals, eaten/left calories, protein/carbs/fat bars against targets, add/edit/remove, "same as yesterday", favourites, recent and popular foods.
- Portion screen: unit picker, quantity stepper, less/normal/more oil, live nutrition.
- Home (family-pot) recipes: raw ingredients + servings (+ optional cooked weight) → log your share by servings or grams.
- Meal plan (7 days): rule-based, respects diet type, allergies, dislikes, budget and cooking time; portions scaled to the calorie target; protein top-ups; swap a meal; "I ate this" logs it.
- Grocery list for 7 days: raw amounts grouped by aisle, tick-off, share as text (WhatsApp etc.).
- Home screen "Today" card with eaten vs target.

### 2–3. Files
New: `packages/food-data/*`, `apps/mobile/src/db/foodRepo.ts`, `src/features/food/*`, screens `(tabs)/food.tsx`, `(tabs)/plan.tsx`, `food/{add,item,recipes,recipe-edit,grocery}.tsx`, tests `src/__tests__/food.test.tsx`, `src/lib/time.test.ts`. Modified: schema, migrations, i18n, dashboard, tabs, root layout.

### 4. Database changes
Migration v2: `food_log_entries`, `favourite_foods`, `recipes`, `recipe_ingredients` (cascade delete), `meal_plan_choices`. All included in backups.

### 6. Tests
102 automated tests passing (34 app, 25 core, 30 food data, 13 validation) — see TESTING_REPORT.md.

### 11. Next phase
Phase 3 — AI coach (chat, personalities, Telugu, voice) — or in-app water/medicine reminders first, as discussed.

## Reminders (v0.3.0, pulled forward from Phase 7)
- Water reminders (from/until hour, every 1 or 2 hours) and medicine reminders (name + time), as local daily notifications: offline, nothing leaves the phone.
- Android channel with lock-screen text hidden; settings stored in `app_settings` (`reminders.v1`), no migration needed.
- FitMate never suggests medicine doses; it only reminds at the user's times.
- Tests: schedule building and time parsing (4 new tests; 38 app tests total). Not yet tested on a phone.

## Phase 5, part 1 (v0.4.0)
- Progress tab: weight chart (daily dots, 7-day average line, target line) over 30 days / 3 months / 1 year, weekly rate from a least-squares trend (shown only after a week of data); waist chart with logging; last-7-days food summary (only logged days count — missing is not zero).
- Home: water counter (+1 glass of 250 ml, undo) toward the daily water target.
- DB migration v3: `water_logs` (included in backups).
- `@fitmate/core/trends`: rolling average, weekly rate, week summary (6 new tests). App tests: 43.
- Not yet tested on a phone.

## Phase 5, part 2 (v0.5.0)
- Sleep log (bedtime/wake time, crosses midnight; one entry per morning, re-saving updates it) with 7-night average.
- Custom daily habits with forgiving streaks (one missed day is forgiven, two in a row end the streak).
- Report screen (last 7 or 30 days): weight change (period average vs previous period), food days, average calories/protein vs targets, average water and sleep, habit completion %.
- DB migration v4: `sleep_logs`, `habit_definitions`, `habit_logs` (cascade delete; in backups).
- Tests: 126 passing (46 app, 37 core, 30 food data, 13 validation). Not yet tested on a phone.
- Body measurements card: waist, hip, chest and upper arm (any combination), with change over the selected period. DB migration v5 adds `chest_cm`, `arm_cm`.

## Phase 4 — Workouts (v0.6.0)
- New package `@fitmate/workouts`: 33 exercises (strength, cardio, stretching, mobility) with English and Telugu names, steps, a safety note, MET value, the joints each one loads and an easier alternative; 8 workouts (home beginner and intermediate, low-impact cardio, cardio blast, dumbbell, gym machines, 30-minute walk, daily stretch).
- Personalisation: workouts are filtered by the equipment and workout preference in the profile; injuries typed in the profile (English or Telugu, e.g. "knee pain", "మోకాలు") swap exercises that load that joint for an easier one, or drop them.
- Daily suggestion rotates strength, walking/cardio and a Sunday stretch; level comes from the activity level in the profile.
- Workout tab (6th tab): today's suggestion, this week's count and minutes, workouts with filters, history.
- Workout screen: set counter, rest timer and timed-exercise countdown based on end times (stay correct if the phone sleeps), "easier version" and skip buttons, end early, screen kept awake, optional spoken cues (phone's own text-to-speech, offline; off by default). A workout in progress survives auto-lock (kept in memory, not on disk).
- Finished workouts are saved with duration, sets done and estimated calories (MET × weight × time, scaled by sets done); a workout ended before any set isn't saved.
- DB migration v6: `workout_sessions` (in backups).
- New packages: `expo-speech`, `expo-keep-awake`.
- Tests: 148 passing (56 app, 37 core, 30 food data, 13 validation, 12 workouts). Lint and type check clean; Android bundle exports. Not yet tested on a phone.
- Bug found by testing and fixed: the rest timer showed one extra second right after a set until the first tick.

## Phase 3a + 3b — AI coach and voice (v0.7.0)
- **Free, your own key:** the coach uses Google Gemini with the user's own free API key from Google AI Studio. The key is checked with Google before saving and kept only in SecureStore (Android Keystore); it is never in the database, backups or exports, and it is erased with "Delete all data". It goes in a request header, never in a URL.
- **Consent first:** a plain-language screen says exactly what is sent (messages, recent chat, a short summary: age, height, weight, goal, diet, today's food, water, sleep and workouts) and what is not (name, date of birth, health notes). It also notes that Google's free tier may use what is sent to improve its products. Consent is recorded and withdrawn in the consents table.
- **Model choice:** the app asks Google which models the key can use and picks the newest stable Flash model, so it keeps working when Google renames models.
- **Coach chat** (Home card → chat; You → AI coach):
  - Shows suggested questions, plain-text replies and a "typing…" state.
  - Errors are explained (bad key, free limit used up, busy, offline, timeout), with a retry button, and a message left unanswered is noticed when the chat is reopened.
- **Personalities and language:** five personalities (friendly, strict, trainer, motivational, military) and replies in English or Telugu, both taken from the profile.
- **Safety rules in the prompt:** no diagnosis or medicines, no eating below the calorie target, no shaming, injuries respected. With eating-disorder history, calorie numbers are hidden from the coach entirely. Pregnancy and breastfeeding are handled. Pain means stop; chest pain or fainting means call 112.
- **Local safety check (on the phone, before anything is sent):** self-harm messages show a Tele-MANAS 14416 call button, and emergency symptoms show a 112 call button. Both work even offline. Ordinary gym talk ("killing it", "chest press") is not flagged.
- **Memory:** the coach can save short facts with a visible tag; you can see and delete them under You → AI coach (30 maximum). You can delete the chat history or turn the coach off at any time.
- **Voice (3b):**
  - A mic button uses Android's own speech recogniser (Google app) in Indian English or Telugu. The transcript goes into the message box for you to check; it is never sent automatically.
  - Replies can be read aloud (speaker toggle, or per message) with the phone's voice, Markdown and emoji removed.
- **Database:** migration v7 adds `coach_messages` and `coach_memory` (both in encrypted backups).
- **New code and packages:** new package `@fitmate/coach` (prompt, safety, Gemini client). New dependency: `expo-speech-recognition` (adds RECORD_AUDIO and the speech-service query to the manifest, verified with prebuild).
- **Testing:**
  - 180 tests passing (74 app, 37 core, 30 food data, 14 coach, 13 validation, 12 workouts); lint and type check clean; the Android bundle exports.
  - Not tested against the real Gemini service from here: the development workspace cannot reach Google. The client follows the documented v1beta REST format and is covered by tests with recorded-shape responses. The first real check is on your phone with your key.
  - Bug found by testing and fixed: "end my workout" was wrongly flagged as a crisis message.

## Phase 6 — Steps and Health Connect (v0.8.0)
- **Health Connect (read only):**
  - Reads steps, weight and sleep from Android's on-phone Health Connect, using `react-native-health-connect` 4.1.3 (Expo config plugin; minSdk raised to 26 as it requires).
  - Nothing is written to Health Connect, and nothing leaves the phone.
- **Where the steps come from:** the phone itself (Android 14 and later count steps natively in Health Connect once an app asks to read steps, on phones with the required system update), or any app that shares with Health Connect: Google Fit, Fitbit, Mi Fitness, Samsung Health, or a watch app.
- **No double counting:** daily totals use Health Connect's own aggregation, which merges phone and watch steps.
- **Sync:**
  - Covers the last 30 days.
  - Runs automatically when Home opens (at most every 5 minutes), and from a "Sync now" button.
  - The "Steps today" card shows when it last synced.
- **Typing steps in:**
  - Works for anyone without Health Connect.
  - A typed-in day is never overwritten by a sync (checked by a SQL test).
  - "Use Health Connect value instead" switches the day back to the synced number.
- **Step validation:**
  - The last two days' raw records are checked.
  - Bursts, cadence above 220 steps/min and days over 60,000 steps are flagged with a warning ("may come from shaking or vehicle vibration").
  - Flagged steps are not deleted: Health Connect already merges sources, and the user decides.
- **Weight and sleep import** (each can be switched off):
  - Weight from other apps or scales: the latest reading of the day, and only for days with no weight logged in FitMate.
  - Sleep sessions of 1 hour or more: only for mornings with nothing logged. Naps are skipped.
- **Step goal:** starts from the activity level (6,000 / 8,000 / 10,000 / 12,000) and can be changed (1,000–50,000).
- **Screens:**
  - **Home:** a "Steps today" card with goal progress, about how many km and kcal, the sync state and the warnings.
  - **Progress:** "Steps this week" bars, the 7- and 30-day averages, and the days at goal.
  - **Report:** average steps per day.
  - **Settings:** You → Steps and Health Connect, covering availability (not installed or needs an update), connect, the import switches, open Health Connect, stop syncing, and the step goal.
- **AI coach:** now also gets today's steps, the goal and the 7-day average; the consent text was updated to say so.
- **Database:** migration v8 adds `step_days` (day, steps 0–200,000, source, flags), which is included in backups.
- **Not built, by decision:** a separate background step counter of our own. Android only counts reliably for an app that keeps a background service and notification running. Health Connect already does this with the phone's step counter sensor, using less battery.
- **Tests:** 205 passing (93 app, 43 core, 30 food data, 14 coach, 13 validation, 12 workouts). Lint and type check are clean, the Android bundle exports, and prebuild shows the Health Connect permissions, the rationale intent and the permission-usage alias in the manifest. Health Connect itself can only be tried on a real phone.

## Phase 7a — Barcode scanning (v0.9.0)
- **Scanning:** Add food → "Scan barcode" uses the camera (expo-camera, EAN-13/EAN-8/UPC). You can also type the barcode number, which is checked with the check digit before looking it up.
- **Lookup:**
  - Saved packaged foods are checked first, so they work offline.
  - Otherwise FitMate asks Open Food Facts, a free, open community database, with no key. The request sends only the barcode and an app-only User-Agent (no personal data), fetches only the needed fields and times out after 15 seconds.
  - Data is credited to Open Food Facts contributors (ODbL).
- **Checks on the values:**
  - Products are shown per 100 g with a "check against the pack" note.
  - Missing or unbelievable values (over 900 kcal, or macros adding up to more than 100 g per 100 g) send you to a form to type the pack's "per 100 g" column.
  - Unknown products, and foods without a barcode, use the same form.
- **Logging:**
  - Saved packaged foods appear in Add food and in search.
  - The amount is chosen in grams or "1 serving", with live calories and macros.
  - Logged packaged foods can be edited or removed from the diary.
- **Database:** migration v9.
  - Adds a new `custom_foods` table (in backups).
  - Rebuilds `food_log_entries`, keeping all entries, to add `custom_food_id` and allow 'barcode' and 'photo' entries.
  - "Same as yesterday" keeps a photo entry's type.
- **Tests:** 226 passing (108 app, 43 core, 36 food data, 14 coach, 13 validation, 12 workouts), including the v9 upgrade keeping data, barcode check digits, reading Open Food Facts (kJ conversion, missing values, unknown products), the lookup order and errors, and the scan, label form, amount and add-food screens.

## Phase 7b — Food photo → calories (v0.10.0)
- **Starting a photo:** Add food → "Food photo". Take a photo or choose one from the gallery (Android's system photo picker, so no storage permission is needed).
- **The AI coach is required:** the photo goes to Google Gemini with your own key, in the same way as the coach. Without the coach turned on, the screen offers to set it up. The consent text now mentions food photos.
- **Photos are never kept:** each photo is shrunk to 1,024 px JPEG (about 100–200 KB, for a fast upload), sent as Base64, and both temporary files are deleted.
- **The AI's answer is not trusted blindly:**
  - It must be strict JSON: at most 12 items, each value clamped to a believable range, unnamed items dropped.
  - If the stated calories disagree with protein/carbs/fat by more than 35%, the calories are recalculated from the macros (4/4/9).
  - A "no food" answer is shown as such.
- **You correct it before anything is saved:** a confidence banner (high, medium or low) and the AI's note are shown. Each item's portion can be changed (nutrients scale with it) or the item removed. Then pick the meal and "Add to …".
- **Saving:** each item becomes its own 'photo' diary entry. Tapping one shows what was saved, with a remove button.
- **Tests:** 241 passing (118 app, 43 core, 36 food data, 19 coach, 13 validation, 12 workouts), including the prompt and request shape, reading and checking the estimate, scaling, the key in a header, error mapping, shrinking and deleting the photo, the no-key and no-consent refusals, and the photo screen (needs the coach, privacy note, portion fixing, removing, impossible portions, no food, denied camera, AI errors, cancelled picking).

## Phase 7c — Kitchen assistant (v0.11.0)
- **"What can I cook with what I have?"** Open it from Add food or the Plan tab.
  - Tap the ingredients you have (about 45, searchable in English and Telugu, remembered for next time).
  - Oil, sugar, salt and spices are assumed.
- **Works offline:**
  - Matches against the ingredient lists of the 63 dishes in the food database.
  - Any vegetable counts for "mixed vegetables" dishes.
  - Follows the profile's diet, allergies and dislikes.
  - Shows "You can cook now" and "With one more thing (needs …)", sorted by protein per 100 kcal. Tap a dish to log it.
- **AI coach option:** "Ask the AI coach for a recipe" opens the chat with a ready-made question listing your ingredients (English or Telugu). You can edit it before sending; it's never sent automatically.
- **Tests:** 252 passing (123 app, 43 core, 42 food data, 19 coach, 13 validation, 12 workouts), covering the ingredient list without staples, dishes now and missing one, vegetables, diet/allergy/dislike filters, the coach question, the kitchen screen (remembering the selection, logging a dish, search, coach button) and the coach's prefilled question.

## Phase 7d — Smart reminders (v1.0.0)
- Worked out on the phone from today's data, with no server. They're recalculated whenever Home opens or food, water, steps or workouts change.
- **Evening check-in** (18:30, 19:30, 20:30 or 21:30):
  - Names at most two things still short: protein under 80% of the target, water under 70%, steps under 70% of the goal, or no workout when steps aren't tracked.
  - Each comes with a practical tip.
  - Nothing is sent on a day that's on track. A gentle generic check-in is sent if nothing was logged.
  - Tomorrow's is prepared once today's time has passed.
- **"Remind me to log food"** at 2 pm, only if nothing has been logged yet.
- **Morning plan** at 8 am with the day's targets.
- **Weekly weigh-in** on Sunday at 7:30 am, with how to weigh consistently.
- **Eating-disorder history:** no food-number nudges, and a gentle morning text.
- **Permissions and coexistence:**
  - The automatic refresh never asks for notification permission; only Save in settings does.
  - Water and medicine reminders and smart reminders replace only their own notifications.
  - The lock screen still hides the text.
- **Settings:** older saved reminder settings are upgraded with the new options turned off.
- **Tests:** 268 passing (139 app, 43 core, 42 food data, 19 coach, 13 validation, 12 workouts).

## Central agent + Face & Skin (v1.1.0)
- Coach can propose actions (log food, water, weight, sleep; set a reminder) — each shown as a card you Confirm or Decline. Agent settings and chat retention (30/90/365 days/forever) in Settings → AI.
- Smart reminders tap through to the coach; daily briefing (morning) and evening review card on Home.
- Face & Skin hub (You tab, Progress): daily face check-in, 14-day puffiness trend, possible patterns with sleep/water/salt/alcohol, encrypted private face photos with optional AI observations (separate consent), skin profile, beginner-safe routine builder with daily ticks, ingredient checker (paste or photograph the label; compare two), weekly report, and safety escalation (112 / doctor).
- Coach receives face/skin context and short reference entries from the skincare library, clearly labelled as user-reported, AI estimate or reference.

## Own step counter + Groq AI (v1.6.0)
- **FitMate's own step counter.** A small native module (`apps/mobile/modules/fitmate-steps`, Kotlin) reads Android's hardware step counter (TYPE_STEP_COUNTER) — the same low-power chip step apps use — with the "Physical activity" permission. No other app or sync involved.
  - Live: the Steps card updates on every step while it's on screen.
  - While closed: the chip keeps counting; the background check takes a reading about every 30 minutes, and the app reads it again when opened, so no steps are lost.
  - A step ledger turns readings into steps per day: splits walks across midnight by time, handles phone restarts (counter resets to 0), ignores impossible jumps (> 4 steps/s). Kept in secure storage so it works while the database is PIN-locked; copied into the database (source `phone`, migration v12) on opening.
  - Typed-in totals still win for that day. When the phone counts steps, Health Connect is used only for weight and sleep. Phones without a step sensor fall back to Health Connect or typing.
- **Groq for the AI coach** (recommended; Gemini still works). Keys are recognised automatically (gsk_ / AIza). Chat uses `openai/gpt-oss-120b` with low reasoning effort (fast and accurate), falling back to `openai/gpt-oss-20b` then `qwen/qwen3.8-27b`; photos (food, labels, face) use `qwen/qwen3.8-27b`, Groq's free vision model (preview). Free plan per model: 30 requests/min, 1,000/day, 8,000 tokens/min — history is trimmed shorter on Groq.

## Buddy mode (v1.5.0)
- Small friend groups (up to 20) with an 8-letter invite code; create or join from You → Buddies or Home.
- Each member chooses what to share: steps today, workouts this week, water, logging streak, and (off by default, never in gentle mode) a weight direction ↓ → ↑. Never shared: food logs, calories, exact weight, photos, face & skin, coach chats.
- See each friend's day with progress bars and chips; send cheers (👏 🔥 💪 💧 🚶); cheers you received in the last week.
- Summary syncs quietly from Home at most every 15 minutes; the group screen refreshes every minute while open.
- Server: free Supabase project `fitmate-buddies` (Mumbai). Tables are in a private schema with RLS; the app can call only six functions, each checking a per-member secret kept in the phone's secure storage (bcrypt-hashed on the server). Inputs are cleaned and clamped server-side. Leaving deletes your member record, summary and cheers; "Delete all data" and auto-wipe leave the group too. Schema in `supabase/migrations/`.
- Cost: ₹0 on the free plan. Free projects pause after 7 days with no activity; daily use keeps it awake.

## Fix (v1.4.1) — coach busy / too slow
- Backup models: FitMate saves a chain of Gemini models for your key — newest stable Flash, then Flash-Lite (faster, its own free quota), then an older Flash. If one is busy (503), slow, out of its quota, or retired, the next is tried automatically; a busy model gets one quick retry first. Keys saved by older versions get their backups on the next question.
- Shorter waits per model (35 s, then 30 s) so a backup starts sooner. Used by chat, food photos, face photos and ingredient labels.
- Clearer messages when every model fails.

## Glow design (v1.4.0) — FitPilot look
- New violet "glow" theme (dark and light): deep night background with soft violet/blue light, glass cards with a faint violet edge, gradient primary buttons and progress bars. All text colours checked for ≥ 4.5:1 contrast.
- Pilo, an original robot coach mascot drawn in SVG (no image files): on the Home hero card ("Coach active"), in the coach header, empty chat, setup and while the coach is typing; moods happy / thinking / cheer.
- Today's plan (adaptive timeline): face check-in, meals, snack, workout and bedtime at your reminder times, marked Done / Next / Still open, with the coach's confirmed changes shown as "AI adjustment" steps at the time they were made; water and steps progress; "Ask the coach to adjust the rest of today".
- Chat: gradient bubbles for your messages, glass bubbles for the coach.

## Fix (v1.3.2) — coach timing out
- Newer Gemini Flash models think before answering by default, which could take longer than the app waited ("The AI took too long to answer"). Chat now asks for minimal thinking (photo, face and label reading use low), using thinkingLevel on Gemini 3+ and thinkingBudget on 2.5, with an automatic retry without it if a model rejects the setting. Chat waits up to 60 s.
- The model picker now skips slow or specialised variants (thinking/deep-think/research/agent, Gemma, image models). A saved choice like that is replaced automatically; a retired model is re-picked and the question retried once.

## Fix (v1.3.1)
- v1.3.0 closed immediately on opening: the release build's code shrinker removed a class WorkManager (used by the background step check) needs at startup. Keep rules added.
- CI now builds the release APK for an Android emulator too and opens it there; a release is only published if the app opens and stays running.

## Updates (v1.3.0)
- Background step check: with "Live steps for reminders" allowed (Settings → Health, or asked when connecting Health Connect), Android runs a check about every 30 minutes that reads today's steps from Health Connect and keeps the evening check-in accurate — dropped once you catch up, or updated with the real steps left. FitMate's own database stays locked behind your PIN; steps are saved into it when the app opens.
- Exercise how-to steps and safety notes in Telugu for all 33 exercises.
- Food database: 67 regional dishes added (200 total) — Andhra/Telangana favourites (gongura, avakaya, bobbatlu, pootharekulu, ulava charu, haleem…), South and North Indian dishes, street food and sweets.
- Telugu wording pass for consistent terms.

## New look (v1.2.0)
Kept FitMate's dark, readable style and one green accent; borrowed layout ideas from the FitPilot concept.
- Five tabs: Home, Food, Coach, Workout, You (active tab shown as a pill). Plan and Progress open from Home and Food.
- Home: greeting with your initial, an "Ask your AI coach" bar with camera (photo-log a meal for the time of day) and mic (opens the coach already listening), briefing/review card, and a Daily summary list — food, protein, water, workout, steps, face check-in — each with a status chip (To do / In progress / Done / Over) and a tap-through. Gentle mode hides calorie and protein numbers.
- Coach is a tab with an online status and settings button. When a reply proposes several changes, "Apply all changes" confirms them in one tap (each still listed; a failure doesn't stop the rest).
- Food tab: shortcuts to Plan, Kitchen and Photo log.

## Stage 1 complete
All seven planned phases are built (WhatsApp and on-phone AI left out by decision). What's left is on-device testing of Phases 2–7 and then the optional Stage 2.

