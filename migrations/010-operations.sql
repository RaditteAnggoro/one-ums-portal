CREATE INDEX messages_company_created_idx ON messages(company_id,created_at DESC,id DESC);
CREATE INDEX messages_company_status_created_idx ON messages(company_id,status,created_at DESC,id DESC);
CREATE INDEX messages_company_provider_ref_idx ON messages(company_id,provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX attempts_message_idx ON attempts(company_id,message_id);
CREATE INDEX ledger_message_kind_idx ON ledger(company_id,message_id,kind);
CREATE INDEX campaigns_team_idx ON campaigns(company_id,team_id,id);
