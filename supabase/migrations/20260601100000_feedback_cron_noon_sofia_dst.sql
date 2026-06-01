
-- Fire at 12:00 Europe/Sofia. pg_cron on Supabase doesn't support CRON_TZ
-- prefixes and cron.timezone can't be set without restarting the DB, so we
-- split into two jobs by month range matching EU DST:
--   Apr-Oct (EEST, UTC+3): 09:00 UTC = 12:00 Sofia
--   Nov-Mar (EET,  UTC+2): 10:00 UTC = 12:00 Sofia
-- The two DST-transition weeks (late Mar / late Oct) will be off by an hour.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'send-feedback-request-daily',
  'send-feedback-request-summer',
  'send-feedback-request-winter'
);

SELECT cron.schedule(
  'send-feedback-request-summer',
  '0 9 * 4-10 *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-feedback-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'feedback_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

SELECT cron.schedule(
  'send-feedback-request-winter',
  '0 10 * 1-3,11-12 *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-feedback-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'feedback_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
