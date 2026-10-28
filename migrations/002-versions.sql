CREATE TABLE IF NOT EXISTS campaign_versions (
  company_id uuid NOT NULL, campaign_id uuid NOT NULL, version int NOT NULL, definition jsonb NOT NULL,
  snapshot jsonb NOT NULL, approval_policy jsonb NOT NULL, submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id,version), FOREIGN KEY(company_id,campaign_id) REFERENCES campaigns(company_id,id)
);
CREATE OR REPLACE FUNCTION enforce_budget_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM cost_centres WHERE id=NEW.cost_centre_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM budgets b WHERE b.cost_centre_id=NEW.cost_centre_id AND b.id<>NEW.id
    AND b.starts_on<NEW.ends_on AND b.ends_on>NEW.starts_on) THEN
    RAISE EXCEPTION 'Overlapping budget period' USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER budget_period_overlap BEFORE INSERT OR UPDATE OF starts_on,ends_on,cost_centre_id ON budgets
FOR EACH ROW EXECUTE FUNCTION enforce_budget_period();
