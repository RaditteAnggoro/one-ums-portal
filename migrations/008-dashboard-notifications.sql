ALTER TABLE companies ADD COLUMN dashboard_defaults jsonb NOT NULL DEFAULT '{"widgets":["campaigns","delivery","budget","activity"]}';
ALTER TABLE roles ADD COLUMN dashboard_defaults jsonb;
ALTER TABLE notifications ADD COLUMN event_key text UNIQUE;
