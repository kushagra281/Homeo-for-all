// server/services/remedyProfile.ts
// The materia medica text for a repertory remedy, from the scraper database (remedies + remedy_sections).
// The two sources spell names alike but not always identically ("Pulsatilla Pratensis" / "PULSATILLA"),
// so the match is: exact (ignoring case), else the shortest name that starts with the same first word.

import { scraperDB, fromCache, toCache } from "../utils/supabase";

export interface ProfileCandidate { id: number; slug: string; name: string; common_name: string | null; source_site: string | null }
export interface RemedyProfile {
  name: string; common_name: string; source: string;
  sections: Array<{ heading: string; content: string }>;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Best candidate for a remedy name, or null. Pure, so it can be tested. */
export function pickProfile(name: string, candidates: ProfileCandidate[]): ProfileCandidate | null {
  const want = norm(name);
  if (!want) return null;
  const exact = candidates.filter((c) => norm(c.name) === want);
  const pool = exact.length ? exact : candidates.filter((c) => norm(c.name).split(" ")[0] === want.split(" ")[0]);
  // prefer the general text (materiamedica.info) over a single-lecture entry such as Kent's, then the shortest name
  pool.sort((a, b) => Number(/kent/i.test(a.source_site || "")) - Number(/kent/i.test(b.source_site || "")) || a.name.length - b.name.length);
  return pool[0] || null;
}

export async function remedyProfile(name: string): Promise<RemedyProfile | null> {
  const key = "rep:profile:" + norm(name);
  const hit = fromCache<RemedyProfile | "none">(key);
  if (hit) return hit === "none" ? null : hit;
  const first = norm(name).split(" ")[0];
  if (!first || first.length < 3) return null;
  const db = scraperDB();
  const { data: cands, error } = await db.from("remedies").select("id, slug, name, common_name, source_site")
    .ilike("name", `${first}%`).limit(40);
  if (error) throw new Error("remedy profile: " + error.message);
  const best = pickProfile(name, (cands || []) as ProfileCandidate[]);
  if (!best) { toCache(key, "none"); return null; }
  const { data: secs, error: e2 } = await db.from("remedy_sections").select("heading, content, heading_order")
    .eq("remedy_id", best.id).order("heading_order", { ascending: true }).limit(60);
  if (e2) throw new Error("remedy profile: " + e2.message);
  const profile: RemedyProfile = {
    name: best.name, common_name: best.common_name || "", source: best.source_site || "",
    sections: ((secs || []) as any[]).map((s) => ({ heading: String(s.heading), content: String(s.content) })),
  };
  toCache(key, profile);
  return profile;
}
