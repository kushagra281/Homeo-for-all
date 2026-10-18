# HomeoCare - how it works

## Overview
React (Vite) front end + Express API. Symptom search reads a scraped materia medica stored in
Supabase. This file describes the code as it is now.

```
client/src/pages/home.tsx          landing page, category + free-text entry
client/src/components/remedy-scorer.tsx   questionnaire, results, history  (calls POST /api/remedies/score)
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
server/storage.ts                  in-memory remedy list used only by the browse/dictionary pages
```

## Search pipeline (`POST /api/remedies/score`)
1. `extractKeywords` turns the symptoms into keyword groups (variants + old Boericke/Kent vocabulary)
   and modalities ("worse at night"). Negated words ("no thirst") are dropped.
2. `searchScraperRubrics` finds matching rubrics in the scraper database and ranks them by how many
   keywords they contain (Kent lecture prose counts for less than a precise Boericke line).
3. `getRemediesForRubricIds` loads the remedies of those rubrics; `scoreRemedies` ranks them.
4. If nothing is found it falls back to `remedy_symptoms`, then to the legacy `symptoms` table.
5. If every query failed (database paused, wrong key) the route answers with an error - it does
   not pretend there are no results.

## Data
Two Supabase projects:
- **main** (`SUPABASE_URL`): `patients`, `search_history`, legacy `symptoms`.
- **scraper** (`SCRAPER_SUPABASE_URL` / `SCRAPER_SUPABASE_KEY`): `remedies`, `remedy_sections`,
  `remedy_symptoms`, `rubrics`, `rubric_remedies`. Built by the `materia-medica-scraper` repo from
  Boericke's and Kent's Materia Medica. These are materia medica texts, not a repertory: they carry
  **no grades, potencies or doses** (every rubric link is grade 1).

Environment variables: see `.env.example`. `/api/health` shows which ones are set.

## What the data does not contain (and the app therefore does not show)
Potency, dose, age/gender suitability. Those fields are empty rather than invented.

## Tests
`npm test` - keyword extraction, the search pipeline (against a fake database), security
(auth + rate limits). `npm run check` - TypeScript.
