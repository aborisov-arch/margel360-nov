-- Post-event survey v3 (2026-09-27, per the owner): the five v2 questions
-- rated 1-6 stars instead of 1-5. v2 answers keep form_version 2 and their
-- 1-5 scale (a page opened before the switch still submits them), so the five
-- rating columns now accept 1-6, with 6 allowed only on v3 answers.
ALTER TABLE public.event_feedback
  DROP CONSTRAINT event_feedback_form_version_check,
  DROP CONSTRAINT event_feedback_organization_rating_check,
  DROP CONSTRAINT event_feedback_website_rating_check,
  DROP CONSTRAINT event_feedback_overall_rating_check,
  DROP CONSTRAINT event_feedback_cleanliness_rating_check,
  DROP CONSTRAINT event_feedback_team_rating_check,
  DROP CONSTRAINT event_feedback_v2_complete;

ALTER TABLE public.event_feedback
  ADD CONSTRAINT event_feedback_form_version_check CHECK (form_version IN (1, 2, 3)),
  ADD CONSTRAINT event_feedback_organization_rating_check CHECK (organization_rating BETWEEN 1 AND 6),
  ADD CONSTRAINT event_feedback_website_rating_check CHECK (website_rating BETWEEN 1 AND 6),
  ADD CONSTRAINT event_feedback_overall_rating_check CHECK (overall_rating BETWEEN 1 AND 6),
  ADD CONSTRAINT event_feedback_cleanliness_rating_check CHECK (cleanliness_rating BETWEEN 1 AND 6),
  ADD CONSTRAINT event_feedback_team_rating_check CHECK (team_rating BETWEEN 1 AND 6),
  -- A v2 or v3 answer always carries all five ratings; a v2 answer stays 1-5.
  ADD CONSTRAINT event_feedback_v2_v3_complete CHECK (form_version NOT IN (2, 3) OR (
    organization_rating IS NOT NULL AND website_rating IS NOT NULL AND overall_rating IS NOT NULL
    AND cleanliness_rating IS NOT NULL AND team_rating IS NOT NULL)),
  ADD CONSTRAINT event_feedback_v2_scale CHECK (form_version <> 2 OR GREATEST(
    organization_rating, website_rating, overall_rating, cleanliness_rating, team_rating) <= 5);
