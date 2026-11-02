import assert from "node:assert/strict";
import { detectRedFlags } from "../../shared/redFlags";

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };
const codes = (texts: string[], profile?: any) => detectRedFlags(texts, profile).map((f) => f.code);

t("the worst-headache case from the pipeline", () => {
  assert.ok(codes(["worst headache of my life, sudden"]).includes("thunderclap"));
});
t("fever with a stiff neck is meningitis-level", () => {
  assert.ok(codes(["fever", "stiff neck"]).includes("meningism"));
  assert.ok(codes(["bukhar aur gardan akad gayi hai"]).includes("meningism"));
});
t("fever + rash", () => assert.ok(codes(["high fever with a rash"]).includes("meningism")));
t("seizure, fainting, confusion", () => {
  for (const s of ["had a seizure", "she fainted", "feels confused and sleepy", "behosh ho gaya"]) assert.ok(codes([s]).includes("unconscious"), s);
});
t("the word 'fits' in ordinary use is not a seizure", () => {
  assert.deepEqual(codes(["fits of anger", "this remedy fits the picture"]), []);
});
t("stroke signs", () => {
  for (const s of ["weakness on one side", "slurred speech", "face drooping", "bolne me dikkat"]) assert.ok(codes([s]).includes("stroke"), s);
});
t("chest and breathing", () => {
  for (const s of ["chest pain radiating to arm", "can't breathe", "seene me dard", "sans lene me takleef"]) assert.ok(codes([s]).includes("chest"), s);
});
t("bleeding", () => {
  for (const s of ["vomiting blood", "black tarry stool", "coughing up blood"]) assert.ok(codes([s]).includes("bleeding"), s);
});
t("very high fever by number", () => {
  assert.ok(codes(["fever 104 F"]).includes("high_fever"));
  assert.ok(codes(["temperature 40.5 °C"]).includes("high_fever"));
  assert.ok(!codes(["fever 99 F"]).includes("high_fever"));
});
t("suicidal thoughts give a helpline, not a remedy", () => {
  const f = detectRedFlags(["I want to die"]).find((x) => x.code === "suicidal")!;
  assert.ok(f && f.level === "danger" && f.message.includes("14416"));
});
t("a denied sign is ignored", () => {
  assert.deepEqual(codes(["headache, no fever, no stiff neck"]), []);
  assert.deepEqual(codes(["no chest pain", "without seizure"]), []);
  assert.deepEqual(codes(["bukhar nahi, gardan akadna nahi, sir dard"]), []);
  assert.ok(!codes(["no fever", "rash on arm"]).includes("meningism"));
});
t("ordinary complaints raise nothing", () => {
  assert.deepEqual(codes(["dry cough worse at night", "heartburn after eating", "joint stiffness in the morning"]), []);
  assert.deepEqual(codes([]), []);
  assert.deepEqual(codes([undefined, null as any, ""]), []);
});
t("the migraine case from the pipeline is flagged as a warning", () => {
  const f = detectRedFlags(["severe throbbing headache", "vomiting", "worse from light", "9/10 pain"]);
  assert.ok(f.some((x) => x.code === "migraine_pattern" && x.level === "warning"));
  assert.ok(f.some((x) => x.code === "severe_pain"));
});
t("danger comes before warning", () => {
  const f = detectRedFlags(["9/10 pain", "chest pain"]);
  assert.equal(f[0].level, "danger");
});
t("fever in a baby under one year", () => {
  assert.ok(codes(["fever"], { age: 0 }).includes("infant_fever"));
  assert.ok(!codes(["fever"], { age: 5 }).includes("infant_fever"));
});
