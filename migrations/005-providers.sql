CREATE TABLE provider_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL,
  adapter text NOT NULL CHECK(adapter IN ('SIMULATOR','GENERIC_HTTP')), version int NOT NULL DEFAULT 1,
  parent_id uuid, channels jsonb NOT NULL, config jsonb NOT NULL DEFAULT '{}', published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id), validated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id)
);
CREATE TABLE provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true, current_version_id uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,id)
);
CREATE TABLE provider_account_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, account_id uuid NOT NULL,
  definition_id uuid NOT NULL, version int NOT NULL, sender text NOT NULL, credentials_cipher text,
  simulated boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,id), UNIQUE(account_id,version),
  FOREIGN KEY(company_id,account_id) REFERENCES provider_accounts(company_id,id),
  FOREIGN KEY(company_id,definition_id) REFERENCES provider_definitions(company_id,id)
);
ALTER TABLE provider_accounts ADD FOREIGN KEY(company_id,current_version_id) REFERENCES provider_account_versions(company_id,id);
CREATE TABLE rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, account_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN ('email','sms','whatsapp')), price numeric(20,4) NOT NULL CHECK(price>=0),
  currency text NOT NULL DEFAULT 'IDR' CHECK(currency='IDR'), effective_from timestamptz NOT NULL,
  effective_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(effective_until IS NULL OR effective_until>effective_from), UNIQUE(company_id,id),
  FOREIGN KEY(company_id,account_id) REFERENCES provider_accounts(company_id,id)
);
ALTER TABLE messages ADD COLUMN provider_version_id uuid;
ALTER TABLE messages ADD COLUMN rate_id uuid;
ALTER TABLE messages ADD FOREIGN KEY(company_id,provider_version_id) REFERENCES provider_account_versions(company_id,id);
ALTER TABLE messages ADD FOREIGN KEY(company_id,rate_id) REFERENCES rate_cards(company_id,id);
ALTER TABLE templates ADD COLUMN provider_template jsonb NOT NULL DEFAULT '{}';
CREATE INDEX rate_cards_lookup_idx ON rate_cards(company_id,account_id,channel,effective_from);
DO $$
DECLARE c record; definition_id uuid; account_id uuid; version_id uuid;
BEGIN
  FOR c IN SELECT id FROM companies LOOP
    INSERT INTO provider_definitions(company_id,name,adapter,channels,published,validated_at)
      VALUES(c.id,'Local demo provider','SIMULATOR','["email","sms","whatsapp"]',true,now()) RETURNING id INTO definition_id;
    INSERT INTO provider_accounts(company_id,name) VALUES(c.id,'Local simulator') RETURNING id INTO account_id;
    INSERT INTO provider_account_versions(company_id,account_id,definition_id,version,sender,simulated)
      VALUES(c.id,account_id,definition_id,1,'Relay Demo',true) RETURNING id INTO version_id;
    UPDATE provider_accounts SET current_version_id=version_id WHERE id=account_id;
    INSERT INTO rate_cards(company_id,account_id,channel,price,effective_from) VALUES
      (c.id,account_id,'email',10,now()),(c.id,account_id,'sms',350,now()),(c.id,account_id,'whatsapp',500,now());
  END LOOP;
END $$;
