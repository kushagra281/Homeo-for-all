// Runs the real search engine on the classical cases and prints a pass/fail table.
// Needs SCRAPER_SUPABASE_URL and SCRAPER_SUPABASE_KEY (the publishable key is enough: the tables are public-read).
import { CASES } from "./cases";
import { search } from "../services/searchService";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const hit = (got: string, want: string) => norm(got).includes(norm(want).slice(0, 8)) || norm(want).includes(norm(got).slice(0, 8));

(async () => {
  if (!process.env.SCRAPER_SUPABASE_URL || !process.env.SCRAPER_SUPABASE_KEY) {
    console.error("SCRAPER_SUPABASE_URL / SCRAPER_SUPABASE_KEY missing"); process.exit(2);
  }
  const log = console.log; console.log = () => {};   // silence the engine's own logging
  const rows: string[] = []; let pass = 0;
  for (const c of CASES) {
    let top: string[] = [], err = "";
    try { top = (await search({ symptoms: c.symptoms, filters: {} })).remedies.slice(0, 5).map((r) => r.name); }
    catch (e: any) { err = e?.message || String(e); }
    const rank = top.findIndex((n) => c.expect.some((w) => hit(n, w)));
    const ok = rank >= 0; if (ok) pass++;
    rows.push(`| ${ok ? "✅" : "❌"} | ${c.name} | ${c.expect.join(" / ")} | ${err ? "ERROR " + err : top.join(", ") || "none"} |`);
  }
  console.log = log;
  const out = [`## Trials: ${pass}/${CASES.length} passed (expected remedy in top 5)`, "", "| | Case | Expected | Top 5 |", "|---|---|---|---|", ...rows].join("\n");
  console.log(out);
  if (process.env.GITHUB_STEP_SUMMARY) require("fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
  process.exit(0);
})();
