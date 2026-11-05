import { canonicalRemedyName } from "./remedyAliases";
// server/utils/keywords.ts
// KEYWORD EXTRACTION — turns patient symptom text into searchable keyword groups.
//
// Fixes over the old inline logic in utils/supabase.ts:
//   • short body words (eye, ear, leg, arm, dry, gas…) are kept
//   • "worse" / "better" are no longer discarded: they become modalities that
//     are used when ranking results
//   • light stemming (coughing → cough, headaches → headache)
//   • each keyword is a GROUP of variants (stem + synonyms incl. the older
//     vocabulary used by Boericke, e.g. coryza, lachrymation, eructation) so a
//     rubric/symptom matching ANY variant counts once for that keyword
//   • simple negation: "no thirst" does not search for "thirst"
//   • no more arbitrary "first 10 terms" cut-off

export interface Variant {
  text: string;       // lowercase a-z and spaces only (safe inside PostgREST filters)
  wordStart: boolean; // true for very short words: match only at a word start
}

export interface KeywordGroup {
  key: string;        // stem, e.g. "cough"
  variants: Variant[];
}

export interface Modality {
  dir: "worse" | "better";
  key: string;        // stem of the modified word, e.g. "night"
}

export interface ExtractedKeywords {
  groups: KeywordGroup[];
  modalities: Modality[];
}

// ── Word lists ────────────────────────────────────────────────────
const STOP = new Set([
  "the","and","for","with","from","that","this","have","has","had","are","was","were","but","can","get","got",
  "when","after","before","during","while","into","over","some","very","also","been","being","because","since",
  "just","like","much","more","less","too","all","any","out","off","our","his","her","its","you","your","own",
  "then","than","them","they","there","here","what","which","who","why","how","upon","again","around","about",
  "near","only","even","ever","every","each","both","such","does","did","doing","would","could","should","may",
  "might","will","shall","must","not","nor","yet","per","via","onto","till","until","one","two","three",
  // filler used in patient statements
  "patient","complains","complaint","complaints","suffering","suffers","having","feels","feel","feeling","felt",
  "days","weeks","months","years","day","week","month","year","time","times","often","lately","sometimes",
  "left","right","side","sided","mild","moderate","severe","unbearable","none","nothing","something","anything",
  "specific","pattern","change","type","kind","lot","little","bit","really","also","still","always","never",
]);

const NEGATORS = new Set(["no", "not", "without", "denies", "absent", "lack", "lacks"]);

// Words that are too common to drive a database search on their own.
// They are kept as keywords but are ranked after more specific ones.
const GENERIC = new Set([
  "pain","painful","ache","aching","sensation","problem","problems","trouble","symptom","symptoms","condition",
  "feeling","general","body","sore",
]);

// Words ending in -ing/-s that must not be stemmed.
const NO_STEM = new Set([
  "morning","evening","during","nothing","something","anything","everything","string","spring","bring",
  "sting","thing","things","king","ring","wing","bleeding","sneezing",
  // stems that would match far too much text: water, hear(t), ring (bring, spring)
  "watering","hearing","ringing",
]);

