// server/services/rubricService.ts
// RUBRIC SERVICE
// Single responsibility: map user symptom strings → rubric codes
// AI is used ONLY here and ONLY for this mapping task.
// No remedy names are ever returned by AI.

import { groq, hasGroqKey } from "../utils/groq";
import { fromCache, toCache } from "../utils/supabase";

// ── Types ─────────────────────────────────────────────────────────
export interface RubricMatch {
  rubric_code:      string;
  label:            string;
  confidence:       number;   // 0.0–1.0
  original_symptom: string;
  is_eliminating:   boolean;  // true = patient denies this symptom
}

// ── Whitelist of valid rubric codes ──────────────────────────────
// AI output is validated against this list — any other code is rejected.
// Extend this list as you add more rubrics to the DB.
export const VALID_RUBRIC_CODES = new Set([
  // MIND
  "MIND", "MIND.ANXIETY", "MIND.ANXIETY.NIGHT", "MIND.ANXIETY.ALONE",
  "MIND.ANXIETY.HEALTH", "MIND.FEAR", "MIND.FEAR.DEATH", "MIND.FEAR.ALONE",
  "MIND.RESTLESS", "MIND.RESTLESS.NIGHT", "MIND.GRIEF", "MIND.ANGER",
  "MIND.DEPRESSION", "MIND.IRRITABILITY", "MIND.WEEPING",
  // HEAD
  "HEAD", "HEAD.PAIN", "HEAD.PAIN.THROBBING", "HEAD.PAIN.PRESSING",
  "HEAD.PAIN.BURSTING", "HEAD.PAIN.TEMPLE", "HEAD.PAIN.MOTION.WORSE",
  "HEAD.PAIN.LIGHT.WORSE", "HEAD.PAIN.NOISE.WORSE", "HEAD.PAIN.MORNING",
  "HEAD.PAIN.COLD.BETTER", "HEAD.VERTIGO",
  // GENERALITIES
  "GENERALITIES", "GEN.WORSE.COLD", "GEN.WORSE.HEAT", "GEN.WORSE.NIGHT",
  "GEN.WORSE.DAMP", "GEN.BETTER.REST", "GEN.BETTER.MOTION",
  "GEN.BETTER.WARMTH", "GEN.BETTER.OPEN.AIR", "GEN.WEAKNESS", "GEN.BURNING",
  // EXTREMITIES
  "EXTREMITIES", "EXT.PAIN", "EXT.PAIN.JOINTS", "EXT.PAIN.KNEE",
  "EXT.PAIN.BACK", "EXT.PAIN.WORSE.REST", "EXT.PAIN.BETTER.WARMTH",
  "EXT.STIFF.MORNING", "EXT.SWELLING",
  // SKIN
  "SKIN", "SKIN.ITCH", "SKIN.ITCH.NIGHT", "SKIN.ITCH.HEAT",
  "SKIN.ITCH.SCRATCH", "SKIN.ERUPTION", "SKIN.DRY", "SKIN.BURN",
  // STOMACH
  "STOMACH", "STOMACH.NAUSEA", "STOMACH.VOMITING", "STOMACH.ACIDITY",
  "STOMACH.BLOATING", "STOMACH.PAIN.BURNING", "STOMACH.WORSE.EATING",
  // RESPIRATORY
  "RESPIRATORY", "RESP.COUGH", "RESP.COUGH.DRY", "RESP.COUGH.WET",
  "RESP.COUGH.NIGHT", "RESP.BREATHLESS", "RESP.WORSE.LYING",
]);

