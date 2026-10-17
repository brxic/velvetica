-- Forward-only extension. Existing homes and routes are preserved.
ALTER TABLE app.user_preferences ADD COLUMN IF NOT EXISTS planning_defaults jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS app.route_shares (
  route_id uuid PRIMARY KEY REFERENCES app.routes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.route_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.route_shares FROM anon, authenticated;
-- Sharing is mediated by the server; bearer tokens are stored only as hashes.
