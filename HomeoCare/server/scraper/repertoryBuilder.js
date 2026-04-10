// server/scraper/repertoryBuilder.js
// REPERTORY BUILDER — Converts unstructured Materia Medica JSON
// into properly structured rubric rows ready for Supabase insertion.
//
// Input:  boericke_materia_medica.json or kent_materia_medica.json
// Output: SQL INSERT statements or JSON array of rubric rows
//
// Usage:
//   node server/scraper/repertoryBuilder.js --input attached_assets/boericke_materia_medica_*.json
//   node server/scraper/repertoryBuilder.js --input attached_assets/mind_section_*.json --type section

const fs   = require("fs");
const path = require("path");

// ── Body system → rubric code prefix mapping ──────────────────────
const SYSTEM_TO_CODE = {
  "Mind":                    "MIND",
  "Head":                    "HEAD",
  "Eyes":                    "EYE",
  "Ears":                    "EAR",
  "Nose":                    "NOSE",
  "Face":                    "FACE",
  "Mouth":                   "MOUTH",
  "Throat":                  "THROAT",
  "Stomach":                 "STOMACH",
  "Abdomen":                 "ABDOMEN",
  "Chest":                   "RESPIRATORY",
  "Respiratory":             "RESPIRATORY",
  "Back":                    "EXTREMITIES",
  "Extremities":             "EXTREMITIES",
  "Skin":                    "SKIN",
  "Fever":                   "FEVER",
  "Generalities":            "GENERALITIES",
  "Female Sexual System":    "FEMALE",
  "Male Sexual System":      "MALE",
  "Urinary System":          "URINARY",
  "Nervous System":          "NERVOUS",
};

// ── Symptom → canonical rubric code ──────────────────────────────
// Converts a symptom string like "throbbing pain" → "THROBBING"
function symptomToCode(symptom) {
  return symptom
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 30);
}

// ── Extract rubric label from symptom text ────────────────────────
function buildRubricLabel(bodySystem, symptom) {
  const clean = symptom.toLowerCase().replace(/\s+/g, " ").trim();
  return `${bodySystem}; ${clean}`;
}

// ── Determine symptom_type from body system ───────────────────────
function getSymptomType(bodySystem) {
  if (bodySystem === "Mind")         return "mental";
  if (bodySystem === "Generalities") return "general";
  return "particular";
}

// ── Determine weight from symptom_type ───────────────────────────
function getWeight(symptomType) {
  if (symptomType === "mental")   return 3.0;
  if (symptomType === "general")  return 2.0;
  return 1.0;
}

// ── Process Materia Medica format ─────────────────────────────────
// Input: { "Arsenicum Album": { "Mind": "Anxiety, restlessness", "Head": "Throbbing pain" } }
// Produces rubric rows + rubric_remedy rows
function processMateriaMediaFormat(data) {
  const rubricMap  = new Map(); // code → rubric row
  const remedyRows = [];        // rubric_remedies rows

  for (const [remedyName, sections] of Object.entries(data)) {
    if (typeof sections !== "object" || !sections) continue;

    for (const [bodySystem, text] of Object.entries(sections)) {
      if (!text || typeof text !== "string") continue;

      const sysCode = SYSTEM_TO_CODE[bodySystem] || bodySystem.toUpperCase().replace(/\s+/g, "_");
      const symptomType = getSymptomType(bodySystem);
      const weight = getWeight(symptomType);

      // Split text into individual symptoms
      const symptoms = text
        .split(/[,;\.]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 3 && s.length < 100);

      for (const symptom of symptoms.slice(0, 5)) { // max 5 per section
        const symptomCode = symptomToCode(symptom);
        const rubricCode  = `${sysCode}.${symptomCode}`;
        const label       = buildRubricLabel(bodySystem, symptom);

        // Add rubric if not seen
        if (!rubricMap.has(rubricCode)) {
          rubricMap.set(rubricCode, {
            code:         rubricCode,
            label,
            parent_code:  sysCode,
            body_system:  sysCode,
            depth:        2,
            symptom_type: symptomType,
            weight,
            is_negative:  false,
          });

          // Also ensure parent rubric exists
          if (!rubricMap.has(sysCode)) {
            rubricMap.set(sysCode, {
              code:         sysCode,
              label:        bodySystem,
              parent_code:  null,
              body_system:  sysCode,
              depth:        0,
              symptom_type: symptomType,
              weight,
              is_negative:  false,
            });
          }
        }

        // Add remedy-rubric mapping (grade based on text length as proxy)
        const grade = symptoms.indexOf(symptom) === 0 ? 3 : 2;
        remedyRows.push({
          rubric_code: rubricCode,
          remedy_name: remedyName,
          grade,
          source:      "boericke",
        });
      }
    }
  }

  return {
    rubrics:  Array.from(rubricMap.values()),
    remedies: remedyRows,
  };
}

