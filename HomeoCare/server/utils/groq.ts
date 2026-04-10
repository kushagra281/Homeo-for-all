// server/utils/groq.ts
// Groq AI client — single instance, used only by rubricService and reportService

import OpenAI from "openai";

let _groq: OpenAI | null = null;

export function groq(): OpenAI {
  if (_groq) return _groq;
  _groq = new OpenAI({
    apiKey: process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY || "",
    baseURL: "https://api.groq.com/openai/v1",
  });
  return _groq;
}

export function hasGroqKey(): boolean {
  return !!(process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY);
}
