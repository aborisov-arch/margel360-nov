
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Daily at 10:00 UTC ≈ 12:00 BG winter / 13:00 BG summer. The edge function
-- self-filters to "events that happened yesterday in Europe/Sofia" so the
-- exact UTC hour is not critical, only that it runs once per day.
SELECT cron.unschedule('send-feedback-request-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-feedback-request-daily');

SELECT cron.schedule(
  'send-feedback-request-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-feedback-request',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
