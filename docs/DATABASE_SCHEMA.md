# Database schema

Engine: SQLite 3 with SQLCipher 4 (AES-256), one encrypted file `fitmate.db` in the app's private storage.
Migrations: `apps/mobile/src/db/migrations.ts`, tracked with `PRAGMA user_version`. Current version: **9**.
ORM definitions: `apps/mobile/src/db/schema.ts`. A test checks that the migration SQL and the Drizzle schema have identical columns.

Conventions: UUID text primary keys (except the single profile row `id = 'me'`); `created_at`, `updated_at`, `deleted_at` as ISO-8601 UTC text; calendar dates (`measured_on`) as the user's local `YYYY-MM-DD`; booleans as 0/1; lists as JSON text.

## profile (one row)

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | always `me` |
| name | TEXT | |
| date_of_birth | TEXT | `YYYY-MM-DD`, must be 18+ |
| sex | TEXT | `male` / `female` / `unspecified` (CHECK) |
| height_cm | REAL | CHECK 100–250 |
| weight_kg | REAL | CHECK 25–350, current weight |
| target_weight_kg | REAL NULL | CHECK 25–350 |
| waist_cm, hip_cm | REAL NULL | latest values (history in `body_measurements`) |
| goal | TEXT | fat_loss, maintain, muscle_gain, general_fitness, activity_habits |
| activity_level | TEXT | sedentary, light, moderate, very_active |
| occupation | TEXT NULL | |
| sleep_hours | REAL NULL | |
| workout_preference | TEXT | none, walking, home, gym, mixed |
| equipment | TEXT (JSON array) | |
| coach_personality | TEXT | friendly, strict, trainer, motivational, military |
| diet_type | TEXT | vegetarian, eggetarian, non_vegetarian, vegan |
| allergies, disliked_foods | TEXT (JSON array) | |
| cooking_time | TEXT | none, under_15, under_30, over_30 |
| budget | TEXT | low, medium, high |
| is_pregnant_or_breastfeeding | INTEGER | 0/1 — disables any calorie deficit |
| has_eating_disorder_history | INTEGER | 0/1 — disables any calorie deficit |
| has_medical_condition | INTEGER | 0/1 — halves the deficit |
| health_notes, injuries | TEXT NULL | free text, voluntary |
| ai_language | TEXT | `en` / `te` (separate from app UI language) |
| created_at, updated_at, deleted_at | TEXT | |

## consents

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | UUID |
| kind | TEXT | `privacy_notice`, `age_18_plus` |
| notice_version | TEXT | e.g. `2026-11-09` |
| granted_at | TEXT | |
| withdrawn_at | TEXT NULL | |
| created_at, updated_at, deleted_at | TEXT | |

## weight_logs

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | UUID |
| measured_on | TEXT | local date; one live entry per day (later entries update it) |
| weight_kg | REAL | CHECK 25–350 |
| note | TEXT NULL | |
| created_at, updated_at, deleted_at | TEXT | |

Index: `weight_logs_measured_on_idx (measured_on)`.

## body_measurements

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | UUID |
| measured_on | TEXT | local date |
| waist_cm, hip_cm | REAL NULL | |
| chest_cm (v5) | REAL NULL | 40–250 |
| arm_cm (v5) | REAL NULL | 10–80 |
| created_at, updated_at, deleted_at | TEXT | |

Index: `body_measurements_measured_on_idx (measured_on)`.

## app_settings

| Column | Type | Notes |
| --- | --- | --- |
| key | TEXT PK | |
| value | TEXT (JSON) | |
| updated_at | TEXT | |

## food_log_entries (v2)

| Column | Type | Notes |
| --- | --- | --- |
| id | TEXT PK | UUID |
| logged_on | TEXT | local date |
| meal | TEXT | breakfast, lunch, snack, dinner |
| food_id / recipe_id | TEXT NULL | one of them required (CHECK) |
| name | TEXT | name at the time of logging |
| quantity_g | REAL | 0 < g ≤ 5000 |
| measure_key, measure_count | TEXT, REAL | e.g. katori × 1.5, or serving × 1 for recipes |
| oil_level | TEXT | less, normal, more |
| kcal, protein_g, carbs_g, fat_g, fiber_g | REAL | stored as eaten, so later food-data updates never change history |
| source | TEXT | manual, plan, repeat, recipe |
| created_at, updated_at, deleted_at | TEXT | soft delete |

