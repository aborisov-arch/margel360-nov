-- Three automations in one migration:
--
-- 1. feedback_resent_at — idempotency flag for the one-time feedback re-ask
--    (send-feedback-request resends once, 3 days after the first email, if
--    the customer hasn't submitted).
--
-- 2. archive_stale_enquiries() + weekly cron — keeps the working pipeline
--    short: 'lost' enquiries older than 90 days and 'completed' events more
--    than 90 days past their date move to 'archived'. The auto-block-date
--    trigger only fires on confirmed/completed, so this transition is safe.
--
-- 3. Monthly cron for send-marketing-export — emails the owners a CSV of
--    marketing-consenting customers on the 1st (reuses the shared
--    team_digest_cron_secret Vault entry).

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS feedback_resent_at timestamptz;

-- ── 2. Auto-archive ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_stale_enquiries()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE public.enquiries
    SET pipeline_status = 'archived'
    WHERE
      (pipeline_status = 'lost' AND created_at < now() - interval '90 days')
      OR (
        pipeline_status = 'completed'
        AND preferred_date ~ '^\d{2}/\d{2}/\d{4}$'
        AND to_date(preferred_date, 'DD/MM/YYYY') < (now() - interval '90 days')::date
      )
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$$;

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'archive-stale-enquiries';
SELECT cron.schedule(
  'archive-stale-enquiries',
  '0 5 * * 1',  -- Mondays 05:00 UTC; exact hour is immaterial for archiving
  $$ SELECT public.archive_stale_enquiries(); $$
);

-- ── 3. Monthly marketing export ──────────────────────────────────────────
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'send-marketing-export-monthly';
SELECT cron.schedule(
  'send-marketing-export-monthly',
  '0 6 1 * *',  -- 1st of each month, 06:00 UTC (~09:00 Sofia year-round ±1h)
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-marketing-export',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'team_digest_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
