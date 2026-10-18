-- Additive, private OSM index. Apply explicitly, never during user requests.
BEGIN;
SET LOCAL search_path = public, extensions;
CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE IF NOT EXISTS app.poi_sources (
  region_id text PRIMARY KEY,
  snapshot_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app.supply_pois (
  region_id text NOT NULL REFERENCES app.poi_sources(region_id),
  osm_type text NOT NULL CHECK (osm_type IN ('node','way','relation')),
  osm_id bigint NOT NULL CHECK (osm_id > 0),
  category text NOT NULL CHECK (category IN ('water','food','shop')),
  position geography(Point,4326) NOT NULL,
  properties jsonb NOT NULL,
  source_updated_at timestamptz,
  PRIMARY KEY(region_id,osm_type,osm_id)
);
CREATE INDEX IF NOT EXISTS supply_pois_position_gix ON app.supply_pois USING gist(position);
CREATE INDEX IF NOT EXISTS supply_pois_category_idx ON app.supply_pois(region_id,category);
ALTER TABLE app.poi_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.supply_pois ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.poi_sources, app.supply_pois FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON app.poi_sources, app.supply_pois FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON app.poi_sources, app.supply_pois FROM authenticated; END IF;
END $$;
COMMIT;
