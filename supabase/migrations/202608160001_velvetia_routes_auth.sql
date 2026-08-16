-- Run through `supabase db push` or paste once into the Supabase SQL editor.
-- The application continues to use server-side SQL; these grants and RLS
-- policies provide an additional read-only boundary for future direct clients.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.routes (
  id uuid PRIMARY KEY,
  owner_key uuid NOT NULL,
  user_id uuid,
  name varchar(80) NOT NULL,
  current_version integer NOT NULL DEFAULT 1,
  route_data jsonb NOT NULL,
  geometry extensions.geometry(LineString, 4326) NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz
);

ALTER TABLE app.routes ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS routes_owner_updated_idx ON app.routes (owner_key, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS routes_user_updated_idx ON app.routes (user_id, updated_at DESC) WHERE deleted_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS routes_geometry_gix ON app.routes USING gist (geometry);

CREATE TABLE IF NOT EXISTS app.route_versions (
  route_id uuid NOT NULL REFERENCES app.routes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  route_data jsonb NOT NULL,
  geometry extensions.geometry(LineString, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routes_user_id_fkey' AND conrelid = 'app.routes'::regclass) THEN
    ALTER TABLE app.routes
      ADD CONSTRAINT routes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE app.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.route_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS routes_select_own ON app.routes;
CREATE POLICY routes_select_own ON app.routes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS route_versions_select_own ON app.route_versions;
CREATE POLICY route_versions_select_own ON app.route_versions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM app.routes
    WHERE app.routes.id = route_versions.route_id
      AND app.routes.user_id = (SELECT auth.uid())
      AND app.routes.deleted_at IS NULL
  ));

REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA app FROM authenticated;
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT SELECT ON app.routes, app.route_versions TO authenticated;
