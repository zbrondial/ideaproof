ALTER TABLE projects
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'
  CHECK (provider IN ('openai', 'anthropic'));

ALTER TABLE projects
  ADD COLUMN model TEXT NOT NULL DEFAULT 'gpt-5.6';

UPDATE projects
SET model = COALESCE(
  (
    SELECT revisions.model
    FROM revisions
    WHERE revisions.project_id = projects.id
    ORDER BY revisions.created_at, revisions.id
    LIMIT 1
  ),
  'gpt-5.6'
);

ALTER TABLE revisions
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'
  CHECK (provider IN ('openai', 'anthropic'));

ALTER TABLE revisions
  RENAME COLUMN openai_response_id TO provider_response_id;
