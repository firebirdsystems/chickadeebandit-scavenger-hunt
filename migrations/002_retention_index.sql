-- Hunts now expire after a year, cascading tasks, submissions (whose
-- photo_file_id frees the R2 proof photos) and awards. This index covers the
-- runner's parent age scan; the child FK indexes from 001 cover the cascade.
CREATE INDEX IF NOT EXISTS app_scavenger_hunt__hunts_retention_idx
  ON app_scavenger_hunt__hunts (created_at, id);
