// server/utils/repertoryMemory.ts
// An in-memory RepertoryStore with the same behaviour as the database one. Used by the unit tests and
// by the offline Trials (server/trials/offline.ts), which read a dump of the repertory tables.

import { readFileSync } from "node:fs";
import { groupMatches } from "./keywords";
import {
  chapterMatches,
  type RepertoryNode, type RepertoryRubric, type RepertorySource, type RepertoryStore,
} from "./repertoryStore";

const node = (r: RepertoryRubric): RepertoryNode => ({
  id: r.id, parent_id: r.parent_id, chapter: r.chapter, rubric_text: r.rubric_text,
  full_path: r.full_path, depth: r.depth, n_remedies: r.n_remedies, child_count: r.child_count,
});

export function memoryRepertoryStore(
  rows: RepertoryRubric[],
  names: Record<string, string> | Map<string, string>,
  sources: RepertorySource[] = [],
): RepertoryStore {
  const nameMap = names instanceof Map ? names : new Map(Object.entries(names));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lower = new Map(rows.map((r) => [r.id, r.full_path.toLowerCase()]));
  const kids = new Map<number | null, RepertoryRubric[]>();
  for (const r of rows) {
    const list = kids.get(r.parent_id) || [];
    list.push(r);
    kids.set(r.parent_id, list);
  }

  return {
    async sources() { return sources; },
    async remedyNames() { return nameMap; },

    async query(q) {
      const hits = rows.filter((r) =>
        r.depth > 0 &&
        chapterMatches(r.chapter, q.chapterPats) &&
        q.groups.every((g) => groupMatches(lower.get(r.id)!, g)));
      hits.sort((a, b) => (q.order === "narrow" ? a.n_remedies - b.n_remedies : b.n_remedies - a.n_remedies) || a.id - b.id);
      return hits.slice(0, q.limit);
    },

    async byIds(ids) {
      return Array.from(new Set(ids)).map((id) => byId.get(id)).filter((r): r is RepertoryRubric => !!r);
    },

    async children(parentId, limit = 500) {
      return (kids.get(parentId) || [])
        .slice()
        .sort((a, b) => a.rubric_text.localeCompare(b.rubric_text) || a.id - b.id)
        .slice(0, limit)
        .map(node);
    },

    async byRemedies(q) {
      const include = Array.from(new Set(q.include)).slice(0, 5);
      if (!include.length) return [];
      const exclude = new Set(q.exclude || []);
      const min = Math.min(3, Math.max(1, Math.round(q.minGrade || 1)));
      const hits = rows.filter((r) => r.depth > 0 &&
        include.every((a) => (r.remedies[a] || 0) >= min) && !Object.keys(r.remedies).some((a) => exclude.has(a)));
      hits.sort((a, b) => a.n_remedies - b.n_remedies || a.id - b.id);
      const off = Math.max(0, q.offset || 0);
      return hits.slice(off, off + Math.min(200, Math.max(1, q.limit || 100)))
        .map((r) => ({ ...node(r), grades: Object.fromEntries(include.map((a) => [a, r.remedies[a]])) }));
    },

    async groupFrequency(groups) {
      const counts = groups.map((g) => {
        let n = 0;
        for (const r of rows) if (groupMatches(lower.get(r.id)!, g)) n++;
        return n;
      });
      return { counts, total: rows.length };
    },

    async searchText(words, limit) {
      const hits = rows.filter((r) => r.depth > 0 && words.every((w) => lower.get(r.id)!.includes(w)));
      hits.sort((a, b) => a.depth - b.depth || b.n_remedies - a.n_remedies || a.id - b.id);
      return hits.slice(0, limit).map(node);
    },
  };
}

/** Reads rubrics.ndjson + remedies.ndjson (one JSON object per line, as exported from the tables). */
export function loadMemoryStore(dir: string): RepertoryStore {
  const lines = (file: string) => readFileSync(`${dir}/${file}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const rubrics = lines("rubrics.ndjson") as RepertoryRubric[];
  const names: Record<string, string> = {};
  for (const r of lines("remedies.ndjson")) names[r.abbrev] = r.name;
  return memoryRepertoryStore(rubrics, names);
}
