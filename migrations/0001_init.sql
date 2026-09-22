CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'guest',
  role TEXT NOT NULL DEFAULT 'user',
  token_cap INTEGER NOT NULL DEFAULT 20000,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  verse_ref TEXT NOT NULL,
  word_id TEXT NOT NULL,
  surface TEXT,
  lemma TEXT,
  field TEXT NOT NULL,
  guess TEXT,
  gold TEXT NOT NULL,
  cue TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX attempts_user_field ON attempts (user_id, field, gold);

CREATE TABLE ai_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt TEXT NOT NULL,
  reply TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX ai_log_user_created ON ai_log (user_id, created_at);
