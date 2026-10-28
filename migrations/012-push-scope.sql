ALTER TABLE notifications ADD CONSTRAINT notifications_company_identity UNIQUE(company_id,id);
ALTER TABLE push_deliveries ADD CONSTRAINT push_notification_company_fk FOREIGN KEY(company_id,notification_id) REFERENCES notifications(company_id,id);
