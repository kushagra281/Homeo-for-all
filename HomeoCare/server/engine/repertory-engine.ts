// server/engine/repertory-engine.ts
// REPERTORY ENGINE — Orchestrator
// Ties together: AI module → DAL → Scoring Engine → Safety Layer
// This is the single entry point called by routes.ts

import type {
  CaseInput,
  ScoredRemedy,
  RubricMatch,
  HealthProfile,
} from "../../shared/types";

import {
  mapSymptomsToRubrics,
  mapSymptomsToRubricsKeyword,
} from "../ai/rubric-mapper";

import {
  getRubricsByCodes,
  getRemediesForRubrics,
  getRemedyDetails,
  searchLegacySymptoms,
  searchLegacyRemedySymptoms,
} from "../dal/supabase-dal";

import {
  scoreRemedies,
  normaliseScores,
  calculateConfidence,
  buildExplanation,
  buildSafetyFlags,
} from "./scoring-engine";

// ── MAIN PIPELINE ────────────────────────────────────────────────

export async function processCase(input: CaseInput): Promise<ScoredRemedy[]> {
  const { symptoms, filters, healthProfile } = input;

  const cleanSymptoms = symptoms
    .map((s) => s.toLowerCase().trim())
    .filter(
      (s) =>
        s.length > 2 &&
        !s.startsWith("category:") &&
        !s.startsWith("age:") &&
        !s.startsWith("gender:") &&
        !s.startsWith("disease duration:")
    );

  if (!cleanSymptoms.length) return [];

  const bodySystem =
    filters.symptom_location || filters.category || undefined;

  console.log(
    `[Engine] Processing case: ${cleanSymptoms.length} symptoms, system=${bodySystem || "any"}`
  );

  // ── STEP 1: AI maps symptoms to rubric codes ─────────────────
  let rubricMatches: RubricMatch[] = [];

  try {
    rubricMatches = await mapSymptomsToRubrics(
      cleanSymptoms,
      bodySystem,
      healthProfile
    );
  } catch (e) {
    console.warn("[Engine] AI rubric mapping failed, using keyword fallback");
  }

  // Keyword fallback: merge with AI results (deduplication by rubric code)
  const keywordMatches = mapSymptomsToRubricsKeyword(cleanSymptoms);
  const seenCodes = new Set(rubricMatches.map((m) => m.rubric_code));
  for (const km of keywordMatches) {
    if (!seenCodes.has(km.rubric_code)) {
      rubricMatches.push(km);
      seenCodes.add(km.rubric_code);
    }
  }

  console.log(`[Engine] Total rubric matches: ${rubricMatches.length}`);

  // ── STEP 2: Try rubric-based scoring first ───────────────────
  if (rubricMatches.length > 0) {
    const rubricResult = await rubricBasedScoring(
      rubricMatches,
      healthProfile,
      symptoms
    );
    if (rubricResult.length >= 3) {
      console.log(
        `[Engine] Rubric-based: ${rubricResult.length} results, top=${rubricResult[0]?.remedy.name}`
      );
      return rubricResult;
    }
    console.log(
      `[Engine] Rubric-based returned ${rubricResult.length} — falling back to legacy`
    );
  }

  // ── STEP 3: Legacy symptom table fallback ────────────────────
  // Used while rubrics table is being populated
  const legacyResult = await legacyScoring(
    cleanSymptoms,
    bodySystem,
    rubricMatches,
    healthProfile,
    symptoms
  );

  console.log(
    `[Engine] Legacy: ${legacyResult.length} results, top=${legacyResult[0]?.remedy.name}`
  );
  return legacyResult;
}

// ── RUBRIC-BASED SCORING PIPELINE ───────────────────────────────

async function rubricBasedScoring(
  rubricMatches: RubricMatch[],
  healthProfile: HealthProfile | undefined,
  originalSymptoms: string[]
): Promise<ScoredRemedy[]> {
  const rubricCodes = rubricMatches.map((m) => m.rubric_code);

  // Fetch rubric details and remedy-rubric mappings in parallel
  const [rubrics, rubricRemedies] = await Promise.all([
    getRubricsByCodes(rubricCodes),
    getRemediesForRubrics(rubricCodes),
  ]);

  if (!rubricRemedies.length) return [];

  // Run scoring engine
  const { scores, totalRubrics, eliminatedCount } = scoreRemedies({
    rubricMatches,
    rubrics,
    rubricRemedies,
  });

  if (!scores.length) return [];

  console.log(
    `[Engine] Scored ${scores.length} remedies, eliminated ${eliminatedCount}`
  );

  // Normalise scores
  const normalised = normaliseScores(scores);

  // Fetch remedy metadata for top 10
  const topNames = normalised.slice(0, 10).map((s) => s.remedy_name);
  const remedyDetails = await getRemedyDetails(topNames);
  const detailMap = new Map(remedyDetails.map((d) => [d.name, d]));

  // Build final output
  return normalised.slice(0, 10).map((entry) => {
    const normalizedScore = entry.weighted_score;
    const confidence = calculateConfidence(entry, totalRubrics);
    const explanation = buildExplanation(entry, normalizedScore);
    const safetyFlags = buildSafetyFlags(entry.remedy_name, healthProfile);

    const detail = detailMap.get(entry.remedy_name) || {
      id: entry.remedy_name.toLowerCase().replace(/\s+/g, "-"),
      name: entry.remedy_name,
      category: "General",
      condition: entry.covered_rubrics.slice(0, 2).map((r) => r.label).join("; "),
      description: explanation,
      dosage: gradeToDosage(entry.grade_sum / Math.max(entry.rubric_count, 1)),
      potencies: ["6C", "30C", "200C"],
      modalities: { better: [], worse: [] },
    };

    // Set dosage based on average grade
    const avgGrade = entry.grade_sum / Math.max(entry.rubric_count, 1);
    detail.dosage = gradeToDosage(avgGrade);

    return {
      remedy: detail,
      score: normalizedScore,
      confidence,
      matching_symptoms: entry.covered_rubrics.map((r) => r.label).slice(0, 5),
      covered_rubrics: entry.covered_rubrics,
      why_explanation: explanation,
      alternatives: [],
      safety_flags: safetyFlags,
    };
  });
}

