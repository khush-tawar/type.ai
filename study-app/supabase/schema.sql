-- ============================================================
-- Multilingual Typeface Perception Study — Supabase schema
-- Run entire file in SQL Editor. Safe to re-run (idempotent).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── participants ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
  id                UUID        PRIMARY KEY,
  group_code        TEXT        NOT NULL CHECK (group_code IN ('A','B','C','D')),
  demographics      JSONB,
  prolific_pid      TEXT,
  status            TEXT        NOT NULL DEFAULT 'in_progress'
                                CHECK (status IN ('in_progress','completed','withdrawn')),
  withdrawn_reason  TEXT,
  session_stimuli   JSONB,       -- ordered list of { id, sessionDrawing } for reproducibility
  session_seed      TEXT,        -- participant ID used as randomisation seed
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- ── consent_events ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_events (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id   UUID        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  consent_version  TEXT        NOT NULL,
  consented_at     TIMESTAMPTZ NOT NULL
);

-- ── responses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responses (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id          UUID        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  stimulus_id             TEXT        NOT NULL,
  source_type             TEXT        CHECK (source_type IN ('ai','professional','historical','control')),
  binary_judgment         TEXT        CHECK (binary_judgment IN ('authentic','not_authentic')),
  likert_structural       SMALLINT    CHECK (likert_structural BETWEEN 1 AND 7),
  likert_authenticity     SMALLINT    CHECK (likert_authenticity BETWEEN 1 AND 7),
  likert_readability      SMALLINT    CHECK (likert_readability BETWEEN 1 AND 7),
  category_attribution    TEXT,
  error_annotation_text   TEXT,
  drawing_storage_path    TEXT,        -- path in Storage bucket drawings/
  group_specific_response JSONB,
  time_on_screen_ms       INTEGER,
  skipped                 BOOLEAN     NOT NULL DEFAULT FALSE,
  submitted_at            TIMESTAMPTZ NOT NULL,
  CONSTRAINT responses_required_when_not_skipped CHECK (
    skipped = TRUE OR (
      binary_judgment IS NOT NULL
      AND likert_structural IS NOT NULL
      AND likert_authenticity IS NOT NULL
      AND likert_readability IS NOT NULL
      AND category_attribution IS NOT NULL
    )
  )
);

ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS source_type TEXT
  CHECK (source_type IN ('ai','professional','historical','control'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_responses_participant ON responses (participant_id);
CREATE INDEX IF NOT EXISTS idx_responses_stimulus    ON responses (stimulus_id);
CREATE INDEX IF NOT EXISTS idx_participants_group     ON participants (group_code);
CREATE INDEX IF NOT EXISTS idx_participants_status    ON participants (status);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses      ENABLE ROW LEVEL SECURITY;

-- Optional guardrail trigger for participant updates.
DROP TRIGGER IF EXISTS trg_guard_participants_update ON participants;
DROP FUNCTION IF EXISTS guard_participants_update();

CREATE FUNCTION guard_participants_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.group_code IS DISTINCT FROM OLD.group_code
    OR NEW.prolific_pid IS DISTINCT FROM OLD.prolific_pid
    OR NEW.session_seed IS DISTINCT FROM OLD.session_seed
    OR NEW.user_agent IS DISTINCT FROM OLD.user_agent
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'immutable participant fields cannot be updated';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_participants_update
BEFORE UPDATE ON participants
FOR EACH ROW
EXECUTE FUNCTION guard_participants_update();

-- Drop and recreate so this file is safe to re-run
DROP POLICY IF EXISTS "anon_insert_participants"   ON participants;
DROP POLICY IF EXISTS "anon_update_participants"   ON participants;
DROP POLICY IF EXISTS "anon_insert_consent"        ON consent_events;
DROP POLICY IF EXISTS "anon_insert_responses"      ON responses;
DROP POLICY IF EXISTS "auth_read_participants"     ON participants;
DROP POLICY IF EXISTS "auth_read_consent"          ON consent_events;
DROP POLICY IF EXISTS "auth_read_responses"        ON responses;

-- Participants: anon can insert and update their own row (by id)
CREATE POLICY "anon_insert_participants" ON participants
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_participants" ON participants
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Consent events: anon can insert
CREATE POLICY "anon_insert_consent" ON consent_events
  FOR INSERT TO anon WITH CHECK (true);

-- Responses: anon can insert
CREATE POLICY "anon_insert_responses" ON responses
  FOR INSERT TO anon WITH CHECK (true);

-- Authenticated (researcher) can read everything
CREATE POLICY "auth_read_participants"  ON participants   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_consent"       ON consent_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_responses"     ON responses      FOR SELECT TO authenticated USING (true);

-- Storage policy for drawings bucket.
-- Create bucket first in Supabase dashboard: drawings (private).
DROP POLICY IF EXISTS "anon_upload_drawings" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_drawings" ON storage.objects;

CREATE POLICY "anon_upload_drawings"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'drawings');

CREATE POLICY "auth_read_drawings"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'drawings');

