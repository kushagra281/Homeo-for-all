// server/utils/sections.ts
// Maps the category labels shown in the UI (client/src/pages/home.tsx) to patterns
// that are matched (ILIKE) against the `section` column of rubrics and the
// `heading` column of remedy_symptoms.
//
// The old code used the raw UI label, e.g. ILIKE '%Hands, Legs & Back%', which can
// never match a real section name. Several patterns per category are tried instead.
// Categories that are not body sections (Others, Clinical, …) apply no filter.

const MAP: Record<string, string[]> = {
  "mind":               ["mind"],
  "head":               ["head", "vertigo"],
  "eye":                ["eye", "vision"],
  "ear":                ["ear", "hearing"],
  "nose":               ["nose"],
  "face":               ["face"],
  "mouth":              ["mouth"],
  "tongue":             ["tongue", "mouth"],
  "taste":              ["taste", "mouth"],
  "gums":               ["gum", "mouth"],
  "teeth":              ["teeth", "tooth"],
  "throat":             ["throat"],
  "stomach":            ["stomach"],
  "abdomen":            ["abdomen"],
  "urinary system":     ["urin", "bladder", "kidney"],
  "male genitalia":     ["male", "genital"],
  "female genitalia":   ["female", "genital"],
  "heart":              ["heart", "chest"],
  "hands, legs & back": ["extremit", "back", "limb"],
  "respiration":        ["respirat", "cough", "chest", "larynx"],
  "skin":               ["skin"],
  "fever":              ["fever", "chill"],
  "nervous system":     ["nerv", "generalit"],
};

const NO_FILTER = new Set(["others", "other", "clinical", "general", "any", ""]);

/** Section patterns for a UI category, or undefined when no section filter should be applied. */
export function sectionPatterns(category?: string): string[] | undefined {
  const c = (category || "").toLowerCase().trim();
  if (NO_FILTER.has(c)) return undefined;
  if (MAP[c]) return MAP[c];
  const safe = c.replace(/[^a-z ]/g, "").trim();
  return safe ? [safe] : undefined;
}