// patient word (or stem) → extra variants. Includes the older medical
// vocabulary found in Boericke's 1901 text.
const SYNONYMS: Record<string, string[]> = {
  fever:        ["febrile", "pyrexia"],
  cough:        ["tussis", "expectoration"],
  headache:     ["cephalalgia", "cephalgia", "head pain", "migraine", "hemicrania"],
  migraine:     ["hemicrania", "sick headache"],
  anxiety:      ["anxi", "apprehension", "worry"],
  anxious:      ["anxi", "apprehension", "worry"],
  worry:        ["anxi", "apprehension"],
  fear:         ["fright", "terror", "dread"],
  restless:     ["tossing", "fidget"],
  burning:      ["smarting", "scalding"],
  itching:      ["pruritus"],
  itchy:        ["itch", "pruritus"],
  nausea:       ["nause", "sick feeling", "qualm"],
  nauseous:     ["nause", "nausea"],
  diarrhea:     ["diarrhoea", "loose stool", "watery stool"],
  diarrhoea:    ["diarrhea", "loose stool"],
  constipation: ["constipat", "hard stool", "stool hard"],
  vomiting:     ["retching", "emesis"],
  weakness:     ["weak", "debility", "prostration", "exhaustion", "lassitude"],
  weak:         ["weakness", "debility", "prostration"],
  tired:        ["weariness", "lassitude", "exhaustion", "fatigue"],
  tiredness:    ["weariness", "lassitude", "exhaustion", "fatigue"],
  fatigue:      ["weariness", "lassitude", "exhaustion"],
  swelling:     ["oedema", "dropsy", "puffy"],
  swollen:      ["swell", "oedema", "puffy"],
  thirst:       ["thirsty"],
  thirsty:      ["thirst"],
  cold:         ["chilly", "chilliness"],
  night:        ["nocturnal", "midnight"],
  morning:      ["on waking", "rising"],
  skin:         ["cutaneous"],
  rash:         ["eruption", "urticaria", "hives"],
  hives:        ["urticaria"],
  throat:       ["pharynx", "tonsil"],
  stomach:      ["gastric", "epigastr"],
  back:         ["lumbar", "spine", "sacral"],
  joint:        ["articular", "rheumat"],
  arthritis:    ["rheumat", "gouty"],
  chest:        ["thorax", "pectoral"],
  anger:        ["irritab", "angry", "rage"],
  angry:        ["anger", "irritab", "rage"],
  irritable:    ["irritab", "anger"],
  sad:          ["sadness", "melancholy", "depress"],
  depression:   ["depress", "sadness", "melancholy", "despond"],
  depressed:    ["depress", "sadness", "despond"],
  weeping:      ["weep", "tears"],
  crying:       ["weep", "tears"],
  sleeplessness:["insomnia", "wakeful", "sleepless"],
  insomnia:     ["sleepless", "wakeful", "sleeplessness"],
  dizzy:        ["vertigo", "giddy", "dizz"],
  dizziness:    ["vertigo", "giddiness", "dizz"],
  vertigo:      ["dizz", "giddiness"],
  runny:        ["coryza", "discharge"],
  watering:     ["lachrymation", "watery"],
  belching:     ["eructation"],
  burping:      ["eructation"],
  gas:          ["flatulence", "flatulent"],
  bloating:     ["distension", "flatulence", "fullness"],
  bloated:      ["distension", "flatulence", "fullness"],
  acidity:      ["heartburn", "sour", "waterbrash"],
  heartburn:    ["acid", "waterbrash"],
  urination:    ["urin", "micturition"],
  urine:        ["urin"],
  periods:      ["menses", "menstrual"],
  sweating:     ["perspiration"],
  sweat:        ["perspiration"],
  cramps:       ["spasm", "colic"],
  cramp:        ["spasm", "colic"],
  breathless:   ["dyspnoea", "dyspnea", "short breath"],
  breathlessness:["dyspnoea", "dyspnea", "short breath"],
  wheezing:     ["asthma", "wheez"],
  palpitation:  ["palpitat", "heart beat"],
  palpitations: ["palpitat", "heart beat"],
  numbness:     ["numb", "tingling"],
  tingling:     ["formication", "numb"],
  // ── Patient wording → the words the graded repertory (Repertorium Publicum) itself uses.
  // Every target was checked against the real rubric vocabulary; a word the book never uses is not listed.
  menstruation: ["menses"],
  wakefulness:  ["sleeplessness"],
  shiver:       ["shivering", "chill"],
  shivering:    ["chill", "chilliness"],
  chills:       ["chill", "chilliness"],
  hiccups:      ["hiccough"],
  hiccup:       ["hiccough"],
  indigestion:  ["dyspepsia", "eructations"],
  constipated:  ["constipation"],
  cry:          ["weeping"],
  cries:        ["weeping"],
  lonely:       ["alone", "company"],
  loneliness:   ["alone", "company"],
  stubborn:     ["obstinate"],
  obstinacy:    ["obstinate"],
  talkative:    ["loquacity", "talking"],
  chatty:       ["loquacity", "talking"],
  forgetful:    ["memory"],
  forgetfulness:["memory"],
  salty:        ["salt"],
  sweet:        ["sweets"],
  coughing:     ["cough", "expectoration"],
  snuffles:     ["coryza", "catarrh"],
  stuffy:       ["coryza", "obstruct"],
  eruption:     ["eruptions"],
  pimples:      ["acne", "eruptions"],
  boils:        ["abscess"],
  flushing:     ["heat", "flushes"],
  shaking:      ["trembling"],
  jerking:      ["twitching"],
  twitching:    ["jerking"],
  smelly:       ["offensive", "fetid", "odor"],
  foul:         ["offensive", "fetid"],
  stiff:        ["stiffness"],
  stiffness:    ["stiff"],
  limping:      ["lameness"],
  lame:         ["lameness"],
  scared:       ["fear", "fright"],
  afraid:       ["fear", "fright"],
  panic:        ["anxiety", "fear"],
  nightmares:   ["dreams", "frightful"],
  // ── Patient wording → the words old materia medica text uses (added after the Trials) ──
  // Boericke writes "thirst for very cold water", a patient says "desire cold drinks".
  desire:       ["crave", "craving", "longing", "wish"],
  crave:        ["desire", "craving", "longing"],
  craves:       ["desire", "craving", "longing"],
  craving:      ["crave", "desire", "longing"],
  crav:         ["desire", "crave", "longing"],
  drink:        ["drinks", "thirst", "water"],
  drinks:       ["drink", "thirst", "water"],
  ice:          ["ices", "ice cold", "iced"],
  vomit:        ["vomiting", "thrown up", "retching", "emesis"],
  vomited:      ["vomit", "thrown up", "retching"],
  stool:        ["stools", "evacuation"],
  throb:        ["throbbing", "pulsat", "beating", "hammering"],
  throbbing:    ["throb", "pulsat", "beating", "hammering"],
  pulsating:    ["pulsat", "throb", "beating"],
  stab:         ["stitch", "cutting", "shooting"],
  stabbing:     ["stitch", "cutting", "shooting"],
  sharp:        ["stitch", "cutting", "shooting", "stabbing"],
  drowsy:       ["sleepy", "somnolence", "stupor"],
  sleepy:       ["drowsy", "somnolence", "sleepiness"],
  hungry:       ["hunger", "ravenous", "appetite"],
  bleeding:     ["haemorrhage", "hemorrhage", "blood"],
  bruise:       ["bruis", "contusion", "ecchymosis"],
  bruised:      ["bruis", "contusion", "ecchymosis"],
  injury:       ["injur", "trauma", "wound", "contusion"],
  injuries:     ["injur", "trauma", "wound"],
  sprain:       ["strain", "wrench", "tendon"],
  fright:       ["fear", "terror", "shock"],
  grief:        ["sorrow", "bereave", "mourning"],
  jealous:      ["jealousy"],
  trembling:    ["tremor", "shaking", "tremb"],
  tremble:      ["tremor", "shaking", "tremb"],
  faint:        ["syncope", "fainting", "collapse"],
  fainting:     ["syncope", "faint", "collapse"],
  pus:          ["suppuration", "purulent", "abscess"],
  crack:        ["fissure", "chap", "cracked"],
  cracked:      ["crack", "fissure", "chap"],
  cracks:       ["crack", "fissure", "chap"],
  mucus:        ["phlegm", "expectoration", "catarrh"],
  phlegm:       ["mucus", "expectoration", "catarrh"],
  sneezing:     ["sneez"],
  sweets:       ["sugar", "sweet"],
  sugar:        ["sweets", "sweet"],
  salt:         ["salty"],
  spasm:        ["cramp", "spasmodic", "convuls"],
  paralysis:    ["paralyt", "palsy", "paresis"],
  hoarseness:   ["hoarse", "aphonia", "voice"],
  sinusitis:    ["sinus", "coryza", "catarrh"],
  wart:         ["warts", "condylomata", "excrescence"],
  warts:        ["wart", "condylomata", "excrescence"],
  piles:        ["haemorrhoid", "hemorrhoid", "hemorrhoids"],
  pile:         ["haemorrhoid", "hemorrhoid", "hemorrhoids"],
  hemorrhoids:  ["haemorrhoid", "piles"],
  indifferent:  ["indifference", "apathy"],
  oversensitive:["sensitive", "hypersens"],
  miscarriage:  ["abortion", "miscarr"],
};

