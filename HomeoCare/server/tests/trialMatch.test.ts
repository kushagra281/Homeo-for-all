import assert from "node:assert/strict";
import { remedyMatches as m } from "../trials/match";
const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };

t("two-word names must agree on both words", () => {
  assert.ok(m("NATRUM MURIATICUM", "Natrum muriaticum"));
  assert.ok(!m("NATRUM SULPHURICUM", "Natrum muriaticum"));
  assert.ok(!m("CALCAREA PHOSPHORICA", "Calcarea carbonica"));
  assert.ok(!m("KALI CARBONICUM", "Kali bichromicum"));
});
t("one word matches any remedy that starts with it", () => {
  assert.ok(m("MERCURIUS SOLUBILIS", "Mercurius"));
  assert.ok(m("HEPAR SULPHURIS CALCAREUM", "Hepar"));
  assert.ok(m("GLONOINUM", "Glonoin"));
  assert.ok(m("SULPHUR IODATUM", "Sulphur"));
  assert.ok(!m("SULPHURICUM ACIDUM", "Sulphur"));
});
t("word order does not matter for two-word names", () => {
  assert.ok(m("ACIDUM NITRICUM", "Nitricum acidum"));
  assert.ok(m("NITRICUM ACIDUM", "Nitricum acidum"));
});
t("Pulsatilla nigricans is Boericke's Pulsatilla pratensis", () => {
  assert.ok(m("PULSATILLA PRATENSIS", "Pulsatilla nigricans"));
  assert.ok(!m("PULSATILLA NUTTALLIANA", "Pulsatilla nigricans"));
});
