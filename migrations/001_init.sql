-- Scavenger Hunt — photo-proof submissions sealed until the organizer closes.
--
-- The security model (manifest.json), per table:
--
-- `hunts`: owner_or_visibility + write_owner_only — everyone sees hunts, only
-- the organizer (created_by) may edit or close one. Closing is the reveal.
--
-- `tasks` ("find a red leaf"): inherit_visibility with
-- insert_only_by_parent_column_member = hunts.created_by — only the organizer
-- may add tasks, hub-enforced even for raw SQL.
--
-- `submissions`: sealed_until — a hunter sees only their own submissions
-- until the hunt closes, then everything reveals at once. One submission per
-- member per task (max_per_member); frozen after close (frozen_when).
-- The photo itself lives in hub file storage; `photo_file_id` references it.
-- File contents are reachable only via their unguessable ids (the files
-- channel has no row policies), which matches the game's casual stakes.
--
-- `awards`: organizer-only INSERT (same parent-column gate); one per
-- submission; the scoreboard derives from these.
CREATE TABLE IF NOT EXISTS app_scavenger_hunt__hunts (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,                    -- "Backyard Safari"
  status     TEXT NOT NULL DEFAULT 'draft',    -- draft|open|closed
  visibility TEXT NOT NULL DEFAULT 'everyone',
  created_by TEXT NOT NULL,                    -- the organizer
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_scavenger_hunt__tasks (
  id         TEXT PRIMARY KEY,
  hunt_id    TEXT NOT NULL,
  title      TEXT NOT NULL,                    -- "Something older than Dad"
  points     INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (hunt_id) REFERENCES app_scavenger_hunt__hunts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_scavenger_hunt__submissions (
  id            TEXT PRIMARY KEY,
  hunt_id       TEXT NOT NULL,
  task_id       TEXT NOT NULL,
  member_id     TEXT NOT NULL,
  photo_file_id TEXT NOT NULL DEFAULT '',      -- hub file id of the proof photo
  caption       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  FOREIGN KEY (hunt_id) REFERENCES app_scavenger_hunt__hunts(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES app_scavenger_hunt__tasks(id) ON DELETE CASCADE,
  UNIQUE (task_id, member_id)
);

CREATE TABLE IF NOT EXISTS app_scavenger_hunt__awards (
  id             TEXT PRIMARY KEY,
  hunt_id        TEXT NOT NULL,
  submission_id  TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  awarded_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  FOREIGN KEY (hunt_id) REFERENCES app_scavenger_hunt__hunts(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES app_scavenger_hunt__submissions(id) ON DELETE CASCADE,
  UNIQUE (submission_id)
);

CREATE INDEX IF NOT EXISTS app_scavenger_hunt__tasks_hunt_idx
  ON app_scavenger_hunt__tasks (hunt_id, sort_order);

CREATE INDEX IF NOT EXISTS app_scavenger_hunt__submissions_hunt_idx
  ON app_scavenger_hunt__submissions (hunt_id, task_id);

CREATE INDEX IF NOT EXISTS app_scavenger_hunt__awards_hunt_idx
  ON app_scavenger_hunt__awards (hunt_id);
