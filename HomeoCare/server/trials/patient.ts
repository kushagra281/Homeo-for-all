// A simulated patient who goes through the app's own interview (client/src/lib/caseTaking.ts, the built-in question
// bank) and answers it like a person would. The answers become search words exactly as the app builds them
// (remedy-scorer.tsx submitToAI), so the Trials can measure the whole path: typed words -> questions -> answers -> search.
//
// This simulates the BUILT-IN bank (the app's fallback when the AI is off). It does not simulate the AI's own questions.
import { ALL_QUESTIONS, MAX_QUESTIONS, nextQuestion, searchRequest, type CaseQuestion, type CaseState } from "../../client/src/lib/caseTaking";
import type { Persona } from "./personas";

export interface Noise { forget: number; misclick: number; skip: number }
/** Knows exactly what is true and confirms all of it. */
export const PERFECT: Noise = { forget: 0, misclick: 0, skip: 0 };
/** An ordinary patient: forgets a quarter of what is true, sometimes ticks the wrong box, sometimes skips a question. */
export const TYPICAL: Noise = { forget: 0.25, misclick: 0.1, skip: 0.1 };

/** Small seeded random generator (mulberry32): the same seed always gives the same patient. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(text: string, run = 0): number {
  let h = 2166136261 ^ run;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** The labels a patient with these facts would tick for one question ([] = nothing fits, or skipped). */
export function answerQuestion(q: CaseQuestion, facts: Set<string>, noise: Noise, rand: () => number): string[] {
  const skipped = rand() < noise.skip;
  let hit = q.options.filter((o) => o.phrases.some((ph) => facts.has(norm(ph))));
  hit = hit.filter(() => rand() >= noise.forget);
  if (!q.multi) hit = hit.slice(0, 1);
  if (rand() < noise.misclick) {
    const others = q.options.filter((o) => o.phrases.length && !hit.includes(o));
    if (others.length) { const wrong = others[Math.floor(rand() * others.length)]; hit = q.multi ? [...hit, wrong] : [wrong]; }
  }
  return skipped ? [] : hit.map((o) => o.label);
}

export interface Interview {
  state: CaseState;
  asked: string[];         // question ids, in order
  symptoms: string[];      // what the app sends to the search: typed words + answer phrases + category
  generals: string[];      // the general-symptom phrases among them, named again so the search can weigh them differently
  filters: { symptom_location?: string };
  gaps: string[];          // facts the patient has that no asked question offered and the typed words do not already say
  unknown: string[];       // facts that exist nowhere in the question bank (a typo in the persona, or a missing option)
}

// A fact the patient already typed ("palpitations") needs no question: every word of it is among the typed words (plural ignored).
const stem = (w: string) => w.replace(/s$/, "");
const wordsOf = (t: string) => (t.toLowerCase().match(/[a-z0-9]+/g) || []).map(stem);
const stated = (fact: string, typed: string[]) => {
  const have = new Set(typed.flatMap(wordsOf));
  const need = wordsOf(fact);
  return need.length > 0 && need.every((w) => have.has(w));
};

const BANK_PHRASES = new Set(ALL_QUESTIONS.flatMap((q) => q.options.flatMap((o) => o.phrases.map(norm))));

export function interview(persona: Persona, noise: Noise = PERFECT, run = 0): Interview {
  const facts = new Set(persona.picks.map(norm));
  const rand = rng(hashSeed(persona.of, run));
  const state: CaseState = { symptoms: [...persona.typed], category: persona.category, answers: {}, custom: {} };
  const asked: string[] = [];
  for (let i = 0; i <= MAX_QUESTIONS; i++) {            // the bank ends the interview itself; the loop is only a guard
    const q = nextQuestion(state);
    if (!q) break;
    state.answers[q.id] = answerQuestion(q, facts, noise, rand);
    asked.push(q.id);
  }
  // the search request, built like submitToAI in remedy-scorer.tsx
  const req = searchRequest(state);
  const offered = new Set(asked.flatMap((id) => (ALL_QUESTIONS.find((q) => q.id === id)?.options || []).flatMap((o) => o.phrases.map(norm))));
  return {
    state, asked, symptoms: req.symptoms, generals: req.generals, filters: req.filters,
    gaps: [...facts].filter((f) => BANK_PHRASES.has(f) && !offered.has(f) && !stated(f, persona.typed)),
    unknown: [...facts].filter((f) => !BANK_PHRASES.has(f)),
  };
}