// ── LEGACY SCORING (fallback) ────────────────────────────────────
// Scores using old symptoms + remedy_symptoms tables
// Uses intensity column as grade equivalent

async function legacyScoring(
  searchTerms: string[],
  category: string | undefined,
  rubricMatches: RubricMatch[],
  healthProfile: HealthProfile | undefined,
  originalSymptoms: string[]
): Promise<ScoredRemedy[]> {
  const [symptomsRows, remedySymptomRows] = await Promise.all([
    searchLegacySymptoms(searchTerms, category),
    searchLegacyRemedySymptoms(searchTerms, category),
  ]);

  if (!symptomsRows.length && !remedySymptomRows.length) return [];

  // Score from symptoms table using intensity as weight
  const scoreMap = new Map<
    string,
    { total: number; count: number; matched: string[]; cats: Set<string> }
  >();

  for (const row of symptomsRows) {
    const name = row.remedy;
    if (!name) continue;
    const termMatches = searchTerms.filter((t) =>
      row.symptom?.toLowerCase().includes(t)
    ).length;
    if (!termMatches) continue;
    const intensity = row.intensity || 1;
    if (!scoreMap.has(name)) {
      scoreMap.set(name, { total: 0, count: 0, matched: [], cats: new Set() });
    }
    const e = scoreMap.get(name)!;
    e.total += termMatches * intensity;
    e.count += 1;
    e.matched.push(row.symptom);
    e.cats.add(row.category || "");
  }

  // Merge remedy_symptoms rows
  for (const row of remedySymptomRows) {
    const name = row.remedy_name;
    if (!name) continue;
    const termMatches = searchTerms.filter(
      (t) =>
        row.symptom?.toLowerCase().includes(t) ||
        row.heading?.toLowerCase().includes(t)
    ).length;
    if (!termMatches) continue;
    if (!scoreMap.has(name)) {
      scoreMap.set(name, { total: 0, count: 0, matched: [], cats: new Set() });
    }
    const e = scoreMap.get(name)!;
    e.total += termMatches * 3; // remedy_symptoms treated as grade 3
    e.count += 1;
    e.matched.push(row.symptom);
    e.cats.add(row.heading || "");
  }

  if (!scoreMap.size) return [];

  // Normalise
  const entries = Array.from(scoreMap.entries()).sort(
    (a, b) => b[1].total - a[1].total
  );
  const maxScore = entries[0][1].total;

  // Get rubric labels for rubric-matched items (if any)
  const rubricLabelMap = new Map(rubricMatches.map((m) => [m.rubric_code, m.label]));

  return entries.slice(0, 10).map(([name, e]) => {
    const pct = Math.round((e.total / maxScore) * 100);
    const avgGrade = e.total / Math.max(e.count, 1);
    const safetyFlags = buildSafetyFlags(name, healthProfile);
    const matchedUniq = [...new Set(e.matched)].slice(0, 5);
    const cats = [...e.cats].filter(Boolean).join(", ");
    const explanation = `${name} matches ${e.count} symptom(s). Score: ${pct}/100.`;

    return {
      remedy: {
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name: toTitleCase(name),
        category: cats || category || "General",
        condition: matchedUniq.slice(0, 2).join("; "),
        description: explanation,
        dosage: gradeToDosage(avgGrade),
        potencies: ["6C", "30C", "200C"],
        modalities: { better: [], worse: [] },
      },
      score: pct,
      confidence: Math.min(100, e.count * 10),
      matching_symptoms: matchedUniq,
      covered_rubrics: [],
      why_explanation: explanation,
      alternatives: [],
      safety_flags: safetyFlags,
    };
  });
}

// ── HELPERS ──────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function gradeToDosage(avgGrade: number): string {
  if (avgGrade >= 3)
    return "200C — 3 pellets twice daily for 3 days, then once weekly";
  if (avgGrade >= 2)
    return "30C — 3 pellets three times daily for 5 days";
  return "6C — 3 pellets four times daily for 7 days";
}
