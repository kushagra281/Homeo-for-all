// server/utils/supabase.ts
// DATA ACCESS LAYER — manages TWO Supabase clients:
//   mainDB()    → zlsinlcskirptxgqkzuw  (patients, profiles, history)
//   scraperDB() → rtfjnfepikhahzospnqq  (rubrics×17755, rubric_remedies×23564, remedy_symptoms×17678)

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Cache (rubric data is static — safe to cache 15 min) ─────────
const _cache = new Map<string, { value: any; ts: number }>();
const TTL = 15 * 60 * 1000;
export function fromCache<T>(key: string): T | null {
  const h = _cache.get(key);
  if (!h || Date.now() - h.ts > TTL) { _cache.delete(key); return null; }
  return h.value as T;
}
export function toCache(key: string, value: any) {
  _cache.set(key, { value, ts: Date.now() });
}

// ── Main DB ───────────────────────────────────────────────────────
let _main: SupabaseClient | null = null;
export function mainDB(): SupabaseClient {
  if (_main) return _main;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Main SUPABASE_URL / SUPABASE_ANON_KEY missing");
  _main = createClient(url, key);
  return _main;
}

// ── Scraper DB ────────────────────────────────────────────────────
let _scraper: SupabaseClient | null = null;
export function scraperDB(): SupabaseClient {
  if (_scraper) return _scraper;
  const url = process.env.SCRAPER_SUPABASE_URL || "";
  const key = process.env.SCRAPER_SUPABASE_KEY || "";
  if (!url || !key) {
    console.warn("[DB] SCRAPER_SUPABASE_URL/KEY not set — using main DB as fallback");
    return mainDB();
  }
  _scraper = createClient(url, key);
  console.log("[DB] Scraper DB connected:", url);
  return _scraper;
}

// ================================================================
// SCRAPER DB — rubrics schema:
//   rubrics(id int, parent_id int, section text, rubric_text text,
//           full_path text, depth int, symptom_type text, is_eliminating bool)
//   rubric_remedies(id int, rubric_id int, remedy_id int,
//                   remedy_name text, grade int, source text)
//   remedy_symptoms(id int, remedy_id int, remedy_name text,
//                   heading text, symptom text, symptom_order int)
// ================================================================

export interface ScraperRubric {
  id:             number;
  parent_id:      number | null;
  section:        string;
  rubric_text:    string;
  full_path:      string;
  depth:          number;
  symptom_type:   string;   // 'mental' | 'general' | 'particular'
  is_eliminating: boolean;
}

export interface ScraperRemedyRow {
  rubric_id:    number;
  rubric_text:  string;
  full_path:    string;
  section:      string;
  symptom_type: string;
  depth:        number;
  remedy_name:  string;
  grade:        number;
}

/**
 * Search scraper rubrics by symptom terms.
 * Searches rubric_text and full_path using ILIKE.
 */
