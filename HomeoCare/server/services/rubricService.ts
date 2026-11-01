// server/services/rubricService.ts
// Shape of a matched rubric as the scoring engine consumes it.
// (The old Groq-based symptom -> rubric-code mapper and its hard-coded code whitelist were removed:
// nothing called them since search moved to keyword matching against the real rubric table.)

export interface RubricMatch {
  rubric_code:      string;
  label:            string;
  confidence:       number;   // 0.0-1.0
  original_symptom: string;
  is_eliminating:   boolean;  // true = patient denies this symptom
}
