-- Sync-stamp for the financials drift-refresh feature.
--
-- Stamped at P&L creation (ensureFinancialEvent) and on every future
-- "Опресни от заявката" refresh action. Compared against
-- enquiries.last_edited_at to drive the drift banner: if the enquiry was
-- edited after this timestamp, the saved P&L numbers may be stale. NULL on
-- legacy rows created before this column existed — those fall back to
-- comparing against financial_events.created_at.
ALTER TABLE public.financial_events
  ADD COLUMN IF NOT EXISTS enquiry_synced_at timestamptz;

COMMENT ON COLUMN public.financial_events.enquiry_synced_at IS
  'Stamped at P&L creation and on every "Опресни от заявката". Compared against enquiries.last_edited_at for the drift banner; NULL legacy rows fall back to created_at.';
