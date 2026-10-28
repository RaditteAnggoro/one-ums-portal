ALTER TABLE campaigns ADD COLUMN revised_by uuid REFERENCES users(id);
ALTER TABLE campaign_versions ADD COLUMN submitted_by uuid REFERENCES users(id);
