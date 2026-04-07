// server/dal/supabase-dal.ts
// DATA ACCESS LAYER — ALL Supabase queries live here
// No other module queries Supabase directly.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Rubric, RubricRemedy, RemedyDetail } from "../../shared/types";

// ── Singleton client ─────────────────────────────────────────────
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) throw new Error("Supabase env vars missing");
  _client = createClient(url, key);
  return _client;
}

// ── RUBRIC queries ───────────────────────────────────────────────

/**
 * Full-text search rubrics by label.
 * Returns rubrics whose label matches any of the given terms.
 */
export async function searchRubricsByLabel(
  terms: string[],
  bodySystem?: string,
  limit = 30
): Promise<Rubric[]> {
  const db = getClient();
  const tsQuery = terms
    .map((t) => t.trim().replace(/\s+/g, " & "))
    .join(" | ");

  let q = db
    .from("rubrics")
    .select("code, label, parent_code, body_system, depth, symptom_type, weight, is_negative")
    .textSearch("label", tsQuery, { type: "websearch" })
    .limit(limit);

  if (bodySystem) q = q.eq("body_system", bodySystem.toUpperCase());

  const { data, error } = await q;
  if (error) {
    console.error("[DAL] searchRubricsByLabel error:", error.message);
    return [];
  }
  return (data || []) as Rubric[];
}

/**
 * Fetch rubrics by exact codes (used after AI returns rubric codes).
 */
export async function getRubricsByCodes(codes: string[]): Promise<Rubric[]> {
  if (!codes.length) return [];
  const db = getClient();
  const { data, error } = await db
    .from("rubrics")
    .select("code, label, parent_code, body_system, depth, symptom_type, weight, is_negative")
    .in("code", codes);

  if (error) {
    console.error("[DAL] getRubricsByCodes error:", error.message);
    return [];
  }
  return (data || []) as Rubric[];
}

/**
 * Fetch all child rubrics for given parent codes (for expanding hierarchy).
 */
export async function getChildRubrics(parentCodes: string[]): Promise<Rubric[]> {
  if (!parentCodes.length) return [];
  const db = getClient();
  const { data, error } = await db
    .from("rubrics")
    .select("code, label, parent_code, body_system, depth, symptom_type, weight, is_negative")
    .in("parent_code", parentCodes);

  if (error) {
    console.error("[DAL] getChildRubrics error:", error.message);
    return [];
  }
  return (data || []) as Rubric[];
}

// ── RUBRIC_REMEDY queries ────────────────────────────────────────

/**
 * Get all remedy-grade pairs for a set of rubric codes.
 * This is the core of the scoring engine input.
 */
export async function getRemediesForRubrics(
  rubricCodes: string[]
): Promise<RubricRemedy[]> {
  if (!rubricCodes.length) return [];
  const db = getClient();
  const { data, error } = await db
    .from("rubric_remedies")
    .select("rubric_code, remedy_name, grade, source")
    .in("rubric_code", rubricCodes)
    .order("grade", { ascending: false });

  if (error) {
    console.error("[DAL] getRemediesForRubrics error:", error.message);
    return [];
  }
  return (data || []) as RubricRemedy[];
}

// ── LEGACY symptom tables (for fallback while rubrics table grows) ──

/**
 * Search legacy `symptoms` table.
 * Columns: id, remedy(text), symptom(text), category(text), intensity(int)
 */
export async function searchLegacySymptoms(
  terms: string[],
  category?: string
): Promise<Array<{ remedy: string; symptom: string; category: string; intensity: number }>> {
  const db = getClient();
  const allRows: any[] = [];

  for (const term of terms.slice(0, 6)) {
    let q = db
      .from("symptoms")
      .select("remedy, symptom, category, intensity")
      .ilike("symptom", `%${term}%`)
      .limit(200);
    if (category) q = q.ilike("category", `%${category}%`);
    const { data, error } = await q;
    if (error) console.error("[DAL] legacy symptoms error:", error.message);
    if (data) allRows.push(...data);
  }
  return allRows;
}

/**
 * Search legacy `remedy_symptoms` table.
 * Columns: remedy_name(text), heading(text), symptom(text)
 */
export async function searchLegacyRemedySymptoms(
  terms: string[],
  category?: string
): Promise<Array<{ remedy_name: string; heading: string; symptom: string }>> {
  const db = getClient();
  const allRows: any[] = [];

  for (const term of terms.slice(0, 6)) {
    let q = db
      .from("remedy_symptoms")
      .select("remedy_name, heading, symptom")
      .ilike("symptom", `%${term}%`)
      .limit(300);
    if (category) q = q.ilike("heading", `%${category}%`);
    const { data, error } = await q;
    if (error) console.error("[DAL] legacy remedy_symptoms error:", error.message);
    if (data) allRows.push(...data);
  }
  return allRows;
}

// ── REMEDY DETAIL queries ────────────────────────────────────────

export async function getRemedyDetails(
  names: string[]
): Promise<RemedyDetail[]> {
  if (!names.length) return [];
  const db = getClient();
  const { data, error } = await db
    .from("remedies")
    .select("name, abbreviation, common_name, kingdom, miasm")
    .in("name", names);

  if (error) {
    console.error("[DAL] getRemedyDetails error:", error.message);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.name.toLowerCase().replace(/\s+/g, "-"),
    name: r.name,
    abbreviation: r.abbreviation,
    category: "General",
    condition: "",
    description: `${r.name} (${r.abbreviation || r.name}) — ${r.kingdom || "homeopathic"} remedy.`,
    dosage: "30C — 3 pellets, three times daily for 5 days",
    potencies: ["6C", "30C", "200C", "1M"],
    modalities: { better: [], worse: [] },
    kingdom: r.kingdom,
    miasm: r.miasm,
  }));
}

// ── PROFILE queries ──────────────────────────────────────────────

export async function getProfile(userId: string): Promise<any | null> {
  const db = getClient();
  const { data, error } = await db
    .from("patients")
    .select("*")
    .eq("id", userId)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) console.error("[DAL] getProfile error:", error.message);
  return data || null;
}

export async function upsertProfile(userId: string, email: string, profile: any): Promise<void> {
  const db = getClient();
  const { error } = await db.from("patients").upsert(
    { id: userId, email, ...profile, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
}

// ── SEARCH HISTORY queries ───────────────────────────────────────

export async function saveSearchHistory(
  patientId: string,
  symptoms: string[],
  rubricsUsed: string[],
  results: any[],
  confidence: number
): Promise<void> {
  const db = getClient();
  const { error } = await db.from("search_history").insert({
    patient_id:   patientId,
    symptoms,
    rubrics_used: rubricsUsed,
    results,
    confidence,
  });
  if (error) console.error("[DAL] saveSearchHistory error:", error.message);
}

export async function getSearchHistory(patientId: string): Promise<any[]> {
  const db = getClient();
  const { data, error } = await db
    .from("search_history")
    .select("id, symptoms, rubrics_used, results, confidence, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) { console.error("[DAL] getSearchHistory:", error); return []; }
  return data || [];
}
