CREATE TABLE source_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, team_id uuid NOT NULL,
  name text NOT NULL, type text NOT NULL CHECK(type IN ('REST','INCOMING')), config jsonb NOT NULL DEFAULT '{}',
  version int NOT NULL DEFAULT 1, last_data_version int NOT NULL DEFAULT 0, created_by uuid NOT NULL REFERENCES users(id),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,id), FOREIGN KEY(company_id,team_id) REFERENCES teams(company_id,id)
);
ALTER TABLE datasets ADD COLUMN source_id uuid;
ALTER TABLE datasets ADD FOREIGN KEY(company_id,source_id) REFERENCES source_connections(company_id,id);
CREATE TABLE source_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES source_connections(id),
  token_hash text UNIQUE NOT NULL, created_by uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ingestion_requests (
  source_id uuid NOT NULL REFERENCES source_connections(id), idempotency_key text NOT NULL,
  body_hash text NOT NULL, dataset_id uuid NOT NULL REFERENCES datasets(id), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_id,idempotency_key)
);
