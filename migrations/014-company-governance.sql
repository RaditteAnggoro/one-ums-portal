ALTER TABLE companies ADD COLUMN corporate_id text;
UPDATE companies SET corporate_id='UMS-'||upper(left(replace(id::text,'-',''),12));
ALTER TABLE companies ALTER COLUMN corporate_id SET DEFAULT ('UMS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
ALTER TABLE companies ALTER COLUMN corporate_id SET NOT NULL;
ALTER TABLE companies ADD UNIQUE(corporate_id);
ALTER TABLE companies ADD COLUMN maintenance_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN maintenance_message text NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN maintenance_updated_at timestamptz;
ALTER TABLE roles ADD COLUMN level int NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 99);
UPDATE roles SET level=CASE WHEN permissions ? 'admin:write' THEN 99 WHEN permissions ? 'budgets:write' THEN 30 WHEN permissions ? 'campaigns:approve' THEN 20 WHEN permissions ? 'campaigns:create' THEN 10 ELSE 1 END;
ALTER TABLE users ADD COLUMN employee_id text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN department text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN job_title text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN work_phone text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX users_employee_identity_idx ON users(company_id,lower(employee_id)) WHERE employee_id<>'';
CREATE TABLE releases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
 version text NOT NULL, title text NOT NULL, environment text NOT NULL CHECK(environment IN ('production','staging','development')),
 deployed_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'DEPLOYED' CHECK(status IN ('PLANNED','DEPLOYED','ROLLED_BACK')),
 items jsonb NOT NULL, reference text NOT NULL DEFAULT '', supersedes_id uuid,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id), FOREIGN KEY(company_id,supersedes_id) REFERENCES releases(company_id,id)
);
CREATE INDEX releases_company_date_idx ON releases(company_id,deployed_at DESC,id DESC);
CREATE TABLE release_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,release_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('PLANNED','DEPLOYED','ROLLED_BACK')),reason text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,release_id) REFERENCES releases(company_id,id)
);
CREATE INDEX audit_company_time_idx ON audit(company_id,created_at DESC,id DESC);
CREATE INDEX audit_company_action_time_idx ON audit(company_id,action,created_at DESC,id DESC);
CREATE INDEX audit_company_resource_time_idx ON audit(company_id,resource_type,created_at DESC,id DESC);
