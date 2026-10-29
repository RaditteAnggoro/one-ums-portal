-- Capture safe business metadata even when a handler forgets a semantic event.
-- No password/token/credential/payload/recipient/source-row values enter snapshots.
CREATE FUNCTION capture_business_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_row jsonb; after_row jsonb; row_data jsonb; tenant uuid; actor uuid; target_team uuid;
 changed jsonb; safe_before jsonb; safe_after jsonb; allowed text[];
BEGIN
 IF current_setting('app.audit_disabled',true)='true' THEN RETURN COALESCE(NEW,OLD); END IF;
 before_row=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_row=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 IF before_row=after_row THEN RETURN COALESCE(NEW,OLD); END IF;
 row_data=CASE WHEN TG_OP='DELETE' THEN before_row ELSE after_row END;
 tenant=CASE WHEN TG_TABLE_NAME='companies' THEN (row_data->>'id')::uuid ELSE (row_data->>'company_id')::uuid END;
 IF tenant IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 target_team=NULLIF(row_data->>'team_id','')::uuid;
 IF target_team IS NULL THEN
   SELECT id INTO target_team FROM teams WHERE id=NULLIF(current_setting('app.team_id',true),'')::uuid AND company_id=tenant;
 END IF;
 SELECT coalesce(jsonb_agg(key ORDER BY key),'[]') INTO changed FROM (
   SELECT key FROM jsonb_object_keys(before_row||after_row) AS key WHERE before_row->key IS DISTINCT FROM after_row->key
 ) fields;
 allowed=ARRAY['name','version','status','active','enabled','team_id','role_id','company_scope','permissions','level','timezone','corporate_id','maintenance_enabled','sender','price','currency','effective_from','effective_until','starts_on','ends_on','months','allocated','adjusted','reserved','spent','stages','channel','published','definition_id','account_id','current_version_id','environment','deployed_at','supersedes_id'];
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO safe_before FROM jsonb_each(before_row) WHERE key=ANY(allowed);
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO safe_after FROM jsonb_each(after_row) WHERE key=ANY(allowed);
 INSERT INTO audit(company_id,team_id,actor_id,action,resource_type,resource_id,detail,ip,correlation_id)
 VALUES(tenant,target_team,actor,'data.'||lower(TG_OP),TG_TABLE_NAME,row_data->>'id',jsonb_build_object('source','database','operation',TG_OP,'changedFields',changed,'before',safe_before,'after',safe_after),coalesce(NULLIF(current_setting('app.ip',true),''),'service'),NULLIF(current_setting('app.correlation_id',true),'')::uuid);
 RETURN COALESCE(NEW,OLD);
END $$;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['companies','teams','roles','users','approval_policies','cost_centres','budgets','templates','datasets','source_connections','source_keys','provider_definitions','provider_accounts','provider_account_versions','rate_cards','campaigns','campaign_versions','approvals','releases','release_events'] LOOP
  EXECUTE format('CREATE TRIGGER business_change_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION capture_business_change()',t);
 END LOOP;
END $$;
