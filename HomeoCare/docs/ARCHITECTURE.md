# HomeoCare - how it works

## Overview
React (Vite) front end + Express API. Symptom search reads a scraped materia medica stored in
Supabase. This file describes the code as it is now.

```
client/src/pages/home.tsx          landing page, category + free-text entry
client/src/components/remedy-scorer.tsx   questionnaire, results, history  (calls POST /api/remedies/score)
client/src/lib/report.ts, downloadReport.ts, shared/reportFile.ts   PDF report (built in the browser, jsPDF loaded on click): patient name, file name
                                    "homeocare-report-<date> <name>.pdf", "PDF Report" button on the results page, download icon on each History entry
shared/elements.ts                  element tags on result cards: periodic-table row = series, column = stage (names only, no meaning text)
client/src/components/nav-drawer.tsx      the menu: Home, History, Profile, Privacy, Terms, Sign in/out
client/src/pages/auth-page.tsx, reset-password.tsx   sign in / sign up / forgot password (Supabase Auth)
client/src/pages/legal.tsx         /privacy and /terms (set CONTACT_EMAIL there to show a contact line)
        |
server/routes/remedies.ts          HTTP layer: /score, /analyze-report, browse routes   (rate limited)
server/routes/profile.ts           /api/profile/me | save | history       (needs a signed-in user)
        |
server/services/searchService.ts   the search pipeline (below)
server/services/scoringService.ts  scores remedies from rubric rows
server/utils/keywords.ts           patient text -> keyword groups (stemming, synonyms, worse/better, negation)
server/utils/layPhrases.ts          everyday phrases -> the repertory's wording ("cannot bear movement" -> "motion agg."), applied before keywords
server/utils/sections.ts           UI category -> section-name patterns
server/utils/supabase.ts           all database access, ranking, caching
server/utils/auth.ts, rateLimit.ts verified user id, per-IP limits
server/websocket.ts                community chat at /ws/chat
```

## Search pipeline (`POST /api/remedies/score`)
1. `extractKeywords` turns the symptoms into keyword groups (variants + old Boericke/Kent vocabulary)
   and modalities ("worse at night"). Negated words ("no thirst") are dropped. Before the words are taken, each clause goes
   through `rewriteLay` (`layPhrases.ts`): an everyday phrase that has a standard repertory wording is rewritten to it
   ("short tempered" -> irritability, "burning when I pee" -> urination burning, "cannot lie still" -> restlessness).
2. `searchScraperRubrics` finds matching rubrics in the scraper database and ranks them by how many
   keywords they contain (Kent lecture prose counts for less than a precise Boericke line).
3. `getRemediesForRubricIds` loads the remedies of those rubrics; `scoreRemedies` ranks them.
4. If nothing is found it falls back to `remedy_symptoms`. If that finds nothing either, the result is empty (or an error if a database call failed). The generated `symptoms` table in the main project is deliberately not read.
5. If every query failed (database paused, wrong key) the route answers with an error - it does
   not pretend there are no results.

