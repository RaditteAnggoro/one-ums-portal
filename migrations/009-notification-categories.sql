ALTER TABLE notifications ADD COLUMN category text NOT NULL DEFAULT 'campaign';
INSERT INTO ledger(company_id,budget_id,kind,amount,idempotency_key,reason)
SELECT company_id,id,'ALLOCATE',allocated,'allocate:'||id::text,'Initial allocation recorded during audit migration'
FROM budgets ON CONFLICT(idempotency_key) DO NOTHING;
