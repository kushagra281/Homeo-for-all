-- HomeoWell PostgreSQL Schema
-- Run this to create tables in your PostgreSQL database
-- Or use Drizzle ORM migration command from package.json

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS remedies (
  id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  condition        TEXT NOT NULL,
  description      TEXT NOT NULL,
  dosage           TEXT NOT NULL,
  symptoms         JSON NOT NULL DEFAULT '[]',
  keywords         JSON DEFAULT '[]',
  symptom_mappings JSON DEFAULT '{}',
  modalities       JSON DEFAULT '{"better": [], "worse": []}',
  potencies        JSON DEFAULT '["6C", "30C", "200C"]',
  age_groups       JSON DEFAULT '["child", "adult", "senior"]',
  genders          JSON DEFAULT '["male", "female", "any"]',
  synonym_names    JSON DEFAULT '[]'
);

-- Seed data
INSERT INTO remedies (name, category, condition, description, dosage, symptoms, keywords, potencies, age_groups, genders) VALUES
('Belladonna','HEAD','Throbbing Headaches','Sudden intense headaches with heat and redness.','30C potency, 3 pellets under tongue','["Sudden onset","Throbbing pain","Heat sensation"]','["belladonna","head","headache","throbbing","sudden"]','["6C","30C","200C"]','["adult","senior"]','["male","female","any"]'),
('Arsenicum Album','MIND','Anxiety and Restlessness','For anxiety with restlessness and perfectionism.','30C potency, 3 pellets twice daily','["Restlessness","Anxiety","Perfectionism","Fear of death"]','["arsenicum","mind","anxiety","restlessness","fear"]','["30C","200C","1M"]','["adult","senior"]','["female"]'),
('Bryonia','HEAD','Splitting Headaches','Bursting headaches worse from any motion.','30C potency, 3 pellets as needed','["Splitting headache","Worse from movement","Dry cough"]','["bryonia","head","headache","splitting","motion"]','["6C","30C","200C"]','["child","adult","senior"]','["male","female","any"]'),
('Gelsemium','HEAD','Dullness and Heaviness','Dull heavy headaches with weakness and drowsiness.','30C potency, 3 pellets as needed','["Dullness","Heaviness","Weakness","Drowsiness"]','["gelsemium","head","dullness","heaviness","weakness"]','["6C","30C","200C"]','["child","adult","senior"]','["male","female","any"]'),
('Aconite','MIND','Sudden Anxiety and Fear','For sudden intense fear and panic, especially after shock.','30C potency, 3 pellets every 15 minutes','["Sudden fear","Panic","Restlessness","Fear of death"]','["aconite","mind","anxiety","fear","panic","sudden"]','["6C","30C","200C"]','["child","adult","senior"]','["male","female","any"]');
