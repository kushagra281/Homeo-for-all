// Runs the Trials cases against the graded repertory held IN MEMORY (no database, no AI, no network).
//   REPERTORY_DUMP=<folder with rubrics.ndjson + remedies.ndjson>  npx tsx server/trials/offline.ts
// The dump is an export of the repertory_* tables. Optional: TUNE='{"perUnit":8}' overrides engine options,
// and VERBOSE=1 prints the rubrics used for every case.
import { CASES } from "./cases";
import { remedyMatches } from "./match";
import { loadMemoryStore } from "../utils/repertoryMemory";
import { findRubrics, toRubricMatches, toScoringRows, unitKeywords, DEFAULT_OPTIONS, type EngineOptions } from "../services/repertoryEngine";
import { scoreRemedies } from "../services/scoringService";
import { sectionPatterns } from "../utils/sections";

export async function runOffline(dir: string, tune: Partial<EngineOptions> = {}, verbose = false, only?: RegExp) {
  const store = loadMemoryStore(dir);
  const names = await store.remedyNames();
  const o = { ...DEFAULT_OPTIONS, ...tune };
  let top1 = 0, top3 = 0, top5 = 0;
  const missed: string[] = [];
  const lines: string[] = [];
  for (const c of CASES.filter((x) => !only || only.test(x.name))) {
    const units = unitKeywords(c.symptoms);
    const rubrics = await findRubrics(units, store, sectionPatterns(undefined), o);
    const { remedies } = scoreRemedies(toRubricMatches(rubrics), toScoringRows(rubrics, names, o));
    const top = remedies.slice(0, 5).map((r) => r.remedy_name);
    const rank = top.findIndex((n) => c.expect.some((w) => remedyMatches(n, w))) + 1;
    if (rank >= 1) top5++;
    if (rank >= 1 && rank <= 3) top3++;
    if (rank === 1) top1++;
    if (!rank) missed.push(c.name);
    lines.push(`${rank ? "#" + rank : " - "}  ${c.name}  [${c.expect.join("/")}]  ->  ${top.join(", ") || "none"}`);
    if (verbose) for (const r of rubrics) lines.push(`      u${r.unit} m${r.matched} rel${r.relevance.toFixed(2)} n${r.n_remedies}  ${r.full_path}`);
  }
  return { top1, top3, top5, n: CASES.filter((x) => !only || only.test(x.name)).length, missed, lines, options: o };
}

if (process.argv[1]?.endsWith("offline.ts")) {
  (async () => {
    const dir = process.env.REPERTORY_DUMP;
    if (!dir) { console.error("REPERTORY_DUMP missing"); process.exit(2); }
    const t0 = Date.now();
    const res = await runOffline(dir, process.env.TUNE ? JSON.parse(process.env.TUNE) : {}, !!process.env.VERBOSE, process.env.ONLY ? new RegExp(process.env.ONLY, "i") : undefined);
    if (!process.env.QUIET) console.log(res.lines.join("\n"));
    console.log(`\nTop1 ${res.top1}/${res.n}  Top3 ${res.top3}/${res.n}  Top5 ${res.top5}/${res.n}   (${Date.now() - t0} ms)  ${JSON.stringify(res.options)}`);
  })();
}