// ── Helpers ───────────────────────────────────────────────────────
/** Light stemmer: enough to match coughing/cough, headaches/headache, vomiting/vomit. */
export function stem(word: string): string {
  const w = word;
  if (w.length <= 4 || NO_STEM.has(w)) return w;
  if (w.endsWith("ies") && w.length > 5) return w.slice(0, -3) + "y";
  if (w.endsWith("ing")) {
    let s = w.slice(0, -3);
    if (/([bdgmnprt])\1$/.test(s)) s = s.slice(0, -1);   // throbbing → throb, stabbing → stab
    return s.length >= 4 ? s : w;
  }
  if (w.endsWith("ed") && w.length - 2 >= 4) return w.slice(0, -2);
  if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

function toVariant(text: string): Variant | null {
  const t = text.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  if (t.length < 2) return null;
  return { text: t, wordStart: t.length <= 3 };
}

function buildGroup(raw: string, key: string, extra?: Record<string, string[]>): KeywordGroup {
  const seen = new Set<string>();
  const variants: Variant[] = [];
  const add = (t: string) => {
    const v = toVariant(t);
    if (v && !seen.has(v.text)) { seen.add(v.text); variants.push(v); }
  };
  add(key);
  for (const s of SYNONYMS[raw] || []) add(s);
  if (key !== raw) for (const s of SYNONYMS[key] || []) add(s);
  const base = variants.slice(0, 7);
  // Extra words suggested by the AI (see aiSynonyms.ts) go after the built-in ones, at most 3 more.
  const ai = [...(extra?.[raw] || []), ...(key !== raw ? extra?.[key] || [] : [])];
  for (const t of ai) {
    const v = toVariant(t);
    if (v && !seen.has(v.text) && base.length < 10) { seen.add(v.text); base.push(v); }
  }
  return { key, variants: base };
}

// Parenthesised common names the sources add after a remedy name. Any other bracket text is kept,
// because it can be part of the name ("Aurum muriaticum (natronatum)").
const COMMON_NAME_TAGS = new Set(["rattlesnake", "boneset", "black cohosh"]);

/** Canonical form of a remedy name so "ARSENICUM ALBUM", "Arsenicum album." and "arsenicum  album" group together. */
export function normalizeRemedyName(name: string): string {
  const plain = (name || "")
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, (_m, inner: string) => (COMMON_NAME_TAGS.has(inner.trim().toLowerCase()) ? " " : ` ${inner} `))
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return canonicalRemedyName(plain);
}

