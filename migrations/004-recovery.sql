CREATE TABLE worker_sessions (
  id uuid PRIMARY KEY, last_seen timestamptz NOT NULL DEFAULT now(), started_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE runs ADD COLUMN worker_session_id uuid REFERENCES worker_sessions(id);
CREATE INDEX worker_session_seen_idx ON worker_sessions(last_seen);
