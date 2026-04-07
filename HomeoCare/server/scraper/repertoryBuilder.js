import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ----------------------
// SECTION EXTRACTION
// ----------------------
function extractSections(text) {
  const sections = {};
  const regex = /(Mind|General|Head|Stomach|Sleep|Chest|Back):/gi;
  let split = text.split(regex);

  for (let i = 1; i < split.length; i += 2) {
    const section = split[i].trim();
    const content = split[i + 1];
    sections[section] = content;
  }

  return sections;
}

// ----------------------
// SYMPTOM EXTRACTION
// ----------------------
function extractSymptoms(text) {
  return text
    .split(/[.,;]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 3);
}

// ----------------------
// RUBRIC BUILDER
// ----------------------
function buildRubric(section, symptom) {
  if (symptom.includes("fear") && symptom.includes("dark")) {
    return [section, "Fear", "Darkness"];
  }

  if (symptom.includes("fear") && symptom.includes("alone")) {
    return [section, "Fear", "Alone"];
  }

  if (symptom.includes("anxiety")) {
    return [section, "Anxiety"];
  }

  if (symptom.includes("restlessness")) {
    return [section, "Restlessness"];
  }

  // fallback
  return [section, symptom];
}

// ----------------------
// GRADE ASSIGNMENT
// ----------------------
function assignGrade(symptom) {
  if (symptom.includes("very") || symptom.includes("extreme")) return 4;
  if (symptom.includes("marked")) return 3;
  return 2;
}

// ----------------------
// INSERT RUBRIC TREE
// ----------------------
async function insertRubricTree(path) {
  let parentId = null;

  for (const node of path) {
    const { data: existing } = await supabase
      .from("rubrics")
      .select("id")
      .eq("name", node)
      .eq("parent_id", parentId)
      .maybeSingle();

    let id = existing?.id;

    if (!id) {
      const { data: inserted } = await supabase
        .from("rubrics")
        .insert({ name: node, parent_id: parentId })
        .select()
        .single();

      id = inserted.id;
    }

    parentId = id;
  }

  return parentId;
}

// ----------------------
// INSERT REMEDY
// ----------------------
async function getRemedyId(name) {
  const { data } = await supabase
    .from("remedies")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (data) return data.id;

  const { data: inserted } = await supabase
    .from("remedies")
    .insert({ name })
    .select()
    .single();

  return inserted.id;
}

// ----------------------
// MAP REMEDY TO RUBRIC
// ----------------------
async function mapRemedy(rubricId, remedyId, grade) {
  await supabase.from("rubric_remedy_map").upsert({
    rubric_id: rubricId,
    remedy_id: remedyId,
    grade
  });
}

// ----------------------
// MAIN FUNCTION
// ----------------------
async function processRemedy(remedyName, text) {
  const sections = extractSections(text);
  const remedyId = await getRemedyId(remedyName);

  for (const section in sections) {
    const symptoms = extractSymptoms(sections[section]);

    for (const symptom of symptoms) {
      const rubricPath = buildRubric(section, symptom);
      const rubricId = await insertRubricTree(rubricPath);
      const grade = assignGrade(symptom);

      await mapRemedy(rubricId, remedyId, grade);

      console.log(`✔ ${remedyName} → ${rubricPath.join(" > ")}`);
    }
  }
}

// ----------------------
// TEST RUN
// ----------------------
const sampleText = `
Mind: Fear of dark, anxiety, restlessness.
General: Weakness, fatigue.
`;

processRemedy("Stramonium", sampleText);
