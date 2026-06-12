-- Weekly KPI email. Monday mornings, POSTs to send-weekly-kpi (past-7-days
-- numbers + live pipeline snapshot to the owners). Reuses the shared
-- team_digest_cron_secret Vault entry like the other internal crons.
-- Single year-round job — 07:00 UTC = 09:00/10:00 Sofia depending on DST,
-- both perfectly fine for a weekly report.

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'send-weekly-kpi';
SELECT cron.schedule(
  'send-weekly-kpi',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-weekly-kpi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'team_digest_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
