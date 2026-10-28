CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Jakarta'
);
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL,
  UNIQUE(company_id,id)
);
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL,
  permissions jsonb NOT NULL, company_scope boolean NOT NULL DEFAULT false, UNIQUE(company_id,id), UNIQUE(company_id,name)
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), team_id uuid NOT NULL,
  role_id uuid NOT NULL, email text UNIQUE NOT NULL, name text NOT NULL, password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true, profile jsonb NOT NULL DEFAULT '{}',
  FOREIGN KEY(company_id,team_id) REFERENCES teams(company_id,id), FOREIGN KEY(company_id,role_id) REFERENCES roles(company_id,id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS approval_policies (
  company_id uuid PRIMARY KEY REFERENCES companies(id), version int NOT NULL DEFAULT 1, stages jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), team_id uuid NOT NULL,
  name text NOT NULL, channel text NOT NULL CHECK(channel IN ('email','sms','whatsapp')), body text NOT NULL,
  version int NOT NULL DEFAULT 1, parent_id uuid, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,id), FOREIGN KEY(company_id,team_id) REFERENCES teams(company_id,id)
);
CREATE TABLE IF NOT EXISTS datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), team_id uuid NOT NULL,
  name text NOT NULL, rows jsonb NOT NULL, version int NOT NULL DEFAULT 1, source text NOT NULL DEFAULT 'upload',
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id),
  FOREIGN KEY(company_id,team_id) REFERENCES teams(company_id,id)
);
CREATE TABLE IF NOT EXISTS cost_centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), team_id uuid NOT NULL,
  name text NOT NULL, UNIQUE(company_id,id), FOREIGN KEY(company_id,team_id) REFERENCES teams(company_id,id)
);
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), cost_centre_id uuid NOT NULL,
  starts_on date NOT NULL, ends_on date NOT NULL, months int NOT NULL CHECK(months IN (1,3,6,12)),
  allocated numeric(20,4) NOT NULL CHECK(allocated>=0), adjusted numeric(20,4) NOT NULL DEFAULT 0,
  reserved numeric(20,4) NOT NULL DEFAULT 0 CHECK(reserved>=0), spent numeric(20,4) NOT NULL DEFAULT 0 CHECK(spent>=0),
  simulated boolean NOT NULL DEFAULT true, CHECK(ends_on>starts_on), UNIQUE(company_id,id),
  FOREIGN KEY(company_id,cost_centre_id) REFERENCES cost_centres(company_id,id)
);
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), team_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id), name text NOT NULL, version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT', definition jsonb NOT NULL, snapshot jsonb,
  approval_policy jsonb, approval_stage int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,id), FOREIGN KEY(company_id,team_id) REFERENCES teams(company_id,id)
);
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, campaign_id uuid NOT NULL, version int NOT NULL,
  stage int NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), decision text NOT NULL, reason text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,version,stage),
  FOREIGN KEY(company_id,campaign_id) REFERENCES campaigns(company_id,id)
);
CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, campaign_id uuid NOT NULL, version int NOT NULL,
  occurrence_key text UNIQUE NOT NULL, intended_at timestamptz NOT NULL, status text NOT NULL,
  budget_id uuid, estimated numeric(20,4) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,id), FOREIGN KEY(company_id,campaign_id) REFERENCES campaigns(company_id,id),
  FOREIGN KEY(company_id,budget_id) REFERENCES budgets(company_id,id)
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, run_id uuid NOT NULL,
  recipient text NOT NULL, channel text NOT NULL, body text NOT NULL, status text NOT NULL DEFAULT 'QUEUED',
  unit_cost numeric(20,4) NOT NULL, demo_outcome text NOT NULL DEFAULT 'delivered', provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id,channel,recipient), UNIQUE(company_id,id), FOREIGN KEY(company_id,run_id) REFERENCES runs(company_id,id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, message_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'local-simulator', status text NOT NULL, detail text,
  created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(company_id,message_id) REFERENCES messages(company_id,id)
);
CREATE TABLE IF NOT EXISTS message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, message_id uuid NOT NULL,
  event_key text UNIQUE NOT NULL, status text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id,message_id) REFERENCES messages(company_id,id)
);
CREATE TABLE IF NOT EXISTS ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, budget_id uuid NOT NULL,
  run_id uuid, message_id uuid, kind text NOT NULL, amount numeric(20,4) NOT NULL, idempotency_key text UNIQUE NOT NULL,
  reason text, actor_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id,budget_id) REFERENCES budgets(company_id,id)
);
CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES messages(id),
  published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, team_id uuid NOT NULL,
  title text NOT NULL, body text NOT NULL, resource_id uuid, read_by jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(company_id,team_id) REFERENCES teams(company_id,id)
);
CREATE TABLE IF NOT EXISTS audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, team_id uuid, actor_id uuid REFERENCES users(id),
  action text NOT NULL, resource_type text NOT NULL, resource_id text, detail jsonb NOT NULL DEFAULT '{}',
  ip text, correlation_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_scope_idx ON campaigns(company_id,team_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_scope_idx ON audit(company_id,team_id,created_at DESC);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS messages_run_idx ON messages(company_id,run_id,status);
CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status,intended_at);
