CREATE INDEX IF NOT EXISTS enquiries_tenant_id_created_at_idx ON enquiries(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS enquiries_listing_id_state_idx ON enquiries(listing_id, state);
CREATE INDEX IF NOT EXISTS viewing_requests_tenant_id_created_at_idx ON viewing_requests(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS viewing_requests_listing_id_status_idx ON viewing_requests(listing_id, status);
CREATE INDEX IF NOT EXISTS reports_listing_id_status_idx ON reports(listing_id, status);
CREATE INDEX IF NOT EXISTS reports_reporter_id_created_at_idx ON reports(reporter_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_open_per_reporter_listing_idx ON reports(reporter_id, listing_id) WHERE status IN ('OPEN', 'REVIEWING');

CREATE TABLE IF NOT EXISTS notification_outbox (
  id text PRIMARY KEY,
  recipient_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_outbox_status_available_at_idx ON notification_outbox(status, available_at);
CREATE INDEX IF NOT EXISTS notification_outbox_recipient_id_created_at_idx ON notification_outbox(recipient_id, created_at);