export async function searchScraperRubrics(
  terms: string[],
  section?: string,
  limit = 40
): Promise<ScraperRubric[]> {
  if (!terms.length) return [];

  // Synonym map for common homeopathy terms
  const SYNONYMS: Record<string, string[]> = {
    "fever": ["febrile","temperature","pyrexia","heat"],
    "cough": ["coughing","tussis","expectoration"],
    "headache": ["cephalgia","head pain","migraine","hemicrania"],
    "anxiety": ["anxious","worry","apprehension","nervousness"],
    "fear": ["fright","phobia","terror","dread"],
    "restless": ["restlessness","agitation","fidgety","tossing"],
    "burning": ["burns","smarting","scalding","heat sensation"],
    "itching": ["itches","pruritus","scratching"],
    "nausea": ["nauseous","queasiness","sick feeling"],
    "diarrhea": ["diarrhoea","loose stool","dysentery"],
    "constipation": ["constipated","difficult stool","no stool"],
    "vomiting": ["vomit","retching","throwing up"],
    "weakness": ["debility","prostration","exhaustion","fatigue"],
    "pain": ["painful","aching","sore","hurts"],
    "swelling": ["swollen","oedema","puffiness","bloated"],
    "thirst": ["thirsty","desire for water","craving water"],
    "cold": ["chilly","coldness","chilliness"],
    "heat": ["warmth","hot","flushed","burning hot"],
    "night": ["nocturnal","midnight","evening"],
    "morning": ["on waking","early morning","rising"],
    "skin": ["cutaneous","dermal","eruption"],
    "rash": ["eruption","hives","urticaria","exanthem"],
    "throat": ["pharynx","larynx","tonsil"],
    "stomach": ["gastric","epigastric","abdomen"],
    "back": ["lumbar","spine","dorsal","sacral"],
    "joint": ["joints","articular","arthralgia"],
    "chest": ["thorax","pectoral","breast","lung"],
    "mind": ["mental","emotional","psychological","mood"],
  };

  const STOP = new Set(["worse","better","after","before","from","with","and","the","for","more","less","very","also","when","that","this","have","been","into","over","some","during","while"]);

  // Extract keywords + expand with synonyms
  const baseKeywords = [...new Set(
    terms.flatMap((t) =>
      t.split(/[\s,;]+/)
        .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
        .filter((w) => w.length > 3 && !STOP.has(w))
    )
  )];

  // Add synonyms for each keyword
  const expandedKeywords = [...new Set([
    ...baseKeywords,
    ...baseKeywords.flatMap((k) => SYNONYMS[k] || []),
  ])].slice(0, 15);

  // Combine with original full terms for broader coverage
  const searchTerms = [...new Set([
    ...expandedKeywords,
    ...terms.map(t => t.toLowerCase().trim()).slice(0, 4),
  ])];

  const cacheKey = `sr:${searchTerms.slice(0,8).join("|")}:${section || ""}`;
  const cached = fromCache<ScraperRubric[]>(cacheKey);
  if (cached) return cached;

  const db = scraperDB();
  const allRows: ScraperRubric[] = [];

  console.log(`[DB] Scraper rubric keywords:`, expandedKeywords.slice(0, 8).join(", "));

  for (const term of searchTerms.slice(0, 10)) {
    let q = db
      .from("rubrics")
      .select("id, parent_id, section, rubric_text, full_path, depth, symptom_type, is_eliminating")
      .or(`rubric_text.ilike.%${term}%,full_path.ilike.%${term}%`)
      .order("depth", { ascending: false })
      .limit(limit);
    if (section) q = q.ilike("section", `%${section}%`);

    const { data, error } = await q;
    if (error) console.error("[DB] searchScraperRubrics:", error.message);
    if (data) allRows.push(...(data as ScraperRubric[]));
  }

  // Deduplicate by id
  const seen = new Set<number>();
  const unique = allRows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id); return true;
  });

  toCache(cacheKey, unique);
  console.log(`[DB] Found ${unique.length} rubrics in scraper DB`);
  return unique;
}

/**
 * Fetch remedy-rubric rows for given rubric IDs.
 * Uses JOIN for single round-trip. Falls back to two queries if JOIN fails.
 */
export async function getRemediesForRubricIds(
  rubricIds: number[]
): Promise<ScraperRemedyRow[]> {
  if (!rubricIds.length) return [];

  const cacheKey = `rr:${[...rubricIds].sort().join(",")}`;
  const cached = fromCache<ScraperRemedyRow[]>(cacheKey);
  if (cached) return cached;

  const db = scraperDB();

  // Try JOIN first
  const { data, error } = await db
    .from("rubric_remedies")
    .select(`
      rubric_id,
      remedy_name,
      grade,
      rubrics!inner (
        rubric_text,
        full_path,
        section,
        symptom_type,
        depth
      )
    `)
    .in("rubric_id", rubricIds)
    .order("grade", { ascending: false });

  if (!error && data) {
    const rows: ScraperRemedyRow[] = data.map((r: any) => ({
      rubric_id:    r.rubric_id,
      rubric_text:  r.rubrics?.rubric_text || "",
      full_path:    r.rubrics?.full_path || "",
      section:      r.rubrics?.section || "",
      symptom_type: r.rubrics?.symptom_type || "particular",
      depth:        r.rubrics?.depth || 1,
      remedy_name:  r.remedy_name,
      grade:        r.grade,
    }));
    toCache(cacheKey, rows);
    console.log(`[DB] ${rows.length} rubric_remedy rows fetched`);
    return rows;
  }

  // Fallback: two separate queries
  console.warn("[DB] JOIN failed, using two-query fallback:", error?.message);
  const [rubricsRes, remediesRes] = await Promise.all([
    db.from("rubrics").select("id, rubric_text, full_path, section, symptom_type, depth").in("id", rubricIds),
    db.from("rubric_remedies").select("rubric_id, remedy_name, grade").in("rubric_id", rubricIds).order("grade", { ascending: false }),
  ]);

  const rubricMap = new Map<number, any>(
    (rubricsRes.data || []).map((r: any) => [r.id, r])
  );

  const rows: ScraperRemedyRow[] = (remediesRes.data || []).map((r: any) => {
    const rub = rubricMap.get(r.rubric_id) || {};
    return {
      rubric_id: r.rubric_id,
      rubric_text: rub.rubric_text || "",
      full_path: rub.full_path || "",
      section: rub.section || "",
      symptom_type: rub.symptom_type || "particular",
      depth: rub.depth || 1,
      remedy_name: r.remedy_name,
      grade: r.grade,
    };
  });

  toCache(cacheKey, rows);
  return rows;
}

