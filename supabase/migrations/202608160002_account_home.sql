CREATE TABLE IF NOT EXISTS app.user_preferences (
  user_id uuid PRIMARY KEY,
  home_label varchar(200),
  home_longitude double precision,
  home_latitude double precision,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_home_complete CHECK (
    (home_label IS NULL AND home_longitude IS NULL AND home_latitude IS NULL)
    OR (home_label IS NOT NULL AND home_longitude IS NOT NULL AND home_latitude IS NOT NULL)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_user_id_fkey'
      AND conrelid = 'app.user_preferences'::regclass
  ) THEN
    ALTER TABLE app.user_preferences
      ADD CONSTRAINT user_preferences_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE app.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON app.user_preferences;
CREATE POLICY user_preferences_select_own ON app.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON app.user_preferences FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON app.user_preferences FROM authenticated;
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT SELECT ON app.user_preferences TO authenticated;
