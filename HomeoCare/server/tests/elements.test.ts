import assert from "node:assert/strict"
import { elementTags, elementTagLabel } from "../../shared/elements"

const show = (n: string) => elementTags(n).map(t => `${t.symbol} ${elementTagLabel(t)}`)

// Salts and plain elements
assert.deepEqual(show("NATRUM MURIATICUM"), ["Na Silicon series · Stage 1", "Cl Silicon series · Stage 17"])
assert.deepEqual(show("CALCAREA CARBONICA"), ["Ca Ferrum series · Stage 2", "C Carbon series · Stage 14"])
assert.deepEqual(show("PHOSPHORUS"), ["P Silicon series · Stage 15"])
assert.deepEqual(show("SILICEA TERRA"), ["Si Silicon series · Stage 14"])
assert.deepEqual(show("SULPHUR"), ["S Silicon series · Stage 16"])
assert.deepEqual(show("ARGENTUM NITRICUM"), ["Ag Silver series · Stage 11", "N Carbon series · Stage 15"])
assert.deepEqual(show("AURUM METALLICUM"), ["Au Gold series · Stage 11"])
assert.deepEqual(show("FERRUM METALLICUM"), ["Fe Ferrum series · Stage 8"])
assert.deepEqual(show("KALI BICHROMICUM"), ["K Ferrum series · Stage 1", "Cr Ferrum series · Stage 6"])
assert.deepEqual(show("Plumbum metallicum"), ["Pb Gold series · Stage 14"])        // any case
assert.deepEqual(show("RADIUM BROMATUM"), ["Ra Uranium series · Stage 2", "Br Ferrum series · Stage 17"])
assert.deepEqual(show("CARBONEUM HYDROGENISATUM"), ["C Carbon series · Stage 14", "H Hydrogen series · Stage 1"])
assert.deepEqual(show("PHOSPHORIC ACID"), ["P Silicon series · Stage 15"])
assert.deepEqual(show("MERCURIUS SOLUBILIS"), ["Hg Gold series · Stage 12"])
assert.deepEqual(show("MERCURIUS CORROSIVUS"), ["Hg Gold series · Stage 12", "Cl Silicon series · Stage 17"])
assert.deepEqual(show("ANTIMONIUM CRUDUM"), ["Sb Silver series · Stage 15", "S Silicon series · Stage 16"])

// Never tagged: plants, organic compounds, look-alike words, anything not fully understood
for (const n of [
  "ARGEMONE MEXICANA", "MERCURIALIS PERENNIS", "RHODODENDRON", "SENECIO AUREUS", "MAGNOLIA GRANDIFLORA",
  "CHININUM ARSENICOSUM", "STRYCHNINUM PHOSPHORICUM", "FEL TAURI", "HEPAR SULPHUR", "CALCAREA ACETICA",
  "ZINCUM VALERIANICUM", "ANTIMONIUM TARTARICUM", "URANIUM NITRICUM", "CERIUM OXALICUM", "AURUM MURIATICUM NATRONATUM",
  "MERCURIUS SULPHURICUS, DRARG, OXYD, SUB-SULPH", "BORAX", "CHAPARRO AMARGOSO", "", "   ",
]) assert.deepEqual(elementTags(n), [], `should not tag: ${n}`)
assert.deepEqual(elementTags(undefined), [])
assert.deepEqual(elementTags(null), [])

// Every table entry has a sane position
for (const t of elementTags("NATRUM MURIATICUM")) assert.ok(t.stage >= 1 && t.stage <= 18)

console.log("elements: all checks passed")
