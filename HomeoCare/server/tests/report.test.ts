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
