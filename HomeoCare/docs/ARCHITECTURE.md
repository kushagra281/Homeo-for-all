# HomeoWell — Complete Refactor Guide
# Architecture, Migration Plan, and Indexing Strategy

## ══════════════════════════════════════════════════════
## 1. FINAL ARCHITECTURE DIAGRAM
## ══════════════════════════════════════════════════════

```
USER INPUT (symptoms + health profile)
           │
           ▼
┌─────────────────────────────────────────────────────┐
│                   routes.ts (HTTP layer)             │
│  POST /api/remedies/score                           │
│  → validates input, calls processCase()             │
└─────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│         REPERTORY ENGINE (orchestrator)              │
│         server/engine/repertory-engine.ts           │
│                                                     │
│  Step 1: AI Module                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │  server/ai/rubric-mapper.ts                 │   │
│  │  • Groq maps symptom strings → rubric codes │   │
│  │  • Keyword fallback (no AI needed)          │   │
│  │  • NEVER suggests remedies                  │   │
│  │  • Returns: RubricMatch[] with confidence   │   │
│  └─────────────────────────────────────────────┘   │
│           │                                         │
│  Step 2: Data Access Layer                          │
│  ┌─────────────────────────────────────────────┐   │
│  │  server/dal/supabase-dal.ts                 │   │
│  │  • getRubricsByCodes()                      │   │
│  │  • getRemediesForRubrics()                  │   │
│  │  • searchLegacySymptoms() (fallback)        │   │
│  │  • ALL Supabase queries centralised here    │   │
│  └─────────────────────────────────────────────┘   │
│           │                                         │
│  Step 3: Scoring Engine                             │
│  ┌─────────────────────────────────────────────┐   │
│  │  server/engine/scoring-engine.ts            │   │
│  │  • Mental rubrics × weight 3                │   │
│  │  • General rubrics × weight 2               │   │
│  │  • Particular rubrics × weight 1            │   │
│  │  • Grade 1-4 multiplier (Kent scale)        │   │
│  │  • Negative symptom elimination             │   │
│  │  • No double-counting                       │   │
│  │  • Confidence score (rubric coverage %)     │   │
│  │  • Why explanation builder                  │   │
│  │  • Safety flags (age/cardiac/kidney)        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
           │
           ▼
    ScoredRemedy[] {
      score, confidence,
      covered_rubrics[],
      why_explanation,
      safety_flags[],
      ai_insight
    }
```

## ══════════════════════════════════════════════════════
## 2. FOLDER STRUCTURE
## ══════════════════════════════════════════════════════

```
HomeoCare/
├── server/
│   ├── index.ts                    (unchanged — Express setup)
│   ├── routes.ts                   ← REPLACE with new version
│   ├── storage.ts                  (unchanged — fallback only)
│   ├── vite.ts                     (unchanged)
│   │
│   ├── engine/
│   │   ├── repertory-engine.ts     ← NEW: orchestrator
│   │   └── scoring-engine.ts       ← NEW: weighted scoring
│   │
│   ├── ai/
│   │   └── rubric-mapper.ts        ← NEW: AI restricted to rubric mapping
│   │
│   └── dal/
│       └── supabase-dal.ts         ← NEW: all DB queries here
│
├── shared/
│   ├── schema.ts                   (keep existing)
│   └── types.ts                    ← NEW: shared interfaces
│
└── client/src/
    ├── components/
    │   └── remedy-scorer.tsx        ← UPDATE: show confidence + rubrics + flags
    └── ...
```

## ══════════════════════════════════════════════════════
## 3. STEP-BY-STEP MIGRATION PLAN
## ══════════════════════════════════════════════════════

### PHASE 1 — Database (Day 1, ~30 min)
Run supabase_schema.sql in Supabase SQL Editor.
This creates: rubrics, rubric_remedies tables with seed data.
Existing tables (symptoms, remedy_symptoms, patients, search_history) are UNTOUCHED.

### PHASE 2 — Server modules (Day 1, ~1 hour)
Copy these 4 new files into your project:
  server/engine/repertory-engine.ts
  server/engine/scoring-engine.ts
  server/ai/rubric-mapper.ts
  server/dal/supabase-dal.ts
  shared/types.ts

Replace:
  server/routes.ts (new clean version)

DO NOT change:
  server/storage.ts  — still used as last-resort fallback
  server/index.ts    — no changes needed
  client/ files      — no changes needed yet

### PHASE 3 — Test (Day 1, ~30 min)
Deploy to Render. Test these cases:

Test 1: Search "anxiety worse at night, restless, fear"
Expected: Arsenicum Album #1 (grade 3 in MIND.ANXIETY.NIGHT + MIND.RESTLESS)

