// server/ai/rubric-mapper.ts
// AI MODULE — Restricted to ONE job only:
// Map user symptom strings → repertory rubric codes
//
// AI is FORBIDDEN from:
//   - Suggesting remedies directly
//   - Overriding scoring engine output
//   - Ranking remedies

import OpenAI from "openai";
import type { RubricMatch, HealthProfile } from "../../shared/types";

const groq = new OpenAI({
  apiKey: process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

// ── Known rubric codes the AI can reference ──────────────────────
// In production this list comes from DB; here we hardcode for safety
const KNOWN_RUBRIC_CODES = [
  // MIND
  "MIND", "MIND.ANXIETY", "MIND.ANXIETY.NIGHT", "MIND.ANXIETY.ALONE",
  "MIND.ANXIETY.HEALTH", "MIND.FEAR", "MIND.RESTLESS", "MIND.GRIEF", "MIND.ANGER",
  // HEAD
  "HEAD", "HEAD.PAIN", "HEAD.PAIN.THROBBING", "HEAD.PAIN.PRESSING",
  "HEAD.PAIN.TEMPLE", "HEAD.PAIN.MOTION.WORSE", "HEAD.VERTIGO",
  // GENERALITIES
  "GENERALITIES", "GEN.WORSE.COLD", "GEN.WORSE.HEAT",
  "GEN.BETTER.REST", "GEN.BETTER.MOTION",
  // EXTREMITIES
  "EXTREMITIES", "EXT.PAIN", "EXT.PAIN.JOINTS", "EXT.STIFF.MORNING",
  // SKIN
  "SKIN", "SKIN.ITCH", "SKIN.ERUPTION", "SKIN.DRY",
  // STOMACH
  "STOMACH", "RESPIRATORY",
];

const SYSTEM_PROMPT = `You are a classical homeopathy repertory expert.
Your ONLY job is to map patient symptom descriptions to rubric codes from a repertory.

STRICT RULES:
1. Return ONLY rubric codes from the provided list
2. NEVER suggest remedy names
3. NEVER rank or filter remedies
4. Mark is_eliminating=true ONLY for symptoms the patient says are ABSENT or OPPOSITE
5. confidence must be 0.0-1.0 based on how well the symptom matches the rubric
6. If no rubric matches well (confidence < 0.4), omit it entirely

Rubric codes available: ${KNOWN_RUBRIC_CODES.join(", ")}`;

// ── Main export: symptom strings → rubric matches ────────────────

export async function mapSymptomsToRubrics(
  symptoms: string[],
  bodySystem?: string,
  healthProfile?: HealthProfile
): Promise<RubricMatch[]> {
  const groqKey = process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.warn("[AI] No Groq key — skipping rubric mapping");
    return [];
  }

  // Build patient context to guide rubric selection (NOT remedy selection)
  const profileLines: string[] = [];
  if (healthProfile?.age)    profileLines.push(`Age: ${healthProfile.age}`);
  if (healthProfile?.gender) profileLines.push(`Gender: ${healthProfile.gender}`);
  if (healthProfile?.arthritis && healthProfile.arthritis !== "None")
    profileLines.push(`Has: ${healthProfile.arthritis} arthritis`);
  if (healthProfile?.depression_anxiety && healthProfile.depression_anxiety !== "None")
    profileLines.push(`Mental health: ${healthProfile.depression_anxiety}`);
  if (healthProfile?.chronic_conditions)
    profileLines.push(`Chronic: ${healthProfile.chronic_conditions}`);

  const patientContext = profileLines.length
    ? `Patient context (use only to improve rubric accuracy): ${profileLines.join(" | ")}`
    : "";

  const userPrompt = `Map these patient symptoms to repertory rubric codes.

Patient symptoms: ${symptoms.slice(0, 8).join("; ")}
Body system filter: ${bodySystem || "any"}
${patientContext}

Return ONLY valid JSON array, no markdown:
[
  {
    "rubric_code": "MIND.ANXIETY.NIGHT",
    "label": "Anxiety at night",
    "confidence": 0.9,
    "original_symptom": "worse at night, anxious",
    "is_eliminating": false
  }
]

Remember: return ONLY rubric codes, NEVER remedy names.`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      max_tokens: 600,
      temperature: 0.1, // low temp = consistent, deterministic output
    });

    const content = response.choices[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      console.warn("[AI] No JSON array found in response");
      return [];
    }

    const parsed: RubricMatch[] = JSON.parse(match[0]);

    // Safety: filter out any attempt by AI to sneak remedy names in
    const validated = parsed.filter((m) => {
      if (!m.rubric_code || !KNOWN_RUBRIC_CODES.includes(m.rubric_code)) {
        console.warn(`[AI] Rejected unknown rubric code: ${m.rubric_code}`);
        return false;
      }
      if (m.confidence < 0.4) return false;
      return true;
    });

    console.log(
      `[AI] Mapped ${symptoms.length} symptoms → ${validated.length} rubrics:`,
      validated.map((v) => `${v.rubric_code}(${v.confidence})`).join(", ")
    );

    return validated;
  } catch (e) {
    console.error("[AI] mapSymptomsToRubrics error:", e);
    return [];
  }
}