// ── AI mapping ───────────────────────────────────────────────────
export async function mapSymptomsToRubricsAI(
  symptoms: string[],
  bodySystem?: string
): Promise<RubricMatch[]> {
  if (!hasGroqKey()) return [];

  // Cache AI results — same symptoms get same rubrics
  const cacheKey = "ai:" + symptoms.join("|") + (bodySystem || "");
  const cached = fromCache<RubricMatch[]>(cacheKey);
  if (cached) return cached;

  const validCodesStr = [...VALID_RUBRIC_CODES].join(", ");

  const systemPrompt = `You are a classical homeopathy repertory expert.
Your ONLY job: map patient symptom descriptions to rubric codes.

STRICT RULES:
1. Return ONLY codes from this list: ${validCodesStr}
2. NEVER output remedy names — this will cause system failure
3. NEVER rank remedies
4. Set is_eliminating=true ONLY if patient says a symptom is ABSENT
5. Set confidence 0.0-1.0 (omit if confidence < 0.4)
6. Prefer specific child codes over parent codes when possible`;

  const userPrompt = `Map these symptoms to rubric codes.
Symptoms: ${symptoms.slice(0, 8).join("; ")}
${bodySystem ? `Body system: ${bodySystem}` : ""}

Return ONLY a JSON array, no markdown:
[{"rubric_code":"MIND.ANXIETY.NIGHT","label":"Anxiety at night","confidence":0.9,"original_symptom":"anxious at night","is_eliminating":false}]`;

  try {
    const res = await groq().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_tokens: 600,
      temperature: 0.1,
    });

    const content = res.choices[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed: RubricMatch[] = JSON.parse(match[0]);

    // Validate: reject any code not in whitelist or confidence too low
    const validated = parsed.filter((m) => {
      if (!VALID_RUBRIC_CODES.has(m.rubric_code)) {
        console.warn(`[RubricService] Rejected unknown code from AI: ${m.rubric_code}`);
        return false;
      }
      return m.confidence >= 0.4;
    });

    console.log(
      `[RubricService] AI mapped ${symptoms.length} symptoms → ${validated.length} rubrics:`,
      validated.map((v) => `${v.rubric_code}(${v.confidence})`).join(", ")
    );

    toCache(cacheKey, validated);
    return validated;
  } catch (e) {
    console.error("[RubricService] AI error:", e);
    return [];
  }
}