What the patient typed, what the questions added, and the general symptoms (graded repertory): the request lists every symptom in
`symptoms` and names the question phrases again in `answers` (complaint questions) and `generals` (the general bank: chilly,
thirst, sleep...). The server takes them out of the list again (`splitGenerals`), so the rest is what the patient typed. The typed
words count fully; answers and generals count 0.3 each (`answerWeight`, `generalWeight`), because one answer becomes several
broad phrases ("Fear" -> fear, anxiety, dread) that used to out-vote the patient's own specific words ("fear of heights").
The category the patient picked is a preference, not a wall: rubrics outside its chapter still count 0.75 and rank a little
lower (`outsideChapter`). If nothing was typed the answers count fully. Without `answers`/`generals` (older apps) everything
is typed. Chosen with the patient simulator (66 patients x 5 runs, top 5): typical patients 113/330 with a strict filter and equal
weights, 137 after the soft category (#62), 172 with answers and generals at 0.3. Answers at weight 0 gave 173: with this
question bank the interview adds little beyond what the patient typed; it mainly must not do harm.

### Everyday words -> repertory words (`server/utils/layPhrases.ts`)
A patient writes "cannot bear any movement"; the repertory says "motion agg.". Word by word, "cannot", "bear" and "movement" land
on rubrics about cruelty and hurrying, so ~90 rules (plain data: [phrase pattern, repertory wording]) rewrite a clause BEFORE the keywords
are taken. Every target word was checked against the graded repertory's own vocabulary (Repertorium Publicum, 74,480 rubrics).
Rules fire only on a phrase with one clear meaning, never name a remedy or a diagnosis, are applied once top to bottom (negative
forms first: "cannot lie still" is restlessness, not "better at rest"), and never re-match another rule's output. The repertory's
own phrases ("damp weather", "loss of sleep", "sensitive to touch", "cold applications") are deliberately left alone.
Measured with the patient simulator (66 patients, top 5, offline, AI synonyms off), before -> after:

| | Direct (regression check) | Typed words only | Perfect patient | Typical patient (5 runs) |
|---|---|---|---|---|
| Set A (wording the rules were written against) | 51 -> 52 | 38 -> 45 | 37 -> 38 | 172 -> 192 of 330 |
| Held-out set B (same patients, different everyday words, written BEFORE the rules) | 51 -> 52 | 30 -> 39 | 36 -> 38 | 153 -> 165 of 330 |

Set B is the honest number: its wording was fixed before the dictionary existed, so the gain there is not tuning to the test.
`PERSONAS=heldout` runs it (`server/trials/personasHeldout.ts`). The simulator measures agreement with the textbook picture of
each remedy, not whether the remedy is right for a real patient. Tried and left out: dropping query words that no rubric contains
(neutral: B 165 -> 167 typical, perfect -1), and generalising modalities (no gain).

## Case-taking (the interview before the search)
Two layers, one flow (`client/src/components/remedy-scorer.tsx`):
- `client/src/lib/caseTaking.ts` is the built-in question bank. Topics are found from the typed words
  (mind, head, heart, hair, fever, stomach, ...); each topic has its own questions, and a GENERAL bank covers the whole patient
  (thermal, time of day, motion or rest, thirst, digestion, bowels, desires, sleep, sweat, energy). The Heart category (or
  words such as palpitations, chest pain, blood pressure; "heartburn" stays a stomach word) selects the heart topic,
  whose questions include a warning to see a doctor at once for chest pain with sweating, breathlessness or pain
  spreading to the arm or jaw. Every option carries search `phrases`; the phrases
  of the answers are what the keyword search receives, so an answer reaches the diagnosis.
- `server/services/aiCase.ts` (`/api/remedies/next-question`) lets the AI ask the next question. It asks at most
  `MAX_AI_QUESTIONS` (12), spends them on the complaint and its modalities first, and its prompt asks for the general
  areas before it may say "done". If the AI is off or fails, the built-in bank runs the whole interview.
- General top-up: when the AI says done, the app asks the required general questions that nothing answered so far has
  settled (`queueFor(state, { generalOnly: true })`, `generalLeft`). What the typed words, the built-in answers and the text of
  the AI's own questions already cover (`inferCovers`) is not asked again. This is code, not prompt, so a skipped area cannot
  slip through. Nine areas are required: temperature, time of day, motion or rest, thirst, digestion, bowels, desires,
  sleep and sweat. So the AI stops at 12 and nothing important is lost: whatever it did not reach is asked by the app.
  A topic question settles a general area only when it asks the same thing: a local modality ("worse from cold", "hot or cold
  drinks") does not settle "is the patient chilly or hot", and a question about when the complaint began does not settle the
  time of aggravation.
- Budget: `MAX_QUESTIONS` (20) is room for the whole interview, not only for topic questions. The required general
  questions still open are reserved a place in it (`nextQuestion`), they come before the optional general ones, and the AI
  stops asking once `answers + generalLeft >= MAX_QUESTIONS`. A long mind-led case therefore ends with all required areas
  covered and still within 20 questions.

## Do's and Don'ts (results page)
`client/src/lib/lifestyle.ts` holds everyday guidance per topic (hair, stomach, head, skin, ...), chosen from the typed
complaint (two topics at most are merged; nothing recognised gives a general list). The heart is a topic like the others
(palpitations, chest pain, blood pressure, or the Heart category); when two topics tie, the chosen category leads. When the AI explanation arrives it may
carry its own `lifestyle` lists written for the case; `cleanLifestyle` drops anything that names a medicine, supplement, herb, cream,
dose, cure, diagnosis or a ranked remedy, and keeps a "do" item only if it starts with a habit verb (Eat, Walk, Keep ...). It is a
filter, not a guarantee. The page uses the AI list per side only when at least two items survive. It is habits only,
never treatment, and the box says which of the two it is showing.

## Profile photo
`patients.avatar_url` (SQL in `docs/sql/2026-11-profile-photo.sql`) holds a small data URL, private to the user's row. The browser
shrinks the chosen picture to a 256 px square JPEG (`client/src/lib/avatar.ts`); `PUT/GET/DELETE /api/profile/avatar` store it for the
signed-in user only. The server re-checks it (`shared/avatar.ts`: JPEG, PNG or WebP by content, at most 80,000 characters, so SVG
and anything else is refused). `GET /api/profile/me` leaves the photo out to stay light. If the column does not exist yet the save
answers 503 `avatar_column_missing` (the page says storage is not set up) and the header just shows the person's initial. The photo
is shown beside Translate in every header (`components/user-avatar.tsx`) and changed on the Profile page.

## Data
Supabase projects (in production the users, history and the scraped data are in the same one,
`rtfjnfepikhahzospnqq`; `zlsinlcskirptxgqkzuw` is empty and unused):
- **main** (`SUPABASE_URL`): `patients`, `search_history`, and the saved repertory cases (`repertory_cases`, `repertory_case_visits`, see `docs/sql`).
- **scraper** (`SCRAPER_SUPABASE_URL` / `SCRAPER_SUPABASE_KEY`): `remedies`, `remedy_sections`,
  `remedy_symptoms`, `rubrics`, `rubric_remedies`. Built by the `materia-medica-scraper` repo from
  Boericke's and Kent's Materia Medica. These are materia medica texts and carry
  **no grades, potencies or doses** (every rubric link is grade 1). The graded repertory (Repertorium Publicum,
  `repertory_*` tables) is read by the Repertory pages and, when `REPERTORY_ENGINE` is `on` or `hybrid`, by the search.

Pages that exist but are not linked in the menu: `/repertory` (browse the graded repertory, saved cases; needs
`docs/sql/2026-11-repertory-cases.sql` for saved cases) and `/community` (anonymous chat, in-memory history).
History is read 20 rows at a time (`getSearchHistory(offset)`, "Load more" in the UI).
The PDF from History is shorter than the one on the results page: History saves only the complaints, the top three remedies with
their match % and a few matched symptoms, so case-taking answers, dosage and better/worse are not in it. A name written only in
Devanagari is not drawn in the PDF (built-in font is Latin only); it is still used in the file name.
`docs/sql/2026-11-db-cleanup.sql` drops two duplicate indexes and speeds up five RLS policies (run by hand in the SQL editor).
Password-reset links need the site's `/reset-password` URL in Supabase Auth > URL Configuration > Redirect URLs.

Environment variables: see `.env.example`. `/api/health` shows which ones are set.

## What the data does not contain (and the app therefore does not show)
Potency, dose, age/gender suitability are not in the data. The result card shows a general, case-based potency
suggestion (`shared/potency.ts`: acute, chronic, child, older adult; none when warning signs are present). It is
labelled as general guidance, not a prescription, and is the same for every remedy of one result.

## Trials (measuring the search)
- **Direct** (`server/trials/run.ts`, `npm run trials:offline` for the in-memory repertory): the textbook symptom words of 68
  classical cases go straight to the search. Shows how good the engine is when it is given ideal words.
- **Patient** (`server/trials/simulate.ts`, `npm run trials:patient`, or the Trials workflow with mode = patient): a simulated patient
  (`personas.ts`, 66 of the 68 cases) types everyday words, picks a category and answers the app's own built-in interview
  (`nextQuestion`, `searchRequest`: the same code the app runs); the request is built by `searchRequest`, which `submitToAI` also uses. Reported per case and in
  total: direct, typed words only (patient skips the interview), perfect patient (confirms every true fact) and typical patient
  (forgets a quarter of the facts, sometimes ticks a wrong box or skips; several seeded runs). Also lists true facts the interview
  never offered (gaps in the question bank).
  Offline: `REPERTORY_DUMP=<folder> npm run trials:patient` (graded repertory in memory, no database); `NO_CATEGORY=1` leaves out the
  category (no chapter filter), `RUNS=5`, `ONLY=<regex>`, `VERBOSE=1`, `PERSONAS=heldout` (the same patients in different everyday
  words, see layPhrases above) as in the file header.
  Limits: it simulates the built-in bank (the app's fallback), not the AI's own questions; the persona facts are written from the
  textbook picture of each remedy in the interview's vocabulary and must not be tuned to the engine's output; with ~60 cases a difference
  of a few cases is not proof. AI synonyms are off offline, so lay-word numbers are lower than in production.

## Tests
`npm test` - keyword extraction, the search pipeline (against a fake database), security
(auth + rate limits), the case-taking interview and its general top-up, the AI prompts and parsers, the Do's and Don'ts lists, the profile photo checks, bad request shapes and odd AI replies (`inputs.test.ts`), the community chat (`chat.test.ts`), the profile number ranges (`profileNumbers.test.ts`), and the patient simulator (personas, seeded noise, the interview it drives). `npm run check` - TypeScript.
