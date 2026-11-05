/**
 * Periodic-table position of a remedy's elements, in J. Scholten's words:
 * the row is the "series", the column is the "stage" (1-18).
 *
 * Deliberately plain facts, no interpretation: a tag says where the element sits and nothing about
 * what that "means". A remedy gets tags only when every word of its name is understood (an element,
 * a salt/acid word, or a neutral word like METALLICUM). Plants, organic compounds and anything
 * else the table does not cover get no tag, rather than a guess.
 */

export interface ElementTag {
  symbol: string
  name: string
  series: string   // e.g. "Silicon"
  stage: number    // 1-18, the periodic-table column
}

const SERIES = ["Hydrogen", "Carbon", "Silicon", "Ferrum", "Silver", "Gold", "Uranium"]

// symbol -> [name, period (1-7), group (1-18)]
const EL: Record<string, [string, number, number]> = {
  H: ["Hydrogen", 1, 1], Li: ["Lithium", 2, 1], B: ["Boron", 2, 13], C: ["Carbon", 2, 14], N: ["Nitrogen", 2, 15],
  O: ["Oxygen", 2, 16], F: ["Fluorine", 2, 17],
  Na: ["Sodium", 3, 1], Mg: ["Magnesium", 3, 2], Al: ["Aluminium", 3, 13], Si: ["Silicon", 3, 14],
  P: ["Phosphorus", 3, 15], S: ["Sulphur", 3, 16], Cl: ["Chlorine", 3, 17],
  K: ["Potassium", 4, 1], Ca: ["Calcium", 4, 2], Ti: ["Titanium", 4, 4], V: ["Vanadium", 4, 5], Cr: ["Chromium", 4, 6],
  Mn: ["Manganese", 4, 7], Fe: ["Iron", 4, 8], Co: ["Cobalt", 4, 9], Ni: ["Nickel", 4, 10], Cu: ["Copper", 4, 11],
  Zn: ["Zinc", 4, 12], As: ["Arsenic", 4, 15], Se: ["Selenium", 4, 16], Br: ["Bromine", 4, 17],
  Sr: ["Strontium", 5, 2], Rh: ["Rhodium", 5, 9], Pd: ["Palladium", 5, 10], Ag: ["Silver", 5, 11],
  Cd: ["Cadmium", 5, 12], Sn: ["Tin", 5, 14], Sb: ["Antimony", 5, 15], Te: ["Tellurium", 5, 16], I: ["Iodine", 5, 17],
  Ba: ["Barium", 6, 2], Os: ["Osmium", 6, 8], Ir: ["Iridium", 6, 9], Pt: ["Platinum", 6, 10], Au: ["Gold", 6, 11],
  Hg: ["Mercury", 6, 12], Tl: ["Thallium", 6, 13], Pb: ["Lead", 6, 14], Bi: ["Bismuth", 6, 15],
  Ra: ["Radium", 7, 2],
}

// whole words of remedy names -> element symbols
const WORD: Record<string, string[]> = {
  NATRUM: ["Na"], NATRIUM: ["Na"], KALI: ["K"], KALIUM: ["K"], CALCAREA: ["Ca"], MAGNESIA: ["Mg"], MAGNESIUM: ["Mg"],
  ALUMINA: ["Al"], SILICA: ["Si"], SILICEA: ["Si"], FERRUM: ["Fe"], CUPRUM: ["Cu"], ZINCUM: ["Zn"], ARGENTUM: ["Ag"],
  AURUM: ["Au"], PLATINUM: ["Pt"], MERCURIUS: ["Hg"], PLUMBUM: ["Pb"], STANNUM: ["Sn"], ANTIMONIUM: ["Sb"],
  ARSENICUM: ["As"], BISMUTHUM: ["Bi"], CADMIUM: ["Cd"], COBALTUM: ["Co"], NICCOLUM: ["Ni"], MANGANUM: ["Mn"],
  CHROMICUM: ["Cr"], BICHROMICUM: ["Cr"], VANADIUM: ["V"], TITANIUM: ["Ti"], OSMIUM: ["Os"], IRIDIUM: ["Ir"],
  RHODIUM: ["Rh"], PALLADIUM: ["Pd"], SELENIUM: ["Se"], TELLURIUM: ["Te"], THALLIUM: ["Tl"], STRONTIUM: ["Sr"],
  LITHIUM: ["Li"], BARYTA: ["Ba"], RADIUM: ["Ra"], BROMIUM: ["Br"], IODIUM: ["I"], IODINE: ["I"], CHLORUM: ["Cl"],
  SULPHUR: ["S"], PHOSPHORUS: ["P"], CARBO: ["C"], CARBONEUM: ["C"], BORICUM: ["B"], CINNABARIS: ["Hg", "S"],
  // salt and acid words
  MURIATICUM: ["Cl"], MURIATICA: ["Cl"], CHLORICUM: ["Cl"], HYPOCHLOROSUM: ["Cl"],
  CARBONICUM: ["C"], CARBONICA: ["C"], PHOSPHORICUM: ["P"], PHOSPHORICA: ["P"], PHOSPHORIC: ["P"],
  SULPHURICUM: ["S"], SULPHURICA: ["S"], SULPHURIC: ["S"], SULPHURATUM: ["S"], SULPHUROSUM: ["S"],
  NITRICUM: ["N"], NITRIC: ["N"], FLUORICA: ["F"], FLUORICUM: ["F"], FLUORIC: ["F"],
  IODATUM: ["I"], IODATA: ["I"], IODATUS: ["I"], BROMATUM: ["Br"], BROMATA: ["Br"],
  ARSENICOSUM: ["As"], ARSENICOSA: ["As"], SILICATA: ["Si"], SILICICUM: ["Si"], PERMANGANATUM: ["Mn"],
  HYDROGENISATUM: ["H"], OXYGENISATUM: ["O"],
  CRUDUM: ["S"],                       // antimonium crudum is the sulphide
  CORROSIVUS: ["Cl"], DULCIS: ["Cl"],  // mercuric chloride, calomel
}

// words that add no element
const NEUTRAL = new Set([
  "METALLICUM", "ACIDUM", "ACID", "ALBUM", "TERRA", "SOLUBILIS",
  "FLAVUS", "FLAVUM", "RUBER", "MAGNETICUM", "VEGETABILIS", "ANIMALIS",
])

/** Element tags for a remedy name, in the order the elements appear. Empty when not every word is understood. */
export function elementTags(remedyName: string | undefined | null): ElementTag[] {
  if (!remedyName) return []
  const words = remedyName.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const symbols: string[] = []
  for (const w of words) {
    if (NEUTRAL.has(w)) continue
    const els = WORD[w]
    if (!els) return []                 // a word we do not understand: no tag at all
    for (const s of els) if (!symbols.includes(s)) symbols.push(s)
  }
  return symbols.map(symbol => {
    const [name, period, group] = EL[symbol]
    return { symbol, name, series: SERIES[period - 1], stage: group }
  })
}

export function elementTagLabel(t: ElementTag): string {
  return `${t.series} series · Stage ${t.stage}`
}