Index: `food_log_entries_logged_on_idx (logged_on)`.

## favourite_foods (v2)

`food_id` TEXT PK, `created_at`.

## recipes and recipe_ingredients (v2)

`recipes`: id, name, servings (> 0), total_cooked_g (optional, > 0), timestamps.
`recipe_ingredients`: id, recipe_id → recipes ON DELETE CASCADE, food_id, grams (> 0), timestamps. Index on recipe_id.

## meal_plan_choices (v2)

Primary key (plan_date, meal); `swap_index` (which suggestion is shown), `eaten_at` (set by "I ate this"), `updated_at`. The plan itself is recalculated from the profile, so it always follows profile changes.

## water_logs (v3)

id, logged_on (local date), ml (0 < ml ≤ 3000), timestamps; index on logged_on. Undo soft-deletes the latest entry.

## sleep_logs, habit_definitions, habit_logs (v4)

`sleep_logs`: id, woke_on (unique, local date of waking), bed_time, wake_time (HH:MM), minutes (1–1439), timestamps.
`habit_definitions`: id, name, timestamps (soft delete).
`habit_logs`: id, habit_id → habit_definitions ON DELETE CASCADE, done_on; unique (habit_id, done_on).

## workout_sessions (v6)

id, workout_id (id from `packages/workouts`), done_on (local date), started_at, duration_s, completed_sets, total_sets, est_kcal (all ≥ 0), exercises (JSON list of exercise ids done), timestamps. Index on done_on.

## coach_messages, coach_memory (v7)

`coach_messages`: id, role ('user' | 'coach'), text, flags (JSON list of local safety flags: 'crisis', 'emergency'), timestamps. Index on created_at.
`coach_memory`: id, text (1–200 characters), timestamps. At most 30 facts, managed in You → AI coach.
The Gemini API key is **not** in the database: it is in SecureStore under `fm.ai.gemini.v1`.

## step_days (v8)

day (local `YYYY-MM-DD`, primary key), steps (0–200,000), source ('health_connect' | 'manual'), flags (JSON list of validation warnings: 'too_fast', 'burst', 'daily_total'), created_at, updated_at. Synced values never replace a 'manual' day.
Health Connect settings live in `app_settings`: `healthEnabled`, `healthImportWeight`, `healthImportSleep`, `healthLastSync`, `stepGoal`.

## custom_foods (v9) and food_log_entries changes

`custom_foods`: id, barcode (unique, optional), name (1–120), brand, kcal/protein/carbs/fat/fibre per 100 g (range-checked), serving_g (1–2000, optional), source ('barcode' | 'label'), timestamps.
`food_log_entries` was rebuilt in v9 (data copied) to add `custom_food_id` and the sources 'barcode' and 'photo'. A row must reference a food, recipe or custom food, unless it is a 'photo' estimate.

## Food database

Not stored in SQLite: the 133 foods (and the exercises and workouts in `packages/workouts`) ship with the app in `packages/food-data` (read-only), so updates arrive with app updates.

## Stored outside the database

| Where | Key | Contents |
| --- | --- | --- |
| SecureStore (Keystore) | `fm.vault.wrapped.v1` | PIN-wrapped database key |
| SecureStore (Keystore, biometric-bound) | `fm.vault.bio.v1` | database key for biometric unlock (optional) |
| SecureStore | `fm.vault.failures.v1` | wrong-PIN counter, lock-out time |
| SecureStore | `fm.security.prefs.v1` | biometric on/off, auto-lock seconds, screenshot blocking, auto-wipe |
| SecureStore | `fm.ai.gemini.v1` | the user's Gemini API key and chosen model (optional) |
| AsyncStorage | `fm.appLanguage`, `fm.theme` | non-sensitive UI preferences, needed before unlock |

## Planned tables (later phases)

notification_preferences (Phase 7).
