// Names that the two scraped sources (and the Boericke book) spell differently but that
// are the SAME remedy. Only full-name matches are merged; nothing is merged by prefix.
//
// Deliberately NOT merged, because they are different remedies:
//   Alumina / Alumina silicata, Aurum muriaticum / Aurum muriaticum natronatum,
//   Berberis vulgaris / Berberis aquifolium, Camphora / Camphora bromata,
//   Sulphur / Sulphur iodatum, Tuberculinum / Tuberculinum bovinum,
//   and every other Kali-, Natrum-, Mercurius-, Calcarea- ... salt that has its own name.
// Unsure, left separate: Manganum / Manganum aceticum, Mercurius / Mercurius solubilis,
//   Spigelia anthelmia / Spigelia anthelmintica, Podophyllum / Podophyllinum.

// Chemical-style spelling → the name homeopaths use (Kent's text uses the short one).
const PREFIX_ALIASES: Array<[RegExp, string]> = [
  [/^kalium /, "kali "],
  [/^natrium /, "natrum "],
];

// Short (Kent) name → full name used on the other site / in Boericke.
const FULL_NAME: Record<string, string> = {
  "baptisia": "baptisia tinctoria",
  "berberis": "berberis vulgaris",
  "borax": "borax veneta",
  "bryonia": "bryonia alba",
  "bufo": "bufo rana",
  "caladium": "caladium seguinum",
  "cantharis": "cantharis vesicatoria",
  "capsicum": "capsicum annuum",
  "chelidonium": "chelidonium majus",
  "cina": "cina maritima",
  "coffea": "coffea cruda",
  "colchicum": "colchicum autumnale",
  "cyclamen": "cyclamen europaeum",
  "digitalis": "digitalis purpurea",
  "dulcamara bitter sweet": "dulcamara",
  "euphrasia": "euphrasia officinalis",
  "gelsemium": "gelsemium sempervirens",
  "gratiola": "gratiola officinalis",
  "hyoscyamus": "hyoscyamus niger",
  "hypericum": "hypericum perforatum",
  "ignatia": "ignatia amara",
  "lachesis": "lachesis mutus",
  "lycopodium": "lycopodium clavatum",
  "naja": "naja tripudians",
  "phytolacca": "phytolacca decandra",
  "platinum": "platinum metallicum",
  "pulsatilla": "pulsatilla pratensis",
  "rhododendron": "rhododendron ferrugineum",
  "sanguinaria": "sanguinaria canadensis",
  "sarsaparilla": "sarsaparilla officinalis",
  "selenium": "selenium metallicum",
  "sepia": "sepia officinalis",
  "squilla": "squilla maritima",
  "theridion": "theridion curassavicum",

  // English name ↔ Latin name of the same acid
  "acetic acid": "aceticum acidum",
  "benzoic acid": "benzoicum acidum",
  "fluoric acid": "fluoricum acidum",
  "nitric acid": "nitricum acidum",
  "oxalic acid": "oxalicum acidum",
  "phosphoric acid": "phosphoricum acidum",
  "picric acid": "picricum acidum",
  "sulphuric acid": "sulphuricum acidum",

  // Other spellings / older names of one remedy
  "asa foetida": "asafoetida",
  "colocynth": "colocynthis",
  "camphor": "camphora",
  "cinchona": "china officinalis",
  "iodine": "iodium",
  "pyrogen": "pyrogenium",
  "staphisagria": "staphysagria",
  "silica": "silicea terra",
  "magnesia carbonica": "magnesium carbonicum",
  "magnesia muriatica": "magnesium muriaticum",
  "magnesia phosphorica": "magnesium phosphoricum",
  "guaiacum": "guajacum officinale",
  "valerian": "valeriana officinalis",
  // typos in the scraped source
  "ruta graveole s": "ruta graveolens",
  "mercurius iodatus flaws": "mercurius iodatus flavus",
};

/** `plain` is already lower-case, letters/digits/spaces only, parentheses removed. */
export function canonicalRemedyName(plain: string): string {
  let name = plain;
  for (const [re, to] of PREFIX_ALIASES) name = name.replace(re, to);
  return FULL_NAME[name] || name;
}
