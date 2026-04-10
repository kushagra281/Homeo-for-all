// server/utils/supabase.ts
// Single Supabase client instance + all raw DB query helpers
// Uses JOIN queries to avoid N+1 problems

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Singleton ─────────────────────────────────────────────────────
let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_client) return _client;
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY missing from env");
  _client = createClient(url, key);
  return _client;
}

// ── In-memory cache (rubric data is static) ───────────────────────
const _cache = new Map<string, { value: any; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function fromCache<T>(key: string): T | null {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return hit.value as T;
}

export function toCache(key: string, value: any): void {
  _cache.set(key, { value, ts: Date.now() });
}

// ── JOIN query: rubrics + remedies in ONE call ────────────────────
// Returns every rubric-remedy pair for the given rubric codes,
// including rubric metadata — avoids two separate round trips.
export interface RubricRemedyRow {
  rubric_code:  string;
  rubric_label: string;
  body_system:  string;
  symptom_type: string;
  weight:       number;
  is_negative:  boolean;
  remedy_name:  string;
  grade:        number;
}

export async function fetchRubricRemedyRows(
  rubricCodes: string[]
): Promise<RubricRemedyRow[]> {
  if (!rubricCodes.length) return [];

  const cacheKey = "rrr:" + rubricCodes.sort().join(",");
  const cached = fromCache<RubricRemedyRow[]>(cacheKey);
  if (cached) return cached;

  // Single JOIN using Supabase foreign key relationship
  const { data, error } = await db()
    .from("rubric_remedies")
    .select(`
      rubric_code,
      remedy_name,
      grade,
      rubrics!inner (
        label,
        body_system,
        symptom_type,
        weight,
        is_negative
      )
    `)
    .in("rubric_code", rubricCodes)
    .order("grade", { ascending: false });

  if (error) {
    console.error("[DB] fetchRubricRemedyRows error:", error.message);
    return [];
  }

  const rows: RubricRemedyRow[] = (data || []).map((r: any) => ({
    rubric_code:  r.rubric_code,
    rubric_label: r.rubrics?.label || r.rubric_code,
    body_system:  r.rubrics?.body_system || "",
    symptom_type: r.rubrics?.symptom_type || "particular",
    weight:       r.rubrics?.weight ?? 1,
    is_negative:  r.rubrics?.is_negative ?? false,
    remedy_name:  r.remedy_name,
    grade:        r.grade,
  }));

  toCache(cacheKey, rows);
  return rows;
}

// ── Fetch rubrics by codes (cached) ──────────────────────────────
export interface RubricRow {
  code:         string;
  label:        string;
  parent_code:  string | null;
  body_system:  string;
  depth:        number;
  symptom_type: string;
  weight:       number;
  is_negative:  boolean;
}

export async function fetchRubricsByCodes(
  codes: string[]
): Promise<RubricRow[]> {
  if (!codes.length) return [];

  const cacheKey = "rbc:" + codes.sort().join(",");
  const cached = fromCache<RubricRow[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await db()
    .from("rubrics")
    .select("code, label, parent_code, body_system, depth, symptom_type, weight, is_negative")
    .in("code", codes);

  if (error) {
    console.error("[DB] fetchRubricsByCodes error:", error.message);
    return [];
  }

  const rows = (data || []) as RubricRow[];
  toCache(cacheKey, rows);
  return rows;
}

// ── Legacy fallback: symptoms table ──────────────────────────────
export async function fetchLegacySymptoms(
  terms: string[],
  category?: string
): Promise<Array<{ remedy: string; symptom: string; category: string; intensity: number }>> {
  const all: any[] = [];
  for (const term of terms.slice(0, 6)) {
    let q = db()
      .from("symptoms")
      .select("remedy, symptom, category, intensity")
      .ilike("symptom", `%${term}%`)
      .limit(200);
    if (category) q = q.ilike("category", `%${category}%`);
    const { data, error } = await q;
    if (error) console.error("[DB] fetchLegacySymptoms:", error.message);
    if (data) all.push(...data);
  }
  return all;
}

// ── Legacy fallback: remedy_symptoms table ────────────────────────
export async function fetchLegacyRemedySymptoms(
  terms: string[],
  category?: string
): Promise<Array<{ remedy_name: string; heading: string; symptom: string }>> {
  const all: any[] = [];
  for (const term of terms.slice(0, 6)) {
    let q = db()
      .from("remedy_symptoms")
      .select("remedy_name, heading, symptom")
      .ilike("symptom", `%${term}%`)
      .limit(300);
    if (category) q = q.ilike("heading", `%${category}%`);
    const { data, error } = await q;
    if (error) console.error("[DB] fetchLegacyRemedySymptoms:", error.message);
    if (data) all.push(...data);
  }
  return all;
}

// ── Profile queries ───────────────────────────────────────────────
export async function fetchProfile(userId: string): Promise<any | null> {
  const { data, error } = await db()
    .from("patients")
    .select("*")
    .eq("id", userId)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) console.error("[DB] fetchProfile:", error.message);
  return data || null;
}

export async function upsertProfileRow(
  userId: string,
  email: string,
  profile: Record<string, any>
): Promise<void> {
  const { error } = await db()
    .from("patients")
    .upsert(
      { id: userId, email, ...profile, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw new Error(error.message);
}

// ── Search history queries ────────────────────────────────────────
export async function insertSearchHistory(
  patientId: string,
  symptoms: string[],
  rubricsUsed: string[],
  results: any[],
  confidence: number
): Promise<void> {
  const { error } = await db().from("search_history").insert({
    patient_id:   patientId,
    symptoms,
    rubrics_used: rubricsUsed,
    results,
    confidence,
  });
  if (error) console.error("[DB] insertSearchHistory:", error.message);
}

export async function fetchSearchHistory(patientId: string): Promise<any[]> {
  const { data, error } = await db()
    .from("search_history")
    .select("id, symptoms, rubrics_used, results, confidence, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) { console.error("[DB] fetchSearchHistory:", error); return []; }
  return data || [];
}
