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
 IF TG_TABLE_NAME='runs' THEN row_data=row_data||coalesce((SELECT jsonb_build_object('team_id',team_id) FROM campaigns WHERE id=(row_data->>'campaign_id')::uuid),'{}'); END IF;
 IF TG_TABLE_NAME IN ('message_events','ledger') THEN row_data=row_data||coalesce((SELECT jsonb_build_object('team_id',c.team_id) FROM runs r JOIN campaigns c ON c.id=r.campaign_id WHERE r.id=coalesce(NULLIF(row_data->>'run_id','')::uuid,(SELECT run_id FROM messages WHERE id=NULLIF(row_data->>'message_id','')::uuid)) LIMIT 1),'{}'); END IF;
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
 allowed=ARRAY['name','version','status','active','enabled','team_id','role_id','company_scope','permissions','level','timezone','corporate_id','maintenance_enabled','sender','price','currency','effective_from','effective_until','starts_on','ends_on','months','allocated','adjusted','reserved','spent','stages','channel','published','definition_id','account_id','current_version_id','environment','deployed_at','supersedes_id','run_id','message_id','budget_id','amount','kind'];
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO safe_before FROM jsonb_each(before_row) WHERE key=ANY(allowed);
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO safe_after FROM jsonb_each(after_row) WHERE key=ANY(allowed);
 INSERT INTO audit(company_id,team_id,actor_id,action,resource_type,resource_id,detail,ip,correlation_id)
 VALUES(tenant,target_team,actor,'data.'||lower(TG_OP),TG_TABLE_NAME,CASE WHEN TG_TABLE_NAME='message_events' THEN row_data->>'message_id' ELSE coalesce(row_data->>'id',row_data->>'company_id') END,jsonb_build_object('source','database','operation',TG_OP,'changedFields',changed,'before',safe_before,'after',safe_after),coalesce(NULLIF(current_setting('app.ip',true),''),'service'),NULLIF(current_setting('app.correlation_id',true),'')::uuid);
 RETURN COALESCE(NEW,OLD);
END $$;

CREATE TRIGGER business_change_audit AFTER INSERT OR UPDATE OR DELETE ON runs FOR EACH ROW EXECUTE FUNCTION capture_business_change();
CREATE TRIGGER business_change_audit AFTER INSERT OR UPDATE OR DELETE ON message_events FOR EACH ROW EXECUTE FUNCTION capture_business_change();
CREATE TRIGGER business_change_audit AFTER INSERT OR UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION capture_business_change();
