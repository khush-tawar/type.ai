-- ============================================================
-- Devanagari Typography Study — Supabase schema
-- Run this in the Supabase SQL editor before deploying the app.
-- ============================================================

-- Main responses table: one row per participant session
CREATE TABLE IF NOT EXISTS study_responses (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id  UUID        NOT NULL,
  demographics    JSONB       NOT NULL,
  responses       JSONB       NOT NULL,  -- array of per-stimulus response objects
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent accidental duplicate submissions from the same participant
  CONSTRAINT unique_participant UNIQUE (participant_id)
);

-- Index for quick lookup by participant
CREATE INDEX IF NOT EXISTS idx_study_responses_participant
  ON study_responses (participant_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE study_responses ENABLE ROW LEVEL SECURITY;

-- Recreate policies so this script is safe to run multiple times
DROP POLICY IF EXISTS "anon_insert" ON study_responses;
DROP POLICY IF EXISTS "auth_read" ON study_responses;

-- Anonymous participants can INSERT their own response
CREATE POLICY "anon_insert" ON study_responses
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated researchers can read everything
CREATE POLICY "auth_read" ON study_responses
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- Convenience view: one row per stimulus response (for analysis)
-- ============================================================
CREATE OR REPLACE VIEW stimulus_responses AS
SELECT
  s.id                                        AS session_id,
  s.participant_id,
  s.submitted_at,
  s.demographics ->> 'language'              AS language,
  s.demographics ->> 'region'                AS region,
  s.demographics ->> 'ageRange'              AS age_range,
  s.demographics ->> 'readingFrequency'      AS reading_frequency,
  r ->> 'stimulusId'                         AS stimulus_id,
  r ->> 'sourceType'                         AS source_type,
  r ->> 'verdict'                            AS verdict,
  r -> 'selectedQualities'                   AS selected_qualities,
  (r -> 'ratings' ->> 'structuralCorrectness')::INT AS structural_correctness,
  (r -> 'ratings' ->> 'culturalAuthenticity')::INT  AS cultural_authenticity,
  (r -> 'ratings' ->> 'readability')::INT           AS readability,
  r ->> 'annotation'                         AS annotation,
  (r ->> 'drawingData') IS NOT NULL          AS has_drawing,
  (r ->> 'skipped')::BOOLEAN                AS skipped,
  (r ->> 'timeSpentMs')::INT                AS time_spent_ms
FROM study_responses s,
     LATERAL jsonb_array_elements(s.responses) AS r;

-- ============================================================
-- Example query: mean ratings by source type
-- ============================================================
-- SELECT
--   source_type,
--   COUNT(*)                          AS n,
--   ROUND(AVG(structural_correctness)::NUMERIC, 2) AS avg_structural,
--   ROUND(AVG(cultural_authenticity)::NUMERIC, 2)  AS avg_cultural,
--   ROUND(AVG(readability)::NUMERIC, 2)            AS avg_readability,
--   ROUND(100.0 * SUM(CASE WHEN verdict = 'accept' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) AS accept_pct
-- FROM stimulus_responses
-- WHERE NOT skipped
-- GROUP BY source_type
-- ORDER BY source_type;
