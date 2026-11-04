// Does a remedy name from the database match the remedy a trial case expects?
//   "Natrum muriaticum"  → both words must agree (first 4 letters, any order), so Natrum sulphuricum does not match
//   "Sulphur" (one word) → the first word of the remedy must be exactly that word (Sulphur iodatum counts, Sulphuricum acidum does not)
// Names differ between books (Pulsatilla nigricans is "Pulsatilla pratensis" in Boericke), so there is a small alias list.
const ALIASES: Record<string, string> = {
  "pulsatilla nigricans": "pulsatilla pratensis",
  "glonoin": "glonoinum",
};

const words = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean);

export function remedyMatches(got: string, want: string): boolean {
  const w = words(ALIASES[want.toLowerCase()] || want);
  const g = words(got);
  if (!w.length || !g.length) return false;
  if (w.length === 1) return g[0] === w[0];
  if (g.length < 2) return false;
  const key = (a: string[]) => a.slice(0, 2).map((x) => x.slice(0, 4)).sort().join("|");
  return key(g) === key(w);
}
