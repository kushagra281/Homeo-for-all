// Runs the real search engine on the classical cases and prints a pass/fail table.
// Needs SCRAPER_SUPABASE_URL and SCRAPER_SUPABASE_KEY (the publishable key is enough: the tables are public-read).
import { appendFileSync } from "node:fs";
import { CASES } from "./cases";
import { search } from "../services/searchService";
import { remedyMatches } from "./match";
import { hasGroqKey } from "../utils/groq";

(async () => {
  if (!process.env.SCRAPER_SUPABASE_URL || !process.env.SCRAPER_SUPABASE_KEY) {
    console.error("SCRAPER_SUPABASE_URL / SCRAPER_SUPABASE_KEY missing"); process.exit(2);
  }
  const log = console.log; console.log = () => {};   // silence the engine's own logging
  const rows: string[] = []; const failed: string[] = [];
  let top1 = 0, top3 = 0, top5 = 0, errors = 0;
  const ai = hasGroqKey() && process.env.AI_SYNONYMS !== "off";
  for (const c of CASES) {
    if (ai) await new Promise((r) => setTimeout(r, 2500));   // stay under the model's request limit
    let top: string[] = [], err = "";
    try {
      const res = await search({ symptoms: c.symptoms, filters: {} });
      top = [...res.remedies, ...res.alternatives].slice(0, 5).map((r) => r.name);
    } catch (e: any) { err = e?.message || String(e); }
    const rank = top.findIndex((n) => c.expect.some((w) => remedyMatches(n, w))) + 1;   // 0 = not in top 5
    if (err) errors++;
    if (rank >= 1) top5++; if (rank >= 1 && rank <= 3) top3++; if (rank === 1) top1++;
    if (!rank) failed.push(c.name);
    rows.push(`| ${rank ? "✅" : "❌"} | ${rank ? "#" + rank : "-"} | ${c.name} | ${c.expect.join(" / ")} | ${err ? "ERROR " + err : top.join(", ") || "none"} |`);
  }
  console.log = log;
  const n = CASES.length;
  const out = [
    `## Trials: ${top5}/${n} in top 5 (${Math.round((top5 / n) * 100)}%) · AI synonyms: ${ai ? "ON" : "off"}`,
    "",
    `**Top 1: ${top1}/${n}** · **Top 3: ${top3}/${n}** · **Top 5: ${top5}/${n}**${errors ? ` · errors: ${errors}` : ""}`,
    "",
    "| | Rank | Case | Expected | Top 5 |", "|---|---|---|---|---|", ...rows,
    "", failed.length ? `**Missed:** ${failed.join("; ")}` : "**Nothing missed.**",
  ].join("\n");
  console.log(out);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
  process.exit(top5 === n ? 0 : 1);
})();
