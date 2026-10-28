ALTER TABLE users ADD CONSTRAINT users_company_identity UNIQUE(company_id,id);
CREATE TABLE platform_administrators (
 user_id uuid PRIMARY KEY REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), user_id uuid NOT NULL,
 device_hash text NOT NULL, endpoint_hash text NOT NULL, credentials_cipher text NOT NULL,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id), FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,id)
);
CREATE UNIQUE INDEX push_active_endpoint_idx ON push_subscriptions(endpoint_hash) WHERE active;
CREATE INDEX push_user_idx ON push_subscriptions(company_id,user_id,active);
CREATE TABLE push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, user_id uuid NOT NULL,
 notification_id uuid NOT NULL REFERENCES notifications(id), subscription_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','SENDING','ACCEPTED','DISPLAYED','FAILED','UNKNOWN','CANCELLED')),
 receipt_hash text NOT NULL, receipt_cipher text NOT NULL, attempt_count int NOT NULL DEFAULT 0,
 locked_until timestamptz, expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(notification_id,subscription_id), FOREIGN KEY(company_id,user_id) REFERENCES users(company_id,id),
 FOREIGN KEY(company_id,subscription_id) REFERENCES push_subscriptions(company_id,id)
);
CREATE INDEX push_dispatch_idx ON push_deliveries(status,created_at);