// ── Process Section format ────────────────────────────────────────
// Input: { "anxiety": ["Arsenicum", "Aconite"], "fear": ["Aconite"] }
function processSectionFormat(data, bodySystem = "Mind") {
  const sysCode     = SYSTEM_TO_CODE[bodySystem] || bodySystem.toUpperCase();
  const symptomType = getSymptomType(bodySystem);
  const weight      = getWeight(symptomType);

  const rubricMap  = new Map();
  const remedyRows = [];

  // Ensure root rubric
  rubricMap.set(sysCode, {
    code: sysCode, label: bodySystem,
    parent_code: null, body_system: sysCode,
    depth: 0, symptom_type: symptomType, weight, is_negative: false,
  });

  for (const [symptom, remedies] of Object.entries(data)) {
    if (!Array.isArray(remedies)) continue;

    const rubricCode = `${sysCode}.${symptomToCode(symptom)}`;
    const label      = buildRubricLabel(bodySystem, symptom);

    if (!rubricMap.has(rubricCode)) {
      rubricMap.set(rubricCode, {
        code:         rubricCode,
        label,
        parent_code:  sysCode,
        body_system:  sysCode,
        depth:        1,
        symptom_type: symptomType,
        weight,
        is_negative:  false,
      });
    }

    remedies.slice(0, 10).forEach((remedyName, idx) => {
      // First remedy gets grade 3, rest get grade 2
      remedyRows.push({
        rubric_code: rubricCode,
        remedy_name: remedyName,
        grade:       idx === 0 ? 3 : 2,
        source:      "scraped",
      });
    });
  }

  return {
    rubrics:  Array.from(rubricMap.values()),
    remedies: remedyRows,
  };
}

// ── Generate SQL ──────────────────────────────────────────────────
function generateSQL(rubrics, remedies) {
  const lines = ["-- Generated by repertoryBuilder.js", ""];

  // Rubric inserts
  lines.push("-- RUBRICS");
  for (const r of rubrics) {
    const parentVal = r.parent_code ? `'${r.parent_code}'` : "NULL";
    lines.push(
      `INSERT INTO rubrics (code, label, parent_code, body_system, depth, symptom_type, weight, is_negative) ` +
      `VALUES ('${r.code}', '${r.label.replace(/'/g, "''")}', ${parentVal}, '${r.body_system}', ` +
      `${r.depth}, '${r.symptom_type}', ${r.weight}, ${r.is_negative}) ` +
      `ON CONFLICT (code) DO NOTHING;`
    );
  }

  lines.push("", "-- RUBRIC_REMEDIES");
  for (const r of remedies) {
    lines.push(
      `INSERT INTO rubric_remedies (rubric_code, remedy_name, grade, source) ` +
      `VALUES ('${r.rubric_code}', '${r.remedy_name.replace(/'/g, "''")}', ${r.grade}, '${r.source}') ` +
      `ON CONFLICT (rubric_code, remedy_name, source) DO NOTHING;`
    );
  }

  return lines.join("\n");
}

// ── CLI entry point ───────────────────────────────────────────────
function main() {
  const args    = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");
  const typeIdx  = args.indexOf("--type");
  const outIdx   = args.indexOf("--out");

  if (inputIdx === -1) {
    console.log(`
Usage:
  node repertoryBuilder.js --input <file.json> [--type materia|section] [--out output.sql]

Examples:
  # Process Materia Medica (Boericke/Kent format)
  node repertoryBuilder.js --input ../attached_assets/boericke_materia_medica_*.json --type materia

  # Process section file (mind_section, head_section format)
  node repertoryBuilder.js --input ../attached_assets/mind_section_*.json --type section
`);
    process.exit(0);
  }

  const inputFile = args[inputIdx + 1];
  const type      = typeIdx !== -1 ? args[typeIdx + 1] : "materia";
  const outFile   = outIdx !== -1 ? args[outIdx + 1] : null;

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  const raw  = fs.readFileSync(inputFile, "utf-8");
  const data = JSON.parse(raw);

  let result;
  if (type === "section") {
    // Detect body system from filename
    const fname = path.basename(inputFile).toLowerCase();
    const bodySystem =
      fname.includes("mind") ? "Mind" :
      fname.includes("head") ? "Head" :
      fname.includes("skin") ? "Skin" :
      fname.includes("stomach") ? "Stomach" : "Generalities";
    result = processSectionFormat(data, bodySystem);
  } else {
    result = processMateriaMediaFormat(data);
  }

  console.log(`Generated ${result.rubrics.length} rubrics, ${result.remedies.length} remedy mappings`);

  const sql = generateSQL(result.rubrics, result.remedies);

  if (outFile) {
    fs.writeFileSync(outFile, sql, "utf-8");
    console.log(`SQL written to: ${outFile}`);
  } else {
    // Print to stdout — pipe to clipboard or file
    console.log(sql);
  }
}

main();
