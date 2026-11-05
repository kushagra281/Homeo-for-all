import assert from "node:assert/strict";
import { buildReport } from "../../client/src/lib/report";

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };
const base = {
  symptoms: ["throbbing headache", "बुखार"],
  answers: [{ question: "Worse from?", answer: "Light" }],
  redFlags: [{ level: "urgent", message: "Chest pain: seek care now" }],
  profile: { name: "Test", age: 30, gender: "male" },
  analysis: { overview: "Overview.", remedies: [{ name: "Belladonna", why: "Fits.", against: "No thirst." }], ask_next: ["Any fever?"] },
  results: [{ name: "Belladonna", score: 92, dosage: "30C", why: "Sudden throbbing", matches: ["headache throbbing"], better: ["rest"], worse: ["light"], warnings: ["Avoid in pregnancy"] }],
};

t("a report is built as a valid PDF", () => {
  const doc = buildReport(base);
  const bytes = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 1500);
  assert.ok(doc.getNumberOfPages() >= 1);
});

t("a long case flows onto more pages and non-Latin text does not crash", () => {
  const many = { ...base, symptoms: Array.from({ length: 80 }, (_, i) => `symptom number ${i} with some longer text to wrap across the line`), results: Array.from({ length: 3 }, () => base.results[0]) };
  assert.ok(buildReport(many).getNumberOfPages() >= 2);
});

t("an empty optional part is simply left out", () => {
  const doc = buildReport({ ...base, profile: null, analysis: null, redFlags: [], answers: [] });
  assert.ok(doc.getNumberOfPages() >= 1);
});

// ── patient name and file name ──────────────────────────────────────
import { reportFileName, historySymptoms } from "../../shared/reportFile";
const pdfText = (doc: ReturnType<typeof buildReport>) => (doc as any).internal.pages.flat().join("\n");

t("the patient's name is printed on the report", () => {
  assert.ok(pdfText(buildReport({ ...base, profile: { name: "Ayush Saxena", age: 30 } })).includes("Patient: Ayush Saxena"));
});

t("a name only in Devanagari is left out instead of printing question marks", () => {
  const txt = pdfText(buildReport({ ...base, symptoms: ["headache"], profile: { name: "आयुष सक्सेना", age: 30 } }));
  assert.ok(!txt.includes("Patient: "));
  assert.ok(!txt.includes("????"));
});

t("a mixed-script name prints only its Latin part, never question marks", () => {
  const txt = pdfText(buildReport({ ...base, symptoms: ["headache"], answers: [], analysis: null, profile: { name: "आयुष Kumar", age: 30 } }));
  assert.ok(txt.includes("Patient: Kumar"));
  assert.ok(!txt.includes("?"));   // answers and analysis left out: the sample question texts themselves contain a "?"
});

t("a report with no name has no Patient line", () => {
  assert.ok(!pdfText(buildReport({ ...base, profile: { age: 30 } })).includes("Patient: "));
});

t("a saved consultation can be reported without scores or answers", () => {
  const doc = buildReport({ ...base, answers: [], redFlags: [], analysis: null, consultedOn: "05/11/2026", healthNote: "Diabetic",
    results: [{ name: "Belladonna", score: null, matches: ["headache"], better: [], worse: [], warnings: [] }] });
  const txt = pdfText(doc);
  assert.ok(txt.includes("Consultation on 05/11/2026") && txt.includes("Diabetic") && txt.includes("Belladonna"));
  assert.ok(!txt.includes("null"));
});

t("file name is homeocare-report-<date> <name>.pdf", () => {
  const d = new Date(2026, 10, 5, 23, 59);   // 5 Nov 2026, late evening local time
  assert.equal(reportFileName("Ayush Saxena", d), "homeocare-report-2026-11-05 Ayush Saxena.pdf");
  assert.equal(reportFileName("", d), "homeocare-report-2026-11-05.pdf");
  assert.equal(reportFileName(null, d), "homeocare-report-2026-11-05.pdf");
  assert.equal(reportFileName("  A/B:C*?  ", d), "homeocare-report-2026-11-05 A B C.pdf");
  assert.equal(reportFileName("आयुष", d), "homeocare-report-2026-11-05 आयुष.pdf");
  assert.ok(reportFileName("x".repeat(200), d).length < 100);
});

t("history bookkeeping entries are not listed as complaints", () => {
  assert.deepEqual(
    historySymptoms(["headache", "category:Head", "health history: diabetes", "age 34", "gender: male", "agitation", "🔍 q"]),
    ["headache", "agitation", "🔍 q"],
  );
  assert.deepEqual(historySymptoms(null), []);
});
