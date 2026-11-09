# Known issues and limitations

| # | Issue | Impact | Plan |
| --- | --- | --- | --- |
| 1 | **Not yet tested on a real phone.** All checks so far are automated (unit, database, screen tests, bundle and native project generation). | Device-specific problems may exist (Keystore, biometrics, SQLCipher, fonts). | Install the first CI APK on the Poco X5 and walk through every screen. |
| 2 | Release signing secrets must be added to GitHub manually. | Without them, CI produces test-only APKs. | Owner adds 4 secrets (SETUP_GUIDE §C). |
| 3 | Telugu translation written by the developer, not yet reviewed by a native speaker. | Some wording may sound unnatural. | Review in Phase 3 together with coach replies. |
| 4 | scrypt speed on mid-range phones is unmeasured (PIN unlock N=2^14, backups N=2^15). | Unlock may take ~0.5–2 s; backups slightly longer. | Measure on the Poco X5; tune parameters if needed (stored per blob, so changeable). |
| 5 | PIN brute force on a rooted phone: an attacker who extracts the Keystore-protected blob could try PINs offline (scrypt slows each guess). | Short PINs are weaker against such an attacker. | 6+ digit PINs recommended in the UI; weak PINs rejected. Rooted phones are out of scope (documented). |
| 6 | Biometric unlock copy is invalidated by Android when fingerprints change. | User must unlock with PIN and re-enable biometrics. | Expected Android behaviour; PIN always works. |
| 7 | The dashboard "start weight" for the progress bar is the oldest of the last 30 weigh-ins. | Progress bar resets after 30 entries. | Phase 5 stores an explicit start weight per goal. |
| 8 | `newArchEnabled=true` and React Native 0.88 with several native modules not yet exercised on device. | Possible native crash. | Covered by issue 1. |
| 9 | iPhone not supported in Stage 1 (APK only). | Friends with iPhones can't install. | Stage 2 with an Apple developer account. |
| 10 | Repository is public. | Code (not data) is visible to anyone; no secrets are in it. | Make it private in GitHub settings if preferred. |
| 11 | APKs are built for 64-bit ARM (`arm64-v8a`) only, to cut build time roughly 4×. | Rare 32-bit-only or x86 phones can't install it. | Add `armeabi-v7a` to the Gradle flag in `ci.yml` if ever needed. |
| 12 | Food values for home-cooked dishes are typical recipes, not measurements of your kitchen. | Logged calories can be off by 10–25 %, mostly from oil. | Oil choice, home recipes for your own dishes, weekly weight trend as the real check. |
| 13 | Food database has 133 items; many regional dishes are missing. | Some foods can't be found. | Add as a home recipe; database grows in later updates. |
| 14 | The planner's protein top-up may still fall short for high-protein targets on vegan diets. | Plan below protein target. | Shown honestly on the plan's protein bar; AI coach (Phase 3) will suggest alternatives. |
| 15 | Grocery ticks are not saved after leaving the screen. | Ticks reset. | Acceptable for now; persist if useful. |
| 16 | Food repository functions are covered through screen tests and pure-logic tests, not direct database tests. | A database-only bug could slip through. | Covered by the on-device test. |
| 17 | Exercise names are in English and Telugu, but the how-to steps and safety notes are English only. | Telugu users read the instructions in English. | Translate the 33 exercises' steps in a later update. |
| 18 | Spoken cues use the phone's own text-to-speech. Many phones have no Telugu voice installed. | Telugu cues may be read in an English voice or not at all. | Install a Telugu voice in Android's text-to-speech settings, or keep cues in English. |
| 19 | A workout in progress is kept in memory only. | If Android closes the app mid-workout, that workout is lost. | Acceptable for 10–40 minute sessions. |
| 20 | Calorie burn is a MET estimate. | Can be off by 20–30 %. | Shown as "~" and explained on the screen; weight trend is the real check. |
| 21 | The AI coach needs internet and the user's own Gemini key; the free tier has daily limits that Google sets and can change. | No coach replies offline, or after the limit until it resets. | Clear error message; everything else in the app works offline. |
| 22 | On Google's free tier, what is sent to Gemini may be used by Google to improve its products. | Privacy trade-off. | Said plainly on the consent screen; only a minimal summary is sent (no name, date of birth or health notes); the coach can be turned off any time. |
| 23 | Voice typing uses the Google app's speech recogniser, which may send audio to Google, and Telugu needs the Telugu language pack. | Voice may not work, or works only online, on some phones. | A clear message is shown; typing always works. |
| 24 | The AI can be wrong. | Bad advice is possible. | Safety rules in the prompt, local crisis and emergency checks, and a "not medical advice" note on screen. |
| 25 | Steps need a source writing to Health Connect. Native phone step counting needs Android 14 with a recent Health Connect system update; some phones (for example some HyperOS builds) may not have it yet. | Steps stay at 0 after connecting. | Install a free step app that shares with Health Connect (Google Fit, Fitbit or Mi Fitness), or type steps in. |
| 26 | Steps sync only when the app is opened (no background sync). | Home shows the last synced number until the app opens. | Sync runs automatically on opening Home; background sync can be added later. |
| 27 | Unusual-looking steps are flagged but not removed. | A shaken phone can still inflate a day. | The warning tells the user; the day can be corrected by typing in the right number. |
| 28 | Open Food Facts has fewer Indian products than European ones, and some entries are incomplete. | Many scans lead to typing values from the pack. | Values are saved, so each product only needs typing once. |
| 29 | Food-photo calories are AI estimates; hidden oil and portion size are hard to see, and mixed dishes can be misidentified. | Errors of 20–50 % are possible. | A confidence banner, editable portions and removable items; logging from the food list is more accurate. |
| 30 | Food photos use the same free Gemini allowance as the coach chat. | Many photos in a day can hit the free limit. | A clear error, after which you log from the list. |