// ── Fallback: keyword-based rubric matching (no AI needed) ───────
// Used when Groq is unavailable or as double-check

const KEYWORD_RUBRIC_MAP: Array<{
  keywords: string[];
  rubric_code: string;
  label: string;
  confidence: number;
}> = [
  { keywords: ["anxiety","anxious","worry","worried","nervous"],     rubric_code: "MIND.ANXIETY",          label: "Anxiety",              confidence: 0.8 },
  { keywords: ["anxiety night","anxious night","worse night"],       rubric_code: "MIND.ANXIETY.NIGHT",    label: "Anxiety at night",     confidence: 0.85 },
  { keywords: ["anxiety alone","fear alone","worse alone"],          rubric_code: "MIND.ANXIETY.ALONE",    label: "Anxiety when alone",   confidence: 0.85 },
  { keywords: ["fear","fright","phobia","scared"],                   rubric_code: "MIND.FEAR",             label: "Fear",                 confidence: 0.8 },
  { keywords: ["restless","restlessness","cannot sit still"],        rubric_code: "MIND.RESTLESS",         label: "Restlessness",         confidence: 0.8 },
  { keywords: ["grief","sadness","weeping","crying","loss"],         rubric_code: "MIND.GRIEF",            label: "Grief",                confidence: 0.8 },
  { keywords: ["anger","irritable","irritability","rage"],           rubric_code: "MIND.ANGER",            label: "Anger",                confidence: 0.75 },
  { keywords: ["headache","head pain","head ache"],                  rubric_code: "HEAD.PAIN",             label: "Head pain",            confidence: 0.8 },
  { keywords: ["throbbing","pulsating","pounding","beating"],        rubric_code: "HEAD.PAIN.THROBBING",   label: "Throbbing headache",   confidence: 0.85 },
  { keywords: ["pressing","pressure","band","tight"],                rubric_code: "HEAD.PAIN.PRESSING",    label: "Pressing headache",    confidence: 0.8 },
  { keywords: ["temples","temporal","sides of head"],                rubric_code: "HEAD.PAIN.TEMPLE",      label: "Temple headache",      confidence: 0.8 },
  { keywords: ["worse motion","worse movement","worse moving"],      rubric_code: "HEAD.PAIN.MOTION.WORSE",label: "Worse motion",         confidence: 0.85 },
  { keywords: ["vertigo","dizziness","dizzy"],                       rubric_code: "HEAD.VERTIGO",          label: "Vertigo",              confidence: 0.8 },
  { keywords: ["worse cold","cold aggravates","sensitive cold"],     rubric_code: "GEN.WORSE.COLD",        label: "Worse from cold",      confidence: 0.8 },
  { keywords: ["worse heat","heat aggravates","intolerant heat"],    rubric_code: "GEN.WORSE.HEAT",        label: "Worse from heat",      confidence: 0.8 },
  { keywords: ["better rest","rest relieves","relieved resting"],    rubric_code: "GEN.BETTER.REST",       label: "Better from rest",     confidence: 0.8 },
  { keywords: ["better motion","better movement","moving helps"],    rubric_code: "GEN.BETTER.MOTION",     label: "Better from motion",   confidence: 0.8 },
  { keywords: ["joint pain","joint ache","arthralgia"],              rubric_code: "EXT.PAIN.JOINTS",       label: "Joint pain",           confidence: 0.85 },
  { keywords: ["morning stiffness","stiff morning","stiff waking"],  rubric_code: "EXT.STIFF.MORNING",     label: "Morning stiffness",    confidence: 0.9 },
  { keywords: ["itching","itches","pruritus","scratching"],          rubric_code: "SKIN.ITCH",             label: "Skin itching",         confidence: 0.85 },
  { keywords: ["dry skin","skin dryness","rough skin"],              rubric_code: "SKIN.DRY",              label: "Dry skin",             confidence: 0.8 },
  { keywords: ["rash","eruption","hives","urticaria"],               rubric_code: "SKIN.ERUPTION",         label: "Skin eruption",        confidence: 0.8 },
];

export function mapSymptomsToRubricsKeyword(symptoms: string[]): RubricMatch[] {
  const text = symptoms.join(" ").toLowerCase();
  const matches: RubricMatch[] = [];
  const seen = new Set<string>();

  for (const entry of KEYWORD_RUBRIC_MAP) {
    if (seen.has(entry.rubric_code)) continue;
    const hit = entry.keywords.some((kw) => text.includes(kw));
    if (hit) {
      matches.push({
        rubric_code:       entry.rubric_code,
        label:             entry.label,
        confidence:        entry.confidence,
        original_symptom:  symptoms.find((s) => entry.keywords.some((k) => s.toLowerCase().includes(k))) || "",
        is_eliminating:    false,
      });
      seen.add(entry.rubric_code);
    }
  }

  return matches;
}