// ── Main extraction ───────────────────────────────────────────────
export function extractKeywords(symptoms: string[], maxGroups = 12, extra?: Record<string, string[]>): ExtractedKeywords {
  const groups = new Map<string, KeywordGroup>();
  const order: string[] = [];
  const modalities: Modality[] = [];

  for (const phrase of symptoms) {
    for (const clause of phrase.toLowerCase().split(/[,;.\n]+/)) {
      let dir: "worse" | "better" | null = null;
      let negate = false;

      for (const raw of clause.split(/[^a-z]+/)) {
        if (!raw) continue;
        if (raw === "worse" || raw === "aggravated" || raw === "aggravation") { dir = "worse"; continue; }
        if (raw === "better" || raw === "relieved" || raw === "ameliorated" || raw === "amelioration") { dir = "better"; continue; }
        if (raw === "but") { dir = null; negate = false; continue; }
        if (NEGATORS.has(raw)) { negate = true; continue; }
        if (STOP.has(raw) || raw.length < 3) continue;
        if (negate) { negate = false; continue; }   // "no thirst" → skip "thirst"

        const key = stem(raw);
        if (!groups.has(key)) { groups.set(key, buildGroup(raw, key, extra)); order.push(key); }
        if (dir) modalities.push({ dir, key });
      }
    }
  }

  // Specific words first; generic words (pain, ache…) last. Then cap.
  const all = order.map((k) => groups.get(k)!);
  const kept = [...all.filter((g) => !GENERIC.has(g.key)), ...all.filter((g) => GENERIC.has(g.key))].slice(0, maxGroups);
  const keptKeys = new Set(kept.map((g) => g.key));

  return { groups: kept, modalities: modalities.filter((m) => keptKeys.has(m.key)) };
}

// ── Matching helpers (used for local ranking) ─────────────────────
/** ILIKE patterns for one variant. */
export function variantPatterns(v: Variant): string[] {
  return v.wordStart ? [`${v.text}%`, `% ${v.text}%`] : [`%${v.text}%`];
}

export function groupMatches(text: string, g: KeywordGroup): boolean {
  for (const v of g.variants) {
    if (v.wordStart) {
      if (new RegExp(`(^|[^a-z])${v.text}`).test(text)) return true;
    } else if (text.includes(v.text)) {
      return true;
    }
  }
  return false;
}

export function countGroupMatches(text: string, groups: KeywordGroup[]): number {
  let n = 0;
  for (const g of groups) if (groupMatches(text, g)) n++;
  return n;
}

const WORSE_RE  = /worse|aggravat|</;
const BETTER_RE = /better|ameliorat|relieved|>/;

/** +1 when text agrees with a patient modality, −1 when it states the opposite. Neutral when text has no direction word. */
export function modalityScore(text: string, modalities: Modality[]): number {
  let score = 0;
  for (const m of modalities) {
    if (!text.includes(m.key)) continue;
    const worse = WORSE_RE.test(text);
    const better = BETTER_RE.test(text);
    if (m.dir === "worse")  { if (worse) score += 1; else if (better) score -= 1; }
    if (m.dir === "better") { if (better) score += 1; else if (worse) score -= 1; }
  }
  return score;
}
