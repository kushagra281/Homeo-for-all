// server/services/remedyRelations.ts
// Remedy relationships (antidotes, complementary, follows well, incompatible, compare) read out of the
// "Relationship" paragraph of the materia medica text, e.g. Boericke's
//   "Antidotes: Camph; Ipec; Nit ac; Nux. Complementary: Bell; Rhus; Lycop; Silica. ... Incompatible: Bry; ..."
// Pure functions. The text is prose, so this only lifts out short remedy-like items; the full text stays
// available to read. A name that could mean two remedies ("Rhus") is left unresolved rather than guessed.

export type RelKind = "antidotes" | "complementary" | "follows" | "incompatible" | "compare";
export const REL_KINDS: RelKind[] = ["complementary", "follows", "antidotes", "incompatible", "compare"];

const LABELS: Array<[RegExp, RelKind]> = [
  [/^antidote[sd]?(?: by)?$/i, "antidotes"],
  [/^complementary$/i, "complementary"],
  [/^(?:follows(?: well)?|followed (?:well )?by|follows well after)$/i, "follows"],
  [/^(?:incompatible|inimical)$/i, "incompatible"],
  [/^compare$/i, "compare"],
];
const LABEL_RE = /(Antidotes?(?: by)?|Antidoted by|Complementary|Follows(?: well)?|Followed (?:well )?by|Incompatible|Inimical|Compare)\s*:/gi;

export type Relations = Partial<Record<RelKind, string[]>>;

/**
 * Splits at ';' and at '.' that ends a sentence, outside brackets. A period followed by a lowercase letter is
 * part of an abbreviation ("Nit. ac.", "Calc. brom."), not a boundary.
 */
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0; let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    if (ch === ")" && depth > 0) depth--;
    const abbrev = ch === "." && /^\s*[a-z]/.test(s.slice(i + 1));
    if (depth === 0 && (ch === ";" || (ch === "." && !abbrev))) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** "Calc brom (removes ...)" -> "Calc brom"; prose and notes -> null. */
function token(item: string): string | null {
  const head = item.split("(")[0].split("--")[0].split(",")[0].replace(/\./g, " ").replace(/\s+/g, " ").trim().replace(/^and\s+/i, "");
  if (!/^[A-Za-z][A-Za-z '\-]{1,23}$/.test(head)) return null;
  const words = head.split(/\s+/);
  if (words.length > 3) return null;
  // a sentence fragment such as "Calcar is useful after Sulphur" is not a remedy name
  if (words.some((w) => /^(is|are|was|were|should|not|after|before|when|where|useful|often|follows|given|the|of|in|to|for|with)$/i.test(w))) return null;
  return head;
}

export function parseRelationships(text: string): Relations {
  const marks: Array<{ at: number; end: number; kind: RelKind }> = [];
  for (const m of text.matchAll(LABEL_RE)) {
    const kind = LABELS.find(([re]) => re.test(m[1]))?.[1];
    if (kind) marks.push({ at: m.index!, end: m.index! + m[0].length, kind });
  }
  const out: Relations = {};
  marks.forEach((mk, i) => {
    const body = text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : text.length);
    // a label's list ends at the first sentence that is not an item (the prose after "Bry;")
    const list = out[mk.kind] || (out[mk.kind] = []);
    for (const part of splitTop(body)) {
      const t = token(part);
      if (t && !list.some((x) => x.toLowerCase() === t.toLowerCase())) list.push(t);
      if (list.length >= 40) break;
    }
  });
  for (const k of REL_KINDS) if (out[k] && out[k]!.length === 0) delete out[k];
  return out;
}

export interface RemedyRef { abbrev: string; name: string }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

// Old shorthand that is ambiguous by prefix but, in practice, always means one remedy.
// Used only when that abbreviation exists in the book being read.
const SHORTHAND: Record<string, string> = {
  rhus: "Rhus-t.", nux: "Nux-v.", silica: "Sil.", hepar: "Hep.", mercur: "Merc.", calcar: "Calc.", sulphur: "Sulph.",
  pulsat: "Puls.", arsen: "Ars.", bryon: "Bry.", phosph: "Phos.", natrum: "Nat-m.", ignat: "Ign.",
};

/** The repertory remedy a materia medica abbreviation stands for, or null when unknown or ambiguous. */
export function resolveRemedy(tok: string, remedies: RemedyRef[]): RemedyRef | null {
  const n = norm(tok);
  if (n.length < 3) return null;
  const alias = SHORTHAND[n];
  if (alias) { const r = remedies.find((x) => x.abbrev === alias); if (r) return r; }
  const exact = remedies.filter((r) => norm(r.abbrev) === n);
  if (exact.length === 1) return exact[0];
  const byName = remedies.filter((r) => norm(r.name).startsWith(n));
  if (byName.length === 1) return byName[0];
  // "Lycop" = Lyc. (abbreviation is a prefix of the token) among the names that start with it
  const both = byName.filter((r) => n.startsWith(norm(r.abbrev)));
  if (both.length === 1) return both[0];
  // "Calc brom" = Calc-br.: a longer abbreviation that the token starts with, when only one fits
  const longAbbrev = remedies.filter((r) => norm(r.abbrev).length >= 4 && n.startsWith(norm(r.abbrev)));
  if (longAbbrev.length === 1) return longAbbrev[0];
  return null;
}

export interface ResolvedRelation { token: string; abbrev?: string; name?: string }
export function resolveRelations(rel: Relations, remedies: RemedyRef[], self?: string): Partial<Record<RelKind, ResolvedRelation[]>> {
  const out: Partial<Record<RelKind, ResolvedRelation[]>> = {};
  for (const k of REL_KINDS) {
    const items = rel[k];
    if (!items) continue;
    out[k] = items.map((t) => {
      const r = resolveRemedy(t, remedies);
      return r && r.abbrev !== self ? { token: t, abbrev: r.abbrev, name: r.name } : { token: t };
    });
  }
  return out;
}
