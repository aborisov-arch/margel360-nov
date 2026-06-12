-- Customer event reminders. Fires once each morning at ~10:00 Europe/Sofia
-- and POSTs to the send-event-reminders edge function (day-before + deposit-due
-- reminders). Same DST split as the other crons.
--   Apr-Oct (EEST, UTC+3): 07:00 UTC = 10:00 Sofia
--   Nov-Mar (EET,  UTC+2): 08:00 UTC = 10:00 Sofia
--
-- Reuses the TEAM_DIGEST_CRON_SECRET / Vault `team_digest_cron_secret` pair
-- (one shared secret guards both internal cron functions).

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'send-event-reminders-summer',
  'send-event-reminders-winter'
);

SELECT cron.schedule(
  'send-event-reminders-summer',
  '0 7 * 4-10 *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'team_digest_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

SELECT cron.schedule(
  'send-event-reminders-winter',
  '0 8 * 1-3,11-12 *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'team_digest_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