Test 2: Search "joint pain stiff morning, better movement"
Expected: Rhus Toxicodendron #1 (grade 3 in EXT.STIFF.MORNING + GEN.BETTER.MOTION)

Test 3: Search "throbbing headache worse motion"
Expected: Belladonna or Bryonia #1

Check Render logs for:
  [Engine] Total rubric matches: X
  [Engine] Rubric-based: X results

### PHASE 4 — Expand rubrics table (Ongoing)
The seed data covers ~30 rubrics. To improve results, add more:

Option A: Manual SQL inserts as you identify missing rubrics
Option B: Run a script to import from boericke_repertory.json:

The boericke_repertory.json structure is:
  { "HEAD": { "pain": ["Belladonna", "Bryonia"] } }

Convert to rubric_remedies rows like:
  INSERT INTO rubric_remedies (rubric_code, remedy_name, grade, source)
  VALUES ('HEAD.PAIN', 'Belladonna', 3, 'boericke');

### PHASE 5 — Frontend updates (Day 2, ~1 hour)
Update remedy-scorer.tsx to display new fields:
- confidence score badge (e.g. "87% confident")
- why_explanation text
- covered_rubrics list (expandable)
- safety_flags (color-coded warning badges)

## ══════════════════════════════════════════════════════
## 4. AI USAGE POLICY (enforced in code)
## ══════════════════════════════════════════════════════

AI (Groq) is ALLOWED to:
  ✅ Map symptom strings → rubric codes
  ✅ Estimate confidence of each mapping
  ✅ Identify negative symptoms (is_eliminating=true)
  ✅ Analyze uploaded medical report images

AI is FORBIDDEN from:
  ❌ Suggesting remedy names
  ❌ Ranking or ordering remedies
  ❌ Overriding scoring engine output
  ❌ Generating dosage recommendations

Enforcement: rubric-mapper.ts validates every AI response against
KNOWN_RUBRIC_CODES whitelist. Any remedy name in AI output is rejected.

## ══════════════════════════════════════════════════════
## 5. INDEXING STRATEGY
## ══════════════════════════════════════════════════════

Already in schema.sql:
  idx_rubrics_body_system   — fast filter by body system
  idx_rubric_remedies_code  — fast lookup remedies by rubric
  idx_rubric_remedies_grade — fast sort by grade
  idx_rubrics_fts           — full-text search on rubric labels

Additional indexes to add as data grows:
  CREATE INDEX idx_symptoms_remedy   ON symptoms(remedy);
  CREATE INDEX idx_symptoms_category ON symptoms(category);
  CREATE INDEX idx_rem_sym_name      ON remedy_symptoms(remedy_name);

## ══════════════════════════════════════════════════════
## 6. CACHING STRATEGY
## ══════════════════════════════════════════════════════

In-memory cache for rubric lookups (add to repertory-engine.ts):

  const rubricCache = new Map<string, Rubric[]>();

  async function getCachedRubrics(codes: string[]): Promise<Rubric[]> {
    const key = codes.sort().join(",");
    if (rubricCache.has(key)) return rubricCache.get(key)!;
    const rubrics = await getRubricsByCodes(codes);
    rubricCache.set(key, rubrics);
    return rubrics;
  }

Rubric data is static — safe to cache indefinitely per process.
Remedy details can be cached with 1-hour TTL.
Patient profiles: never cache (always fresh from DB).

## ══════════════════════════════════════════════════════
## 7. SCORING EXAMPLE (so you can verify it works)
## ══════════════════════════════════════════════════════

Patient: "anxiety at night, restless, cold makes it worse"

Rubrics matched:
  MIND.ANXIETY.NIGHT  (mental, weight=3)
  MIND.RESTLESS       (mental, weight=3)
  GEN.WORSE.COLD      (general, weight=2)

Remedy scoring:

  Arsenicum Album:
    MIND.ANXIETY.NIGHT × grade 3 × weight 3 = 9
    MIND.RESTLESS      × grade 3 × weight 3 = 9
    GEN.WORSE.COLD     × grade 3 × weight 2 = 6
    TOTAL = 24  ← normalises to 100

  Aconite:
    MIND.ANXIETY.NIGHT × grade 2 × weight 3 = 6
    MIND.RESTLESS      × grade 3 × weight 3 = 9
    GEN.WORSE.COLD     × NOT IN rubric       = 0
    TOTAL = 15  ← normalises to 63

  Phosphorus:
    MIND.ANXIETY       × grade 2 × weight 3 = 6
    MIND.RESTLESS      × NOT IN rubric       = 0
    TOTAL = 6   ← normalises to 25

Result: Arsenicum Album = 100, Aconite = 63, Phosphorus = 25
This matches classical homeopathic repertorisation exactly.
