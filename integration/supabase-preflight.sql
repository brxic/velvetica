-- Non-persistent production-compatible smoke test. All changes are rolled back.
BEGIN;
SET LOCAL search_path = public, extensions;
SET LOCAL statement_timeout = '15s';
ALTER TABLE app.user_preferences ADD COLUMN IF NOT EXISTS planning_defaults jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS app.route_shares (
  route_id uuid PRIMARY KEY REFERENCES app.routes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.route_shares ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  qa_route_id uuid := gen_random_uuid();
  qa_owner_id uuid := gen_random_uuid();
  affected integer;
BEGIN
  INSERT INTO app.routes (id, owner_key, name, route_data, geometry, created_at, updated_at)
  VALUES (qa_route_id, qa_owner_id, 'Transactional QA', '{"name":"Transactional QA"}', ST_GeomFromText('LINESTRING(7.5886 47.5596,7.60 47.56)', 4326), now(), now());
  INSERT INTO app.route_versions (route_id, version, route_data, geometry)
  SELECT id, current_version, route_data, geometry FROM app.routes WHERE id = qa_route_id;
  UPDATE app.routes SET current_version = 2 WHERE id = qa_route_id AND current_version = 1;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Current version update failed'; END IF;
  UPDATE app.routes SET current_version = 3 WHERE id = qa_route_id AND current_version = 1;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Stale update was not rejected'; END IF;
  INSERT INTO app.route_shares (route_id, token_hash) VALUES (qa_route_id, repeat('a', 64));
  CREATE TEMP TABLE qa_route_backup AS SELECT * FROM app.routes WHERE id = qa_route_id;
  CREATE TEMP TABLE qa_route_restored (LIKE app.routes INCLUDING ALL);
  INSERT INTO qa_route_restored SELECT * FROM qa_route_backup;
  IF NOT EXISTS (SELECT 1 FROM qa_route_restored r JOIN qa_route_backup b USING (id) WHERE r.route_data = b.route_data AND ST_Equals(r.geometry, b.geometry) AND r.current_version = b.current_version) THEN
    RAISE EXCEPTION 'Logical route backup/restore failed';
  END IF;
  UPDATE app.routes SET deleted_at = now() WHERE id = qa_route_id;
  IF EXISTS (SELECT 1 FROM app.routes r JOIN app.route_shares s ON s.route_id = r.id WHERE r.id = qa_route_id AND r.deleted_at IS NULL) THEN RAISE EXCEPTION 'Deleted route still shared'; END IF;
END $$;
ROLLBACK;
