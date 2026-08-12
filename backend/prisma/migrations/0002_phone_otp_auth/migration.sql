CREATE TABLE IF NOT EXISTS app_accounts (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_accounts ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS auth_otp_challenges (
  id uuid PRIMARY KEY,
  phone_hash text NOT NULL,
  phone_encrypted bytea NOT NULL,
  code_hash text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('LOGIN', 'REGISTER')),
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  display_name text,
  registration_role text,
  device_hash text NOT NULL,
  ip_hash text NOT NULL,
  attempts_remaining integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_otp_phone_created_idx ON auth_otp_challenges(phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_otp_expiry_idx ON auth_otp_challenges(expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  action text NOT NULL,
  key_hash text NOT NULL,
  count integer NOT NULL,
  window_expires_at timestamptz NOT NULL,
  PRIMARY KEY (action, key_hash)
);