/**
 * Search remedy_symptoms in scraper DB (17,678 rows).
 */
export async function searchScraperRemedySymptoms(
  terms: string[],
  section?: string
): Promise<Array<{ remedy_name: string; heading: string; symptom: string }>> {
  const db = scraperDB();
  const all: any[] = [];

  // Search with section filter first
  for (const term of terms.slice(0, 6)) {
    let q = db.from("remedy_symptoms")
      .select("remedy_name, heading, symptom")
      .ilike("symptom", `%${term}%`)
      .not("remedy_name", "is", null)
      .limit(200);
    if (section) q = q.ilike("heading", `%${section}%`);
    const { data, error } = await q;
    if (error) console.error("[DB] searchScraperRemedySymptoms:", error.message);
    if (data) all.push(...data.filter((r: any) => r.remedy_name));
  }

  // If section filter returned nothing, try WITHOUT section filter
  if (all.length === 0 && section) {
    console.log("[DB] No remedy_symptoms with section filter — retrying without section");
    for (const term of terms.slice(0, 6)) {
      const { data, error } = await db.from("remedy_symptoms")
        .select("remedy_name, heading, symptom")
        .ilike("symptom", `%${term}%`)
        .not("remedy_name", "is", null)
        .limit(200);
      if (error) console.error("[DB] searchScraperRemedySymptoms (no section):", error.message);
      if (data) all.push(...data.filter((r: any) => r.remedy_name));
    }
  }

  console.log(`[DB] remedy_symptoms found ${all.length} rows`);
  return all;
}

// ================================================================
// MAIN DB QUERIES
// ================================================================

export async function fetchProfile(userId: string): Promise<any | null> {
  const { data, error } = await mainDB().from("patients").select("*").eq("id", userId).single();
  if (error?.code === "PGRST116") return null;
  if (error) console.error("[DB] fetchProfile:", error.message);
  return data || null;
}

export async function upsertProfileRow(userId: string, email: string, profile: Record<string, any>): Promise<void> {
  // Build safe profile object — only include columns that are not undefined/null empty
  const safeProfile: Record<string, any> = { id: userId, email, updated_at: new Date().toISOString() };

  const ALLOWED_COLUMNS = [
    "name","age","gender","height_cm","weight_kg","blood_group",
    "diabetes","blood_pressure","obesity","cholesterol","thyroid","asthma",
    "allergy","gastritis","constipation","pcod","arthritis","kidney",
    "heart_disease","migraine","skin_condition","depression_anxiety","hair_fall",
    "injury_history","other_conditions","chronic_conditions","current_medications",
    "dietary_preference","health_notes",
  ];

  for (const col of ALLOWED_COLUMNS) {
    if (profile[col] !== undefined && profile[col] !== null) {
      safeProfile[col] = profile[col];
    }
  }

  console.log("[DB] Upserting profile for userId:", userId, "columns:", Object.keys(safeProfile).length);

  const { error } = await mainDB().from("patients").upsert(safeProfile, { onConflict: "id" });
  if (error) {
    // If error is about missing column, retry without that column
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      const col = error.message.match(/"([^"]+)"/)?.[1];
      if (col) {
        console.warn(`[DB] Column ${col} missing — retrying without it`);
        delete safeProfile[col];
        const { error: error2 } = await mainDB().from("patients").upsert(safeProfile, { onConflict: "id" });
        if (error2) throw new Error(error2.message);
        return;
      }
    }
    throw new Error(error.message);
  }
}

export async function insertSearchHistory(patientId: string, symptoms: string[], rubricsUsed: string[], results: any[], confidence: number): Promise<void> {
  const { error } = await mainDB().from("search_history").insert({ patient_id: patientId, symptoms, rubrics_used: rubricsUsed, results, confidence });
  if (error) console.error("[DB] insertSearchHistory:", error.message);
}

export async function fetchSearchHistory(patientId: string): Promise<any[]> {
  const { data, error } = await mainDB().from("search_history")
    .select("id, symptoms, rubrics_used, results, confidence, created_at")
    .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20);
  if (error) { console.error("[DB] fetchSearchHistory:", error); return []; }
  return data || [];
}

// Legacy fallback
export async function fetchLegacySymptoms(terms: string[], category?: string): Promise<any[]> {
  const all: any[] = [];
  for (const term of terms.slice(0, 5)) {
    let q = mainDB().from("symptoms").select("remedy, symptom, category, intensity").ilike("symptom", `%${term}%`).limit(150);
    if (category) q = q.ilike("category", `%${category}%`);
    const { data, error } = await q;
    if (error) console.error("[DB] fetchLegacySymptoms:", error.message);
    if (data) all.push(...data);
  }
  return all;
}
