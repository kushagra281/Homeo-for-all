-- Saved repertory cases (a practitioner's chosen rubrics, weights and options) with follow-up visits.
-- Run on the MAIN database (the one with auth.users). Safe to run twice.
-- Rows belong to the signed-in user and are only visible to that user (row level security).

CREATE TABLE IF NOT EXISTS repertory_cases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    state       JSONB NOT NULL CHECK (octet_length(state::text) <= 20000),   -- rubric ids, weights, options
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repertory_case_visits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID NOT NULL REFERENCES repertory_cases(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    note        TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),   -- remedy given, response, plan
    state       JSONB NOT NULL CHECK (octet_length(state::text) <= 20000),    -- the case as it stood at this visit
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repertory_cases_user_idx  ON repertory_cases (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS repertory_visits_case_idx ON repertory_case_visits (case_id, created_at DESC);

-- A visit may only be filed under the user's own case, and nobody can fill the tables without limit.
CREATE OR REPLACE FUNCTION repertory_limits() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF TG_TABLE_NAME = 'repertory_cases' THEN
        IF (SELECT count(*) FROM repertory_cases WHERE user_id = NEW.user_id) >= 200 THEN
            RAISE EXCEPTION 'You can keep at most 200 cases. Delete an old one first.';
        END IF;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM repertory_cases WHERE id = NEW.case_id AND user_id = NEW.user_id) THEN
            RAISE EXCEPTION 'That case is not yours.';
        END IF;
        IF (SELECT count(*) FROM repertory_case_visits WHERE case_id = NEW.case_id) >= 100 THEN
            RAISE EXCEPTION 'A case can have at most 100 visits.';
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS repertory_cases_limit  ON repertory_cases;
DROP TRIGGER IF EXISTS repertory_visits_limit ON repertory_case_visits;
CREATE TRIGGER repertory_cases_limit  BEFORE INSERT ON repertory_cases       FOR EACH ROW EXECUTE FUNCTION repertory_limits();
CREATE TRIGGER repertory_visits_limit BEFORE INSERT ON repertory_case_visits FOR EACH ROW EXECUTE FUNCTION repertory_limits();

ALTER TABLE repertory_cases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE repertory_case_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own cases"  ON repertory_cases;
DROP POLICY IF EXISTS "Own visits" ON repertory_case_visits;
CREATE POLICY "Own cases"  ON repertory_cases       FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own visits" ON repertory_case_visits FOR ALL TO authenticated USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM repertory_cases c WHERE c.id = case_id AND c.user_id = auth.uid()));

REVOKE ALL ON repertory_cases, repertory_case_visits FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON repertory_cases, repertory_case_visits TO authenticated;
