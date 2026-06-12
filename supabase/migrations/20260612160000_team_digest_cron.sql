-- Daily team digest. Fires once each morning at ~09:00 Europe/Sofia and POSTs
-- to the send-team-digest edge function, which emails the team the follow-ups
-- due, stale leads, unanswered enquiries, upcoming events and outstanding
-- deposits for the day.
--
-- Same DST split as the feedback cron (20260601100000): pg_cron on Supabase
-- can't set cron.timezone without a DB restart, so we run two month-ranged
-- jobs. The two DST-transition weeks (late Mar / late Oct) will be off by an
-- hour, which is harmless for a morning digest.
--   Apr-Oct (EEST, UTC+3): 06:00 UTC = 09:00 Sofia
--   Nov-Mar (EET,  UTC+2): 07:00 UTC = 09:00 Sofia
--
-- The cron secret lives in the Vault as `team_digest_cron_secret` (mirrors the
-- TEAM_DIGEST_CRON_SECRET function secret). Rotate BOTH together.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'send-team-digest-summer',
  'send-team-digest-winter'
);

SELECT cron.schedule(
  'send-team-digest-summer',
  '0 6 * 4-10 *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-team-digest',
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
  'send-team-digest-winter',
  '0 7 * 1-3,11-12 *',
  $$
  SELECT net.http_post(
    url := 'https://wlxutsufrobzovdsiecb.supabase.co/functions/v1/send-team-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'team_digest_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
