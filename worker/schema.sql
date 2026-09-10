PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS collab_tasks (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL CHECK (brand IN ('haoqi','bayer')),
  module TEXT NOT NULL,
  writer_id TEXT NOT NULL CHECK (writer_id IN ('yangyang','april')),
  writer_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('review_pending','writer_action','confirmed')),
  ai_draft TEXT NOT NULL DEFAULT '',
  initial_draft TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  reuse_as_fewshot INTEGER NOT NULL DEFAULT 0 CHECK (reuse_as_fewshot IN (0,1)),
  writer_unread INTEGER NOT NULL DEFAULT 0 CHECK (writer_unread IN (0,1)),
  reviewer_unread INTEGER NOT NULL DEFAULT 1 CHECK (reviewer_unread IN (0,1)),
  confirmed_by TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collab_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, version_no),
  FOREIGN KEY(task_id) REFERENCES collab_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collab_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  round_no INTEGER NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL CHECK (author_id = 'yixi'),
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, round_no),
  FOREIGN KEY(task_id) REFERENCES collab_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collab_tasks_writer_updated ON collab_tasks(writer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_tasks_status_updated ON collab_tasks(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_versions_task ON collab_versions(task_id, version_no);
CREATE INDEX IF NOT EXISTS idx_collab_feedback_task ON collab_feedback(task_id, round_no);
