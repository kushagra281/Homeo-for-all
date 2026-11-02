// Calls to the AI case-taking routes. Every failure returns null: the app then keeps working with its
// built-in question bank and shows the results without the AI explanation.

import type { CaseQuestion } from "./caseTaking";

export interface AiLine { question: string; answer: string }
export type NextReply = { done: true } | { done: false; question: CaseQuestion };

export interface AiExplanation {
  overview: string;
  remedies: Array<{ name: string; why: string; against: string }>;
  ask_next: string[];
}

async function post(path: string, body: unknown, ms: number): Promise<any | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(timer); }
}

export async function fetchNextQuestion(symptoms: string[], answers: AiLine[], id: string): Promise<NextReply | null> {
  const j = await post("/api/remedies/next-question", { symptoms, answers }, 25_000);
  if (!j || j.fallback) return null;
  if (j.done === true) return { done: true };
  const q = j.question;
  if (!q || !Array.isArray(q.options)) return null;
  return {
    done: false,
    question: { id, topic: "ai", text: q.text, why: q.why || "", multi: !!q.multi, options: q.options },
  };
}

export async function fetchExplanation(
  symptoms: string[], answers: AiLine[],
  ranked: Array<{ name: string; score: number; mental: string[]; physical: string[] }>,
): Promise<AiExplanation | null> {
  const j = await post("/api/remedies/explain", { symptoms, answers, ranked }, 30_000);
  if (!j || j.unavailable || !Array.isArray(j.remedies)) return null;
  return j as AiExplanation;
}
