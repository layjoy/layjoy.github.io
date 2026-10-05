-- 后端只保存家庭标识、校验值和密文。不要加答题、心情、口令的明文字段。

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id TEXT NOT NULL,
  family_id TEXT NOT NULL REFERENCES families (id),
  kind TEXT NOT NULL CHECK (kind IN ('rules', 'usage', 'activity', 'habit', 'emotion')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (family_id, id)
);
