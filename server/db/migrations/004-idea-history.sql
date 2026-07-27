CREATE TABLE idea_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  idea_name TEXT NOT NULL,
  idea TEXT NOT NULL,
  update_note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, version)
);

CREATE INDEX idea_versions_project_created_at
  ON idea_versions(project_id, created_at DESC);

ALTER TABLE projects
  ADD COLUMN current_idea_version_id TEXT REFERENCES idea_versions(id);

ALTER TABLE revisions
  ADD COLUMN idea_version_id TEXT REFERENCES idea_versions(id);

INSERT INTO idea_versions
  (id, project_id, version, idea_name, idea, update_note, created_at)
SELECT id, id, 1, title, idea, NULL, created_at
FROM projects;

UPDATE projects
SET current_idea_version_id = id;

UPDATE revisions
SET idea_version_id = project_id;