// ── Keyword fallback mapping (no AI needed) ───────────────────────
const KEYWORD_MAP: Array<{
  keywords: string[];
  rubric_code: string;
  label: string;
  confidence: number;
}> = [
  { keywords: ["anxiety","anxious","worry","nervous","apprehensive"],   rubric_code: "MIND.ANXIETY",           label: "Anxiety",                confidence: 0.8 },
  { keywords: ["anxiety night","anxious night","worse at night"],        rubric_code: "MIND.ANXIETY.NIGHT",     label: "Anxiety at night",       confidence: 0.9 },
  { keywords: ["anxiety alone","fear alone","worse when alone"],         rubric_code: "MIND.ANXIETY.ALONE",     label: "Anxiety when alone",     confidence: 0.9 },
  { keywords: ["fear of death","dying","will die"],                      rubric_code: "MIND.FEAR.DEATH",        label: "Fear of death",          confidence: 0.9 },
  { keywords: ["fear","fright","scared","phobia"],                       rubric_code: "MIND.FEAR",              label: "Fear",                   confidence: 0.8 },
  { keywords: ["restless","cannot rest","fidgety","cannot sit still"],   rubric_code: "MIND.RESTLESS",          label: "Restlessness",           confidence: 0.8 },
  { keywords: ["grief","loss","bereavement","mourning"],                 rubric_code: "MIND.GRIEF",             label: "Grief",                  confidence: 0.85 },
  { keywords: ["anger","irritable","rage","furious"],                    rubric_code: "MIND.ANGER",             label: "Anger",                  confidence: 0.8 },
  { keywords: ["depression","depressed","hopeless","low mood"],          rubric_code: "MIND.DEPRESSION",        label: "Depression",             confidence: 0.8 },
  { keywords: ["weeping","crying","tearful"],                            rubric_code: "MIND.WEEPING",           label: "Weeping",                confidence: 0.85 },
  { keywords: ["headache","head pain","head ache","cephalgia"],          rubric_code: "HEAD.PAIN",              label: "Head pain",              confidence: 0.8 },
  { keywords: ["throbbing","pulsating","pounding","beating head"],       rubric_code: "HEAD.PAIN.THROBBING",    label: "Throbbing headache",     confidence: 0.9 },
  { keywords: ["pressing","pressure head","tight head","band"],          rubric_code: "HEAD.PAIN.PRESSING",     label: "Pressing headache",      confidence: 0.85 },
  { keywords: ["bursting","splitting head","explosive"],                 rubric_code: "HEAD.PAIN.BURSTING",     label: "Bursting headache",      confidence: 0.9 },
  { keywords: ["worse motion","worse movement","worse moving head"],     rubric_code: "HEAD.PAIN.MOTION.WORSE", label: "Headache worse motion",  confidence: 0.9 },
  { keywords: ["worse light","light sensitive","photophobia"],           rubric_code: "HEAD.PAIN.LIGHT.WORSE",  label: "Headache worse light",   confidence: 0.9 },
  { keywords: ["worse noise","noise sensitive","sound"],                 rubric_code: "HEAD.PAIN.NOISE.WORSE",  label: "Headache worse noise",   confidence: 0.9 },
  { keywords: ["temples","temporal","sides of head"],                    rubric_code: "HEAD.PAIN.TEMPLE",       label: "Temple headache",        confidence: 0.85 },
  { keywords: ["vertigo","dizzy","dizziness","spinning"],                rubric_code: "HEAD.VERTIGO",           label: "Vertigo",                confidence: 0.9 },
  { keywords: ["worse cold","cold aggravates","cold makes worse"],       rubric_code: "GEN.WORSE.COLD",         label: "Worse from cold",        confidence: 0.85 },
  { keywords: ["worse heat","heat aggravates","worse warm"],             rubric_code: "GEN.WORSE.HEAT",         label: "Worse from heat",        confidence: 0.85 },
  { keywords: ["worse night","night aggravates","worse at night"],       rubric_code: "GEN.WORSE.NIGHT",        label: "Worse at night",         confidence: 0.85 },
  { keywords: ["worse damp","worse wet","worse humidity"],               rubric_code: "GEN.WORSE.DAMP",         label: "Worse from damp",        confidence: 0.85 },
  { keywords: ["better rest","rest relieves","better lying"],            rubric_code: "GEN.BETTER.REST",        label: "Better from rest",       confidence: 0.85 },
  { keywords: ["better motion","better movement","better walking"],      rubric_code: "GEN.BETTER.MOTION",      label: "Better from motion",     confidence: 0.85 },
  { keywords: ["better warmth","warmth relieves","better warm"],         rubric_code: "GEN.BETTER.WARMTH",      label: "Better from warmth",     confidence: 0.85 },
  { keywords: ["better open air","fresh air","open air"],                rubric_code: "GEN.BETTER.OPEN.AIR",    label: "Better in open air",     confidence: 0.85 },
  { keywords: ["joint pain","joints ache","arthralgia","painful joints"],rubric_code: "EXT.PAIN.JOINTS",        label: "Joint pain",             confidence: 0.9 },
  { keywords: ["morning stiffness","stiff morning","stiff waking"],      rubric_code: "EXT.STIFF.MORNING",      label: "Morning stiffness",      confidence: 0.95 },
  { keywords: ["knee pain","knee ache","knee hurts"],                    rubric_code: "EXT.PAIN.KNEE",          label: "Knee pain",              confidence: 0.9 },
  { keywords: ["back pain","backache","spine pain","lumbar"],            rubric_code: "EXT.PAIN.BACK",          label: "Back pain",              confidence: 0.9 },
  { keywords: ["worse rest","pain worse rest","stiff after rest"],       rubric_code: "EXT.PAIN.WORSE.REST",    label: "Pain worse from rest",   confidence: 0.9 },
  { keywords: ["better warmth joints","warm compress","heat on joints"], rubric_code: "EXT.PAIN.BETTER.WARMTH", label: "Joint pain better warmth",confidence: 0.9 },
  { keywords: ["swelling","swollen joints","oedema"],                    rubric_code: "EXT.SWELLING",           label: "Swelling",               confidence: 0.85 },
  { keywords: ["itching","itches","pruritus","scratch"],                 rubric_code: "SKIN.ITCH",              label: "Skin itching",           confidence: 0.85 },
  { keywords: ["itch night","itching night","worse night skin"],         rubric_code: "SKIN.ITCH.NIGHT",        label: "Itching at night",       confidence: 0.9 },
  { keywords: ["itch heat","worse heat skin","heat makes itch"],         rubric_code: "SKIN.ITCH.HEAT",         label: "Itching worse heat",     confidence: 0.9 },
  { keywords: ["rash","eruption","hives","urticaria"],                   rubric_code: "SKIN.ERUPTION",          label: "Skin eruption",          confidence: 0.85 },
  { keywords: ["dry skin","rough skin","skin dryness"],                  rubric_code: "SKIN.DRY",               label: "Dry skin",               confidence: 0.85 },
  { keywords: ["burning skin","skin burns","hot skin"],                  rubric_code: "SKIN.BURN",              label: "Burning skin",           confidence: 0.85 },
  { keywords: ["nausea","nauseous","sick feeling","queasy"],             rubric_code: "STOMACH.NAUSEA",         label: "Nausea",                 confidence: 0.85 },
  { keywords: ["vomiting","vomit","throwing up"],                        rubric_code: "STOMACH.VOMITING",       label: "Vomiting",               confidence: 0.9 },
  { keywords: ["acidity","heartburn","acid reflux","gerd"],              rubric_code: "STOMACH.ACIDITY",        label: "Acidity",                confidence: 0.9 },
  { keywords: ["bloating","bloated","gas","flatulence"],                 rubric_code: "STOMACH.BLOATING",       label: "Bloating",               confidence: 0.85 },
  { keywords: ["worse eating","after eating","after meals"],             rubric_code: "STOMACH.WORSE.EATING",   label: "Stomach worse eating",   confidence: 0.85 },
  { keywords: ["dry cough","cough dry","non productive"],                rubric_code: "RESP.COUGH.DRY",         label: "Dry cough",              confidence: 0.9 },
  { keywords: ["wet cough","productive cough","cough with phlegm"],      rubric_code: "RESP.COUGH.WET",         label: "Wet cough",              confidence: 0.9 },
  { keywords: ["cough night","night cough","worse night cough"],         rubric_code: "RESP.COUGH.NIGHT",       label: "Night cough",            confidence: 0.9 },
  { keywords: ["breathless","breathlessness","shortness of breath"],     rubric_code: "RESP.BREATHLESS",        label: "Breathlessness",         confidence: 0.9 },
  { keywords: ["worse lying","breathless lying","lie down worse"],       rubric_code: "RESP.WORSE.LYING",       label: "Worse lying down",       confidence: 0.9 },
];

