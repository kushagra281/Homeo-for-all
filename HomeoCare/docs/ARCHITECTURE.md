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
server/utils/sections.ts           UI category -> section-name patterns
server/utils/supabase.ts           all database access, ranking, caching
server/utils/auth.ts, rateLimit.ts verified user id, per-IP limits
server/websocket.ts                community chat at /ws/chat
```

## Search pipeline (`POST /api/remedies/score`)
1. `extractKeywords` turns the symptoms into keyword groups (variants + old Boericke/Kent vocabulary)
   and modalities ("worse at night"). Negated words ("no thirst") are dropped.
2. `searchScraperRubrics` finds matching rubrics in the scraper database and ranks them by how many
   keywords they contain (Kent lecture prose counts for less than a precise Boericke line).
3. `getRemediesForRubricIds` loads the remedies of those rubrics; `scoreRemedies` ranks them.
4. If nothing is found it falls back to `remedy_symptoms`. If that finds nothing either, the result is empty (or an error if a database call failed). The generated `symptoms` table in the main project is deliberately not read.
5. If every query failed (database paused, wrong key) the route answers with an error - it does
   not pretend there are no results.

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

## Tests
`npm test` - keyword extraction, the search pipeline (against a fake database), security
(auth + rate limits), the case-taking interview and its general top-up, the AI prompts and parsers, the Do's and Don'ts lists, and the profile photo checks. `npm run check` - TypeScript.
