-- Capture safe business metadata even when a handler forgets a semantic event.
-- No password/token/credential/payload/recipient/source-row values enter snapshots.
CREATE OR REPLACE FUNCTION capture_business_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE before_row jsonb; after_row jsonb; row_data jsonb; tenant uuid; actor uuid; target_team uuid;
 changed jsonb; safe_before jsonb; safe_after jsonb; allowed text[];
BEGIN
 IF current_setting('app.audit_disabled',true)='true' THEN RETURN COALESCE(NEW,OLD); END IF;
 before_row=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_row=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 IF before_row=after_row THEN RETURN COALESCE(NEW,OLD); END IF;
 row_data=CASE WHEN TG_OP='DELETE' THEN before_row ELSE after_row END;
 IF TG_TABLE_NAME='source_keys' THEN row_data=row_data||(SELECT jsonb_build_object('company_id',company_id,'team_id',team_id) FROM source_connections WHERE id=(row_data->>'source_id')::uuid); END IF;
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
 VALUES(tenant,target_team,actor,'data.'||lower(TG_OP),TG_TABLE_NAME,coalesce(row_data->>'id',row_data->>'company_id'),jsonb_build_object('source','database','operation',TG_OP,'changedFields',changed,'before',safe_before,'after',safe_after),coalesce(NULLIF(current_setting('app.ip',true),''),'service'),NULLIF(current_setting('app.correlation_id',true),'')::uuid);
 RETURN COALESCE(NEW,OLD);
END $$;