export function mapSymptomsKeyword(symptoms: string[]): RubricMatch[] {
  const text = symptoms.join(" ").toLowerCase();
  const results: RubricMatch[] = [];
  const seen = new Set<string>();

  for (const entry of KEYWORD_MAP) {
    if (seen.has(entry.rubric_code)) continue;
    const hit = entry.keywords.some((kw) => text.includes(kw));
    if (!hit) continue;

    results.push({
      rubric_code:      entry.rubric_code,
      label:            entry.label,
      confidence:       entry.confidence,
      original_symptom: symptoms.find((s) =>
        entry.keywords.some((k) => s.toLowerCase().includes(k))
      ) || "",
      is_eliminating: false,
    });
    seen.add(entry.rubric_code);
  }

  return results;
}

// ── Combined mapping: AI + keyword, deduplicated ──────────────────
export async function mapSymptoms(
  symptoms: string[],
  bodySystem?: string
): Promise<RubricMatch[]> {
  // Run AI and keyword in parallel
  const [aiMatches, kwMatches] = await Promise.all([
    mapSymptomsToRubricsAI(symptoms, bodySystem),
    Promise.resolve(mapSymptomsKeyword(symptoms)),
  ]);

  // Merge: AI matches take priority, keyword fills gaps
  const seen = new Set(aiMatches.map((m) => m.rubric_code));
  for (const km of kwMatches) {
    if (!seen.has(km.rubric_code)) {
      aiMatches.push(km);
      seen.add(km.rubric_code);
    }
  }

  return aiMatches;
}
