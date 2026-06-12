-- Tracks when the one-click "Send offer" action last emailed the offer to the
-- customer (visibility + so the dashboard can show "offer sent" state).
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS offer_sent_at timestamptz;
