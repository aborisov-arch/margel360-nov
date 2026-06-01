
-- Add a shared secret so only pg_cron can invoke send-feedback-request.
-- The secret is stored in Vault and the cron job reads it at runtime, so it
-- never appears in the cron.job table in plaintext. The edge function reads
-- the same value from the FEEDBACK_CRON_SECRET env var and compares against
-- the x-cron-secret header.
--
-- Operator setup (run once, outside migrations):
--   INSERT INTO vault.secrets (name, secret) VALUES ('feedback_cron_secret', '<long-random-string>');
--   AND set FEEDBACK_CRON_SECRET to the same value in the edge function env.

SELECT cron.unschedule('send-feedback-request-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-feedback-request-daily');

SELECT cron.schedule(
  'send-feedback-request-daily',
  '0 10 * * *',
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