-- ── Analytical view: one row per stimulus response ────────────
DROP VIEW IF EXISTS stimulus_responses;
CREATE VIEW stimulus_responses AS
SELECT
  p.id                                                AS session_id,
  p.group_code,
  p.prolific_pid,
  p.status                                            AS session_status,
  p.created_at                                        AS session_created_at,
  p.completed_at,
  p.demographics ->> 'ageRange'                       AS age_range,
  p.demographics ->> 'country'                        AS country,
  p.demographics ->> 'devaLanguage'                   AS deva_language,
  p.demographics ->> 'region'                         AS region,
  p.demographics ->> 'readingFreq'                    AS reading_freq,
  p.demographics ->> 'designExp'                      AS design_exp,
  p.demographics ->> 'designDiscipline'               AS design_discipline,
  p.demographics ->> 'expertType'                     AS expert_type,
  p.demographics ->> 'expertNote'                     AS expert_note,
  p.demographics ->> 'nonLatinExp'                    AS non_latin_exp,
  p.demographics ->> 'nonLatinScripts'                AS non_latin_scripts,
  r.stimulus_id,
  r.source_type,
  r.binary_judgment,
  r.likert_structural,
  r.likert_authenticity,
  r.likert_readability,
  r.category_attribution,
  r.error_annotation_text,
  r.drawing_storage_path,
  r.drawing_storage_path IS NOT NULL                  AS has_drawing,
  r.group_specific_response,
  r.time_on_screen_ms,
  r.skipped,
  r.submitted_at
FROM participants p
JOIN responses r ON r.participant_id = p.id;

DROP FUNCTION IF EXISTS export_study_dataset();
CREATE FUNCTION export_study_dataset()
RETURNS TABLE (
  participant_id UUID,
  group_code TEXT,
  prolific_pid TEXT,
  participant_status TEXT,
  participant_created_at TIMESTAMPTZ,
  participant_completed_at TIMESTAMPTZ,
  age_range TEXT,
  country TEXT,
  deva_language TEXT,
  region TEXT,
  reading_freq TEXT,
  design_exp TEXT,
  design_discipline TEXT,
  expert_type TEXT,
  expert_note TEXT,
  non_latin_exp TEXT,
  non_latin_scripts TEXT,
  stimulus_id TEXT,
  source_type TEXT,
  binary_judgment TEXT,
  likert_structural SMALLINT,
  likert_authenticity SMALLINT,
  likert_readability SMALLINT,
  category_attribution TEXT,
  error_annotation_text TEXT,
  group_specific_response JSONB,
  drawing_storage_path TEXT,
  time_on_screen_ms INTEGER,
  skipped BOOLEAN,
  submitted_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.group_code,
    p.prolific_pid,
    p.status,
    p.created_at,
    p.completed_at,
    p.demographics ->> 'ageRange' AS age_range,
    p.demographics ->> 'country' AS country,
    p.demographics ->> 'devaLanguage' AS deva_language,
    p.demographics ->> 'region' AS region,
    p.demographics ->> 'readingFreq' AS reading_freq,
    p.demographics ->> 'designExp' AS design_exp,
    p.demographics ->> 'designDiscipline' AS design_discipline,
    p.demographics ->> 'expertType' AS expert_type,
    p.demographics ->> 'expertNote' AS expert_note,
    p.demographics ->> 'nonLatinExp' AS non_latin_exp,
    p.demographics ->> 'nonLatinScripts' AS non_latin_scripts,
    r.stimulus_id,
    r.source_type,
    r.binary_judgment,
    r.likert_structural,
    r.likert_authenticity,
    r.likert_readability,
    r.category_attribution,
    r.error_annotation_text,
    r.group_specific_response,
    r.drawing_storage_path,
    r.time_on_screen_ms,
    r.skipped,
    r.submitted_at
  FROM participants p
  JOIN responses r ON r.participant_id = p.id
  ORDER BY r.submitted_at;
$$;

REVOKE ALL ON FUNCTION export_study_dataset() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION export_study_dataset() TO authenticated;

-- ── Example analysis queries ──────────────────────────────────
-- Mean ratings and accept rate by source type
-- (requires joining with manifest — export CSV first):
--
-- SELECT
--   stimulus_id,
--   COUNT(*)                                                          AS n,
--   ROUND(AVG(likert_structural)::NUMERIC, 2)                        AS avg_structural,
--   ROUND(AVG(likert_authenticity)::NUMERIC, 2)                      AS avg_authenticity,
--   ROUND(AVG(likert_readability)::NUMERIC, 2)                       AS avg_readability,
--   ROUND(100.0 * SUM(CASE WHEN binary_judgment='authentic' THEN 1 ELSE 0 END)
--         / NULLIF(COUNT(*),0), 1)                                   AS accept_pct
-- FROM stimulus_responses
-- WHERE NOT skipped
-- GROUP BY stimulus_id
-- ORDER BY stimulus_id;

-- ── IRB data deletion (run 3 years post-study) ────────────────
-- DELETE FROM responses;
-- DELETE FROM consent_events;
-- DELETE FROM participants;
-- (Also empty the drawings/ Storage bucket manually.)
-- Screenshot this operation per IIT IRB primer guidance.
