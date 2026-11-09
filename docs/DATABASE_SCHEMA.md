# Database schema

Engine: SQLite 3 with SQLCipher 4 (AES-256), one encrypted file `fitmate.db` in the app's private storage.
Migrations: `apps/mobile/src/db/migrations.ts`, tracked with `PRAGMA user_version`. Current version: **1**.
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
| created_at, updated_at, deleted_at | TEXT | |

Index: `body_measurements_measured_on_idx (measured_on)`.

## app_settings

| Column | Type | Notes |
| --- | --- | --- |
| key | TEXT PK | |
| value | TEXT (JSON) | |
| updated_at | TEXT | |

## Stored outside the database

| Where | Key | Contents |
| --- | --- | --- |
| SecureStore (Keystore) | `fm.vault.wrapped.v1` | PIN-wrapped database key |
| SecureStore (Keystore, biometric-bound) | `fm.vault.bio.v1` | database key for biometric unlock (optional) |
| SecureStore | `fm.vault.failures.v1` | wrong-PIN counter, lock-out time |
| SecureStore | `fm.security.prefs.v1` | biometric on/off, auto-lock seconds, screenshot blocking, auto-wipe |
| AsyncStorage | `fm.appLanguage`, `fm.theme` | non-sensitive UI preferences, needed before unlock |

## Planned tables (later phases)

food_items, food_nutrition, food_measures, recipes, recipe_ingredients, meal_plans, planned_meals, grocery_lists, food_logs, food_log_items (Phase 2); coach_conversations, coach_messages, coach_memory, ai_usage, training_modes, coach_preferences (Phase 3); exercises, workout_plans, workout_plan_exercises, workout_sessions, workout_logs (Phase 4); water_logs, sleep_logs, habit_definitions, habit_logs, weekly_reports (Phase 5); health_permissions, health_sync_records, step_samples, activity_segments (Phase 6); notification_preferences (Phase 7).
