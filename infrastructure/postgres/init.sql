CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS geo;

CREATE TABLE IF NOT EXISTS app.routes (
  id uuid PRIMARY KEY, owner_key uuid NOT NULL, name varchar(80) NOT NULL,
  current_version integer NOT NULL DEFAULT 1, route_data jsonb NOT NULL,
  geometry geometry(LineString, 4326) NOT NULL,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS routes_owner_updated_idx ON app.routes (owner_key, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS routes_geometry_gix ON app.routes USING gist (geometry);

CREATE TABLE IF NOT EXISTS app.route_versions (
  route_id uuid NOT NULL REFERENCES app.routes(id) ON DELETE CASCADE,
  version integer NOT NULL, route_data jsonb NOT NULL,
  geometry geometry(LineString, 4326) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, version)
);
