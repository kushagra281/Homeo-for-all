// shared/types.ts
// Single source of truth for all types across server modules

// ── Repertory types ─────────────────────────────────────────────
export interface Rubric {
  code: string;           // "MIND.ANXIETY.NIGHT"
  label: string;          // "Anxiety at night"
  parent_code: string | null;
  body_system: string;
  depth: number;          // 0=root 1=section 2=rubric 3=sub-rubric
  symptom_type: "mental" | "general" | "particular";
  weight: number;         // mental=3, general=2, particular=1
  is_negative: boolean;
}

export interface RubricRemedy {
  rubric_code: string;
  remedy_name: string;
  grade: 1 | 2 | 3 | 4;  // Kent grade: 1=plain 2=italic 3=bold 4=bold+italic
  source: string;
}

// ── Case input ──────────────────────────────────────────────────
export interface CaseInput {
  symptoms: string[];          // raw user input strings
  filters: CaseFilters;
  healthProfile?: HealthProfile;
}

export interface CaseFilters {
  age_group?: string;
  gender?: string;
  condition_type?: string;
  symptom_location?: string;
  category?: string;
  potency?: string;
}

// ── Rubric match (AI output → engine input) ─────────────────────
export interface RubricMatch {
  rubric_code: string;
  label: string;
  confidence: number;     // 0.0-1.0 — how sure AI is about this match
  original_symptom: string;
  is_eliminating: boolean;
}

// ── Scoring types ───────────────────────────────────────────────
export interface RemedyScoreEntry {
  remedy_name: string;
  total_score: number;
  weighted_score: number;
  grade_sum: number;
  rubric_count: number;
  covered_rubrics: CoveredRubric[];
  eliminated: boolean;
  elimination_reason?: string;
}

export interface CoveredRubric {
  rubric_code: string;
  label: string;
  grade: number;
  weight: number;         // rubric weight (mental=3 etc.)
  contribution: number;   // grade × weight
}

// ── Final result returned to frontend ───────────────────────────
export interface ScoredRemedy {
  remedy: RemedyDetail;
  score: number;          // 0-100 normalised
  confidence: number;     // 0-100 based on rubric coverage
  matching_symptoms: string[];
  covered_rubrics: CoveredRubric[];
  ai_insight?: string;
  why_explanation: string;
  alternatives: string[];
  safety_flags: SafetyFlag[];
}

export interface RemedyDetail {
  id: string;
  name: string;
  abbreviation?: string;
  category: string;
  condition: string;
  description: string;
  dosage: string;
  potencies: string[];
  modalities: { better: string[]; worse: string[] };
  kingdom?: string;
  miasm?: string;
}

export interface SafetyFlag {
  level: "info" | "warning" | "danger";
  message: string;
}

// ── Health profile ───────────────────────────────────────────────
export interface HealthProfile {
  name?: string;
  age?: number;
  gender?: string;
  blood_group?: string;
  weight_kg?: number;
  height_cm?: number;
  diabetes?: string;
  blood_pressure?: string;
  obesity?: string;
  cholesterol?: string;
  thyroid?: string;
  asthma?: string;
  allergy?: string;
  gastritis?: string;
  constipation?: string;
  pcod?: string;
  arthritis?: string;
  kidney?: string;
  heart_disease?: string;
  migraine?: string;
  skin_condition?: string;
  depression_anxiety?: string;
  hair_fall?: string;
  injury_history?: string;
  other_conditions?: string;
  chronic_conditions?: string;
  current_medications?: string;
  dietary_preference?: string;
}
