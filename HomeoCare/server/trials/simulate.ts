// Patient Trials: simulated patients go through the app's own interview and the real search, and the result is compared with
// the "direct" Trials (run.ts), which hand the textbook symptom words straight to the search.
//
//   Live database (as run.ts):  SCRAPER_SUPABASE_URL / SCRAPER_SUPABASE_KEY, optional REPERTORY_ENGINE=off|on|hybrid
//   Offline (no database):      REPERTORY_DUMP=<folder with rubrics.ndjson + remedies.ndjson>   (uses the graded repertory)
//   RUNS=5 (typical patients per case), ONLY=<regex on case name>, VERBOSE=1 (print the search words of every patient),
//   NO_CATEGORY=1 (patients do not pick a category, so no chapter filter: shows what the category costs or gains)
//
// Four columns per case: direct, typed words only (the patient skips the interview), perfect patient (confirms every true
// fact) and typical patient (forgets, misclicks, skips; RUNS different seeded patients, shown as how many found the
// remedy in the top 5).
import { appendFileSync } from "node:fs";
import { CASES } from "./cases";
import { PERSONAS } from "./personas";
import { PERFECT, TYPICAL, interview } from "./patient";
import { remedyMatches } from "./match";

const rankOf = (top: string[], expect: string[]) => top.findIndex((n) => expect.some((w) => remedyMatches(n, w))) + 1;   // 0 = not in top 5

