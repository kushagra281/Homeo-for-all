// server/services/aiSynonyms.ts
// AI SYNONYMS: turns the patient's everyday words (English, Hindi, Hinglish) into the words the
// materia medica and repertory use ("sui chubhi" -> puncture, prick; "gushing" -> profuse, copious).
//
// The AI only suggests extra search words. It never ranks and never names a remedy: the words are
// added to the keyword groups and the normal rubric search and scoring do the rest.
// Safety nets: whatever comes back is untrusted, so it is cut down to plain single words; results are
// cached (same symptoms, same answer, no repeated call); a slow or failing model, or a missing key,
// simply means "no extra words" and the search runs on the built-in synonym list.

import { groq, hasGroqKey } from "../utils/groq";

export type Expansion = Record<string, string[]>;

const MAX_KEYS = 12;
const MAX_TERMS = 4;
const TIMEOUT_MS = 3500;
const CACHE_MAX = 500;
const cache = new Map<string, Expansion>();

/** One lowercase a-z word of 3 to 20 letters, or "" if the text is anything else. */
export function cleanTerm(t: unknown): string {
  if (typeof t !== "string") return "";
  const w = t.toLowerCase().trim();
  return /^[a-z]{3,20}$/.test(w) ? w : "";
}

/** Untrusted model text -> { patientWord: [up to 4 clean search words] }. Anything odd is dropped. */
export function parseExpansion(raw: string): Expansion {
  const m = (raw || "").match(/\{[\s\S]*\}/);
  if (!m) return {};
  let obj: any;
  try { obj = JSON.parse(m[0]); } catch { return {}; }
  const terms = obj && typeof obj === "object" ? obj.terms : null;
  if (!terms || typeof terms !== "object" || Array.isArray(terms)) return {};
  const out: Expansion = {};
  for (const [k, v] of Object.entries(terms).slice(0, MAX_KEYS)) {
    const key = cleanTerm(k);
    if (!key || !Array.isArray(v)) continue;
    const list = [...new Set(v.map(cleanTerm).filter((w) => w && w !== key))].slice(0, MAX_TERMS);
    if (list.length) out[key] = list;
  }
  return out;
}

const SYSTEM = `You help a homeopathy search engine. The patient describes symptoms in everyday English, Hindi or Hinglish. For each symptom word that a materia medica (Boericke) or repertory may word differently, give up to 4 single English words that such books use for the same thing (e.g. "gushing" -> ["profuse","copious","spurting"]; "chubhi" -> ["prick","puncture","stab"]; "dast" -> ["diarrhoea","stool"]). Each key must be ONE patient word.
Rules: single lowercase English words only; no remedy names; no diagnoses; skip words that need no help.
Reply with JSON only: {"terms": {"<patient word>": ["word", "word"]}}`;

const MODELS = [process.env.GROQ_TEXT_MODEL, "openai/gpt-oss-120b", "qwen/qwen3.8-27b"].filter(Boolean) as string[];

async function askGroq(symptoms: string[], signal: AbortSignal): Promise<string> {
  let last: unknown;
  for (const model of MODELS) {
    if (signal.aborted) break;
    try {
      const body: any = {
        model, max_tokens: 700, temperature: 0, response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: symptoms.join("\n") }],
      };
      if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
      const r = await groq().chat.completions.create(body, { timeout: TIMEOUT_MS, signal });
      const text = r.choices[0]?.message?.content || "";
      if (text.trim()) return text;
    } catch (e) { last = e; }
  }
  throw last || new Error("no model answered");
}

export function _clearCache() { cache.clear(); }

/**
 * Extra search words for the patient's symptoms, or {} when the AI is off, slow or wrong.
 * `ask` is injectable for tests.
 */
export async function expandSymptoms(
  symptoms: string[],
  ask: (s: string[], signal: AbortSignal) => Promise<string> = askGroq,
  timeoutMs = TIMEOUT_MS,
): Promise<Expansion> {
  if (process.env.AI_SYNONYMS === "off") return {};
  if (ask === askGroq && !hasGroqKey()) return {};
  const clean = symptoms.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 12);
  if (!clean.length) return {};
  const key = clean.join("|");
  const hit = cache.get(key);
  if (hit) return hit;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const result = parseExpansion(await Promise.race([
      ask(clean, ctl.signal),
      new Promise<string>((_, rej) => ctl.signal.addEventListener("abort", () => rej(new Error("timeout")))),
    ]));
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, result);
    return result;
  } catch (e: any) {
    console.warn("[AI synonyms] skipped:", e?.message || e);
    return {};                       // not cached: the next search may try again
  } finally {
    clearTimeout(timer);
  }
}
