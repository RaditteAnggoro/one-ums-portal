CREATE INDEX runs_company_budget_idx ON runs(company_id,budget_id,id);
CREATE INDEX messages_company_connection_created_idx ON messages(company_id,provider_version_id,created_at DESC,id DESC);
