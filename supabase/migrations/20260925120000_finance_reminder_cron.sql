-- Month-end reminder for missing finance data (electricity bills, bottle
-- purchase prices). pg_cron has no "last day of month", so the job runs on
-- the 28th–31st at 15:00 UTC (17:00/18:00 Sofia) and send-finance-reminder
-- only sends when tomorrow is a new month in Sofia. Reuses the shared
-- team_digest_cron_secret Vault entry like the other internal crons.

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'send-finance-reminder';
SELECT cron.schedule(
  'send-finance-reminder',
  '0 15 28-31 * *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-finance-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'team_digest_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
