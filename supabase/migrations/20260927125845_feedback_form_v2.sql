-- Post-event survey v2 (2026-09-27, per the owner): five questions rated
-- 1-5 stars, how they heard about us (the existing source/source_other) and
-- one open question. Answers to the v1 form (four questions rated 1-4, a
-- comment each) keep their columns; form_version tells the two apart.
ALTER TABLE public.event_feedback
  ADD COLUMN IF NOT EXISTS form_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS organization_rating int,
  ADD COLUMN IF NOT EXISTS website_rating int,
  ADD COLUMN IF NOT EXISTS overall_rating int,
  ADD COLUMN IF NOT EXISTS cleanliness_rating int,
  ADD COLUMN IF NOT EXISTS team_rating int,
  ADD COLUMN IF NOT EXISTS improvement_comment text;

ALTER TABLE public.event_feedback
  ADD CONSTRAINT event_feedback_form_version_check CHECK (form_version IN (1, 2)),
  ADD CONSTRAINT event_feedback_organization_rating_check CHECK (organization_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT event_feedback_website_rating_check CHECK (website_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT event_feedback_overall_rating_check CHECK (overall_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT event_feedback_cleanliness_rating_check CHECK (cleanliness_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT event_feedback_team_rating_check CHECK (team_rating BETWEEN 1 AND 5),
  -- A v2 answer always carries all five ratings.
  ADD CONSTRAINT event_feedback_v2_complete CHECK (form_version <> 2 OR (
    organization_rating IS NOT NULL AND website_rating IS NOT NULL AND overall_rating IS NOT NULL
    AND cleanliness_rating IS NOT NULL AND team_rating IS NOT NULL));
