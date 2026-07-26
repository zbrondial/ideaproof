CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  idea TEXT NOT NULL,
  technology_preference TEXT NOT NULL,
  nda_purpose TEXT NOT NULL,
  nda_details TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'generating', 'review', 'pending', 'confirmed', 'failed')
  ),
  selected_specification_revision_id TEXT,
  selected_nda_revision_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN ('specification', 'nda')),
  version INTEGER NOT NULL CHECK (version > 0),
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL CHECK (word_count >= 0),
  feedback TEXT,
  prompt_template_version TEXT NOT NULL,
  model TEXT NOT NULL,
  openai_response_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, document_type, version)
);

CREATE UNIQUE INDEX revisions_project_document_id
  ON revisions(project_id, document_type, id);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE RESTRICT,
  specification_revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE RESTRICT,
  nda_revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE RESTRICT,
  approved_at TEXT NOT NULL,
  package_path TEXT NOT NULL
);

CREATE TABLE proof_artifacts (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES approvals(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN ('specification', 'nda')),
  pdf_path TEXT NOT NULL,
  markdown_path TEXT NOT NULL,
  ots_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  bitcoin_block_height INTEGER,
  confirmed_at TEXT,
  last_checked_at TEXT,
  error_code TEXT,
  UNIQUE (approval_id, document_type)
);

CREATE INDEX projects_status_updated_at
  ON projects(status, updated_at DESC);
CREATE INDEX projects_updated_at
  ON projects(updated_at DESC);
CREATE INDEX revisions_project_created_at
  ON revisions(project_id, created_at);
CREATE INDEX proof_artifacts_approval
  ON proof_artifacts(approval_id);
