-- Daily ops/retention lifecycle. ~08:00–09:00 Europe/Sofia (06:00 UTC) so the
-- team run sheet lands early. POSTs to send-ops-lifecycle; reuses the shared
-- team_digest_cron_secret. Single year-round job — exact hour is immaterial.
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'send-ops-lifecycle';
SELECT cron.schedule(
  'send-ops-lifecycle',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-ops-lifecycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'team_digest_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
