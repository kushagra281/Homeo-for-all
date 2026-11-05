// POTENCY SUGGESTION — a general, case-based starting point written with each result.
//
// It does NOT come from the remedy data (that has no potencies) and it is not a prescription.
// It follows the common first-aid / self-care convention of low-to-medium potencies, short courses and
// "stop when better", and it leaves chronic, child, elderly and heart/kidney cases to a homeopath.
// The same suggestion applies to every remedy in one result, because it depends on the case, not the remedy.

export interface PotencySuggestion {
  /** "30C", "6C or 30C", or "" when no number is suggested. */
  potency: string;
  repeat: string;
  stop: string;
  caution: string;
  basis: "acute" | "chronic" | "child" | "senior" | "infant" | "red-flag";
}

export interface PotencyInput {
  symptoms: Array<string | undefined | null>;
  history?: string;
  age?: unknown;
  heartOrKidney?: boolean;
  redFlags?: boolean;
}

// How long the problem has lasted: months or years, or words that say it keeps returning.
const CHRONIC = /\b(\d+|several|few|many)\s*(months?|years?|yrs?)\b|\bchronic\b|\brecurr|\brelaps|\blong[- ]?standing\b|\bsince (?:childhood|birth|years|long)\b|\bevery (?:month|winter|summer|season|year)\b|\bfor (?:months|years|ages)\b|\bpurana\b|\bsaalon\b/i;

function ageOf(a: unknown): number | null {
  const n = typeof a === "number" ? a : typeof a === "string" && a.trim() !== "" ? Number(a) : NaN;
  return Number.isFinite(n) && n > 0 && n < 120 ? n : null;
}

const STOP = "Stop as soon as the symptoms clearly improve. If nothing changes in 2-3 days, or it gets worse, stop and consult a qualified homeopath.";

export function suggestPotency(input: PotencyInput): PotencySuggestion {
  const base = "General guidance, not a prescription. A qualified homeopath should confirm the remedy and potency.";
  if (input.redFlags) {
    return { potency: "", repeat: "", stop: "", basis: "red-flag",
      caution: "Warning signs were found in this case. See a doctor first; do not self-treat with a remedy until then." };
  }
  const age = ageOf(input.age);
  if (age !== null && age < 2) {
    return { potency: "", repeat: "", stop: "", basis: "infant",
      caution: "For a baby or toddler the remedy and potency must be chosen by a paediatrician or qualified homeopath." };
  }
  const text = [...input.symptoms, input.history].filter((t): t is string => typeof t === "string").join(" . ");
  const careful = input.heartOrKidney ? " A heart or kidney condition is on record, so check with your doctor or homeopath before starting." : "";

  if (age !== null && age < 12) {
    return { potency: "6C or 30C", repeat: "2 pellets, once or twice a day for acute complaints", stop: STOP, basis: "child",
      caution: `Child: ask a qualified homeopath to confirm the potency. ${base}${careful}` };
  }
  if (age !== null && age > 70) {
    return { potency: "6C or 30C", repeat: "3 pellets, once or twice a day for acute complaints", stop: STOP, basis: "senior",
      caution: `Older adult: start low. ${base}${careful}` };
  }
  if (CHRONIC.test(text)) {
    return { potency: "30C", repeat: "3 pellets once a day for up to 2 weeks, then review", stop: STOP, basis: "chronic",
      caution: `Long-standing problems need individual (constitutional) prescribing; a homeopath may choose a different or higher potency. ${base}${careful}` };
  }
  return { potency: "30C", repeat: "3 pellets, 2-3 times a day (every 4-6 hours)", stop: STOP, basis: "acute", caution: `${base}${careful}` };
}

/** One line for places that show a single string (PDF report). */
export function potencyLine(s: PotencySuggestion): string {
  return s.potency ? `${s.potency} - ${s.repeat}. ${s.stop}` : s.caution;
}