(async () => {
  const dump = process.env.REPERTORY_DUMP;
  if (dump) {
    process.env.REPERTORY_ENGINE ||= "on";
    process.env.AI_SYNONYMS = "off";
  } else if (!process.env.SCRAPER_SUPABASE_URL || !process.env.SCRAPER_SUPABASE_KEY) {
    console.error("Set REPERTORY_DUMP (offline) or SCRAPER_SUPABASE_URL / SCRAPER_SUPABASE_KEY"); process.exit(2);
  }
  const { search } = await import("../services/searchService");
  const { hasGroqKey } = await import("../utils/groq");
  if (dump) {
    const { loadMemoryStore } = await import("../utils/repertoryMemory");
    const { setRepertoryStore } = await import("../utils/repertoryStore");
    setRepertoryStore(loadMemoryStore(dump));
  }
  const ai = hasGroqKey() && process.env.AI_SYNONYMS !== "off";
  const runs = Math.max(1, Number(process.env.RUNS) || 5);
  const only = process.env.ONLY ? new RegExp(process.env.ONLY, "i") : null;
  const noCategory = process.env.NO_CATEGORY === "1";

  const log = console.log, err = console.error, warn = console.warn;
  console.log = console.error = console.warn = () => {};   // silence the engine's own logging
  let noResult = 0;
  const top5 = async (symptoms: string[], filters: { symptom_location?: string }, generals: string[] = [], answers: string[] = []) => {
    if (ai) await new Promise((r) => setTimeout(r, 2500));   // stay under the model's request limit
    try {
      const res = await search({ symptoms, filters, generals, answers });
      return [...res.remedies, ...res.alternatives].slice(0, 5).map((r) => r.name);
    } catch (e: any) {
      // offline there is no scraper database: where the graded repertory finds nothing, production falls back to it
      if (dump && /are not set/.test(String(e?.message))) { noResult++; return [] as string[]; }
      throw e;
    }
  };

  const rows: string[] = [];
  const total = { direct: [0, 0, 0], typed: [0, 0, 0], perfect: [0, 0, 0], typical: [0, 0, 0] };   // top1, top3, top5 (typical: summed over runs)
  const bump = (t: number[], rank: number) => { if (rank === 1) t[0]++; if (rank >= 1 && rank <= 3) t[1]++; if (rank >= 1) t[2]++; };
  let n = 0, errors = 0, questions = 0;
  const gaps = new Map<string, string[]>(), unknown = new Map<string, string[]>();
  const verbose: string[] = [];

  for (const base of PERSONAS) {
    const persona = noCategory ? { ...base, category: undefined } : base;
    const c = CASES[persona.n - 1];
    if (!c || !c.name.startsWith(persona.of)) { console.error(`persona ${persona.n} does not match case "${c?.name}"`); process.exit(2); }
    if (only && !only.test(c.name)) continue;
    try {
      const direct = rankOf(await top5(c.symptoms, {}), c.expect);
      // the patient skips the interview: only what was typed (and the category) is searched
      const typed = rankOf(await top5([...persona.typed, ...(persona.category ? [`category: ${persona.category}`] : [])], persona.category ? { symptom_location: persona.category } : {}), c.expect);
      const perfectIv = interview(persona, PERFECT);
      const perfect = rankOf(await top5(perfectIv.symptoms, perfectIv.filters, perfectIv.generals, perfectIv.answers), c.expect);
      const typicalRanks: number[] = [];   // added to the totals only when every run of the case finished (a failed search skips the whole case)
      for (let r = 0; r < runs; r++) {
        const iv = interview(persona, TYPICAL, r);
        const rank = rankOf(await top5(iv.symptoms, iv.filters, iv.generals, iv.answers), c.expect);
        typicalRanks.push(rank);
      }
      const found = typicalRanks.filter((r) => r >= 1).length;
      for (const r of typicalRanks) bump(total.typical, r);
      n++; questions += perfectIv.asked.length;
      bump(total.direct, direct); bump(total.typed, typed); bump(total.perfect, perfect);
      for (const g of perfectIv.gaps) gaps.set(g, [...(gaps.get(g) || []), c.expect[0]]);
      for (const g of perfectIv.unknown) unknown.set(g, [...(unknown.get(g) || []), c.expect[0]]);
      const cell = (r: number) => (r ? `#${r}` : "-");
      rows.push(`| ${c.name} | ${c.expect.join(" / ")} | ${cell(direct)} | ${cell(typed)} | ${cell(perfect)} (${perfectIv.asked.length} Q) | ${found}/${runs} |`);
      if (process.env.VERBOSE) verbose.push(`${c.name}\n   typed: ${persona.typed.join(" | ")}  [${persona.category || "no category"}]\n   sent:  ${perfectIv.symptoms.join(" | ")}`);
    } catch (e: any) { errors++; rows.push(`| ${c.name} | ${c.expect.join(" / ")} | ERROR ${e?.message || e} | | | |`); }
  }
  console.log = log; console.error = err; console.warn = warn;

  const pct = (x: number, d: number) => `${x}/${d} (${d ? Math.round((x / d) * 100) : 0}%)`;
  const line = (label: string, t: number[], d: number) => `| ${label} | ${pct(t[0], d)} | ${pct(t[1], d)} | ${pct(t[2], d)} |`;
  const listGaps = (m: Map<string, string[]>) => [...m.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `${k} (${v.length}: ${[...new Set(v)].slice(0, 3).join(", ")}${v.length > 3 ? ", ..." : ""})`).join("; ");
  const out = [
    `## Patient Trials: ${n} cases, ${runs} typical patients each · engine: ${dump ? "graded repertory (offline dump)" : process.env.REPERTORY_ENGINE || "off"} · AI synonyms: ${ai ? "ON" : "off"}`,
    "",
    "| Who | Top 1 | Top 3 | Top 5 |", "|---|---|---|---|",
    line("Direct (textbook words straight to the search)", total.direct, n),
    line("Typed words only (the patient skips the interview)", total.typed, n),
    line("Perfect patient (the interview, every true fact confirmed)", total.perfect, n),
    line(`Typical patient (forgets, misclicks, skips; ${runs} runs)`, total.typical, n * runs),
    "",
    `Questions asked per patient: ${n ? (questions / n).toFixed(1) : 0} on average (the interview stops at 20 at most). Built-in question bank only; the AI's own questions are not simulated.`,
    "",
    "| Case | Expected | Direct | Typed only | Perfect patient | Typical patients in top 5 |", "|---|---|---|---|---|---|", ...rows,
    "",
    gaps.size ? `**True facts the interview never offered (gaps in the question bank):** ${listGaps(gaps)}` : "**No gaps: every true fact was offered by some question.**",
    unknown.size ? `\n**Facts that are not an option anywhere in the bank:** ${listGaps(unknown)}` : "",
    noResult ? `\n${noResult} searches found nothing in the graded repertory (offline; production falls back to the Boericke/Kent search there). They count as misses.` : "",
    noCategory ? "\nCategory off: the patients did not pick a category, so no chapter filter was applied." : "",
    errors ? `\n**Errors: ${errors}**` : "",
    process.env.VERBOSE ? "\n```\n" + verbose.join("\n") + "\n```" : "",
  ].join("\n");
  console.log(out);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
  process.exit(errors ? 1 : 0);   // a measurement, not a pass/fail gate
})();
