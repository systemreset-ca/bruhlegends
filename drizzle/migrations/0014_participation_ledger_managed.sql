-- Group-scoped participation points. No seasons or earning rules are seeded.
ALTER TABLE public.group_members ADD COLUMN participation_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE public.participation_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  rule_version text NOT NULL CHECK (length(rule_version) BETWEEN 1 AND 64),
  network text NOT NULL CHECK (network IN ('devnet','mainnet-beta')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','closed')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  weights jsonb NOT NULL,
  member_daily_cap integer NOT NULL CHECK (member_daily_cap BETWEEN 1 AND 1000000000),
  member_season_cap integer NOT NULL CHECK (member_season_cap BETWEEN 1 AND 1000000000),
  pair_daily_cap integer NOT NULL CHECK (pair_daily_cap BETWEEN 1 AND 1000000000),
  season_budget integer NOT NULL CHECK (season_budget BETWEEN 1 AND 1000000000),
  tester_cap integer NOT NULL CHECK (tester_cap BETWEEN 0 AND 1000000000),
  approval_record text CHECK (length(approval_record) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,group_id), UNIQUE(group_id,rule_version)
);
CREATE UNIQUE INDEX participation_one_active ON public.participation_seasons(group_id) WHERE status='active';

CREATE TABLE public.participation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL,
  group_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('legitimate_call','group_referral','tester_bonus')),
  evidence_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(season_id,group_id) REFERENCES public.participation_seasons(id,group_id),
  FOREIGN KEY(membership_id,group_id) REFERENCES public.group_members(id,group_id),
  FOREIGN KEY(reviewer_id,group_id) REFERENCES public.group_members(id,group_id),
  UNIQUE(season_id,source_kind,evidence_id), UNIQUE(id,group_id)
);

CREATE TABLE public.participation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL,
  group_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  counterparty_id uuid,
  source_kind text NOT NULL CHECK (source_kind IN ('tip_sent','tip_received','active_day','legitimate_call','group_referral','tester_bonus','adjustment')),
  source_id uuid NOT NULL,
  rule_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('awarded','held','adjustment')),
  points integer NOT NULL,
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z_]{1,64}$'),
  earning_day date NOT NULL,
  reverses_event_id uuid REFERENCES public.participation_events(id),
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(season_id,group_id) REFERENCES public.participation_seasons(id,group_id),
  FOREIGN KEY(membership_id,group_id) REFERENCES public.group_members(id,group_id),
  FOREIGN KEY(counterparty_id,group_id) REFERENCES public.group_members(id,group_id),
  FOREIGN KEY(actor_id,group_id) REFERENCES public.group_members(id,group_id),
  CHECK ((status='awarded' AND points>0 AND reverses_event_id IS NULL) OR
         (status='held' AND points=0 AND reverses_event_id IS NULL) OR
         (status='adjustment' AND points<0 AND reverses_event_id IS NOT NULL AND actor_id IS NOT NULL)),
  UNIQUE(season_id,membership_id,source_kind,source_id)
);
CREATE INDEX participation_member_history ON public.participation_events(group_id,membership_id,created_at DESC);
CREATE UNIQUE INDEX participation_active_day_once ON public.participation_events(season_id,membership_id,earning_day) WHERE source_kind='active_day';

CREATE FUNCTION public.participation_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME='participation_seasons' AND TG_OP='UPDATE'
    AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'participation history and rules are immutable';
END; $$;
CREATE TRIGGER participation_seasons_immutable BEFORE UPDATE OR DELETE ON public.participation_seasons FOR EACH ROW EXECUTE FUNCTION public.participation_immutable();
CREATE TRIGGER participation_events_immutable BEFORE UPDATE OR DELETE ON public.participation_events FOR EACH ROW EXECUTE FUNCTION public.participation_immutable();
CREATE TRIGGER participation_reviews_immutable BEFORE UPDATE OR DELETE ON public.participation_reviews FOR EACH ROW EXECUTE FUNCTION public.participation_immutable();

CREATE FUNCTION public.create_participation_season(
 p_group uuid,p_name text,p_version text,p_network text,p_start timestamptz,p_end timestamptz,
 p_weights jsonb,p_daily integer,p_member integer,p_pair integer,p_budget integer,p_tester integer,
 p_approval_record text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_key text;
BEGIN
 IF p_weights IS NULL OR jsonb_typeof(p_weights)<>'object' OR
   (SELECT count(*) FROM jsonb_object_keys(p_weights))<>6 THEN RAISE EXCEPTION 'invalid earning weights'; END IF;
 FOREACH v_key IN ARRAY ARRAY['tip_sent','tip_received','active_day','legitimate_call','group_referral','tester_bonus'] LOOP
   IF NOT(p_weights ? v_key) OR jsonb_typeof(p_weights->v_key)<>'number' OR
     (p_weights->>v_key)!~'^[0-9]+$' OR (p_weights->>v_key)::numeric>1000000 THEN RAISE EXCEPTION 'invalid earning weights'; END IF;
 END LOOP;
 INSERT INTO public.participation_seasons(group_id,name,rule_version,network,starts_at,ends_at,weights,
  member_daily_cap,member_season_cap,pair_daily_cap,season_budget,tester_cap,approval_record)
 VALUES(p_group,p_name,p_version,p_network,p_start,p_end,p_weights,p_daily,p_member,p_pair,p_budget,p_tester,p_approval_record) RETURNING id INTO v_id;
 INSERT INTO public.audit_events(group_id,actor_type,event_type,entity_type,entity_id)
 VALUES(p_group,'system','participation_season_created','participation_season',v_id::text);
 RETURN v_id;
END; $$;

CREATE FUNCTION public.set_participation_season_status(p_season uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.participation_seasons%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.participation_seasons WHERE id=p_season FOR UPDATE;
 IF NOT FOUND OR p_status IS NULL OR p_status NOT IN ('active','paused','closed') OR s.status='closed' THEN RAISE EXCEPTION 'invalid season transition'; END IF;
 IF p_status='active' AND (s.approval_record IS NULL OR clock_timestamp()>=s.ends_at OR
    NOT EXISTS(SELECT 1 FROM jsonb_each_text(s.weights) w WHERE w.value::integer>0)) THEN RAISE EXCEPTION 'approved earning rules required'; END IF;
 UPDATE public.participation_seasons SET status=p_status WHERE id=s.id;
 INSERT INTO public.audit_events(group_id,actor_type,event_type,entity_type,entity_id,before_state,after_state)
 VALUES(s.group_id,'system','participation_season_status','participation_season',s.id::text,jsonb_build_object('status',s.status),jsonb_build_object('status',p_status));
END; $$;

CREATE FUNCTION public.review_participation_activity(p_season uuid,p_member uuid,p_kind text,p_evidence uuid,p_reviewer uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.participation_seasons%ROWTYPE; v_id uuid;
BEGIN
 SELECT * INTO s FROM public.participation_seasons WHERE id=p_season FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'season missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.group_members WHERE id=p_reviewer AND group_id=s.group_id AND role IN ('admin','moderator') AND NOT is_banned)
 OR p_reviewer=p_member THEN RAISE EXCEPTION 'independent group reviewer required'; END IF;
 IF p_kind='legitimate_call' AND NOT EXISTS(SELECT 1 FROM public.calls WHERE id=p_evidence AND group_id=s.group_id AND caller_membership_id=p_member AND status='active' AND source<>'imported') THEN RAISE EXCEPTION 'eligible call required'; END IF;
 IF p_kind='group_referral' AND (p_evidence=s.group_id OR NOT EXISTS(SELECT 1 FROM public.groups WHERE id=p_evidence AND removed_at IS NULL)) THEN RAISE EXCEPTION 'installed referred group required'; END IF;
 INSERT INTO public.participation_reviews(season_id,group_id,membership_id,source_kind,evidence_id,reviewer_id)
 VALUES(s.id,s.group_id,p_member,p_kind,p_evidence,p_reviewer) RETURNING id INTO v_id;
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id)
 VALUES(s.group_id,'admin',p_reviewer::text,'participation_activity_reviewed','participation_review',v_id::text);
 RETURN v_id;
END; $$;

CREATE FUNCTION public.award_participation(p_season uuid,p_member uuid,p_kind text,p_source uuid)
RETURNS public.participation_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.participation_seasons%ROWTYPE; e public.participation_events%ROWTYPE;
 t public.tip_intents%ROWTYPE; r public.participation_reviews%ROWTYPE;
 v_at timestamptz; v_day date; v_pair uuid; v_weight integer; v_reason text;
 v_daily bigint; v_member bigint; v_total bigint; v_pairs bigint; v_test bigint;
BEGIN
 -- One season lock serializes all cap and uniqueness decisions for its group.
 SELECT * INTO s FROM public.participation_seasons WHERE id=p_season FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'season missing'; END IF;
 SELECT * INTO e FROM public.participation_events WHERE season_id=s.id AND membership_id=p_member AND source_kind=p_kind AND source_id=p_source;
 IF FOUND THEN RETURN e; END IF;
 IF s.status<>'active' OR clock_timestamp()<s.starts_at OR clock_timestamp()>=s.ends_at THEN RAISE EXCEPTION 'earning disabled'; END IF;
 PERFORM 1 FROM public.group_members WHERE id=p_member AND group_id=s.group_id AND NOT is_banned AND NOT participation_opt_out FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'eligible group membership required'; END IF;
 IF EXISTS(SELECT 1 FROM public.groups WHERE id=s.group_id AND (is_paused OR removed_at IS NOT NULL)) THEN RAISE EXCEPTION 'group unavailable'; END IF;
 IF p_kind IN ('tip_sent','tip_received','active_day') THEN
   SELECT * INTO t FROM public.tip_intents WHERE id=p_source AND group_id=s.group_id;
   IF NOT FOUND OR t.status<>'confirmed' OR t.network<>s.network OR s.network<>'mainnet-beta'
     OR t.sender_membership_id=t.recipient_membership_id OR t.amount_base_units<=0 OR
     (p_kind='tip_sent' AND t.sender_membership_id<>p_member) OR
     (p_kind='tip_received' AND t.recipient_membership_id<>p_member) OR
     (p_kind='active_day' AND t.sender_membership_id<>p_member AND t.recipient_membership_id<>p_member)
     THEN RAISE EXCEPTION 'eligible confirmed tip required'; END IF;
   SELECT confirmed_at INTO v_at FROM public.verified_transfers WHERE tip_intent_id=t.id
     AND length(signature)>0 AND slot IS NOT NULL AND slot>=0 AND recipient_address=t.recipient_address
     AND asset_mint IS NOT DISTINCT FROM t.asset_mint AND amount_base_units=t.amount_base_units;
   IF NOT FOUND THEN RAISE EXCEPTION 'matching verified receipt required'; END IF;
   v_pair:=CASE WHEN t.sender_membership_id=p_member THEN t.recipient_membership_id ELSE t.sender_membership_id END;
   PERFORM 1 FROM public.group_members WHERE id=v_pair AND group_id=s.group_id AND NOT is_banned AND NOT participation_opt_out FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'eligible counterparty required'; END IF;
   IF EXISTS(SELECT 1 FROM public.group_members a JOIN public.group_members b ON a.telegram_user_id=b.telegram_user_id WHERE a.id=p_member AND b.id=v_pair)
     OR EXISTS(SELECT 1 FROM public.wallets a JOIN public.wallets b ON a.address=b.address WHERE a.membership_id=p_member AND b.membership_id=v_pair AND a.status IN ('verified','pending_replacement') AND b.status IN ('verified','pending_replacement') AND a.active_from<=clock_timestamp() AND b.active_from<=clock_timestamp() AND (a.replaced_at IS NULL OR a.replaced_at>clock_timestamp()) AND (b.replaced_at IS NULL OR b.replaced_at>clock_timestamp()))
     THEN RAISE EXCEPTION 'self recognition excluded'; END IF;
 ELSE
   SELECT * INTO r FROM public.participation_reviews WHERE id=p_source AND season_id=s.id AND membership_id=p_member AND source_kind=p_kind;
   IF NOT FOUND THEN RAISE EXCEPTION 'reviewed activity required'; END IF;
   IF s.network='devnet' AND p_kind<>'tester_bonus' THEN RAISE EXCEPTION 'devnet tester bonus only'; END IF;
   IF p_kind='legitimate_call' AND NOT EXISTS(SELECT 1 FROM public.calls WHERE id=r.evidence_id AND status='active') THEN RAISE EXCEPTION 'call no longer eligible'; END IF;
   v_at:=r.reviewed_at;
 END IF;
 IF v_at<s.starts_at OR v_at>=s.ends_at OR v_at>clock_timestamp() THEN RAISE EXCEPTION 'source outside season'; END IF;
 v_day:=(v_at AT TIME ZONE 'UTC')::date;
 IF p_kind='active_day' THEN
   SELECT * INTO e FROM public.participation_events WHERE season_id=s.id AND membership_id=p_member AND source_kind=p_kind AND earning_day=v_day;
   IF FOUND THEN RETURN e; END IF;
 END IF;
 v_weight:=(s.weights->>p_kind)::integer;
 IF v_weight IS NULL THEN RAISE EXCEPTION 'unsupported earning source'; END IF;
 -- Gross awarded capacity remains spent after reversals.
 SELECT coalesce(sum(points) FILTER(WHERE membership_id=p_member AND earning_day=v_day),0),
   coalesce(sum(points) FILTER(WHERE membership_id=p_member),0),coalesce(sum(points),0),
   coalesce(sum(points) FILTER(WHERE membership_id=p_member AND counterparty_id=v_pair AND earning_day=v_day),0),
   coalesce(sum(points) FILTER(WHERE membership_id=p_member AND source_kind='tester_bonus'),0)
 INTO v_daily,v_member,v_total,v_pairs,v_test FROM public.participation_events WHERE season_id=s.id AND status='awarded';
 v_reason:=CASE WHEN v_weight=0 THEN 'source_disabled'
   WHEN v_daily+v_weight>s.member_daily_cap THEN 'daily_cap'
   WHEN v_member+v_weight>s.member_season_cap THEN 'member_cap'
   WHEN v_total+v_weight>s.season_budget THEN 'season_budget'
   WHEN v_pair IS NOT NULL AND v_pairs+v_weight>s.pair_daily_cap THEN 'pair_cap'
   WHEN p_kind='tester_bonus' AND v_test+v_weight>s.tester_cap THEN 'tester_cap'
   ELSE 'eligible' END;
 INSERT INTO public.participation_events(season_id,group_id,membership_id,counterparty_id,source_kind,source_id,rule_version,status,points,reason_code,earning_day)
 VALUES(s.id,s.group_id,p_member,v_pair,p_kind,p_source,s.rule_version,CASE WHEN v_reason='eligible' THEN 'awarded' ELSE 'held' END,
 CASE WHEN v_reason='eligible' THEN v_weight ELSE 0 END,v_reason,v_day) RETURNING * INTO e;
 INSERT INTO public.audit_events(group_id,actor_type,event_type,entity_type,entity_id,after_state)
 VALUES(s.group_id,'system','participation_recorded','participation_event',e.id::text,jsonb_build_object('status',e.status,'points',e.points,'rule_version',e.rule_version));
 RETURN e;
END; $$;

CREATE FUNCTION public.reverse_participation(p_event uuid,p_actor uuid,p_request uuid,p_reason text)
RETURNS public.participation_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.participation_events%ROWTYPE; r public.participation_events%ROWTYPE; v_left integer;
BEGIN
 SELECT * INTO e FROM public.participation_events WHERE id=p_event;
 IF NOT FOUND OR e.status<>'awarded' THEN RAISE EXCEPTION 'award missing'; END IF;
 PERFORM 1 FROM public.participation_seasons WHERE id=e.season_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.group_members WHERE id=p_actor AND group_id=e.group_id AND role IN ('admin','moderator') AND NOT is_banned) THEN RAISE EXCEPTION 'group reviewer required'; END IF;
 SELECT * INTO r FROM public.participation_events WHERE season_id=e.season_id AND membership_id=e.membership_id AND source_kind='adjustment' AND source_id=p_request;
 IF FOUND THEN
   IF r.reverses_event_id<>e.id OR r.actor_id<>p_actor OR r.reason_code<>p_reason THEN RAISE EXCEPTION 'adjustment request mismatch'; END IF;
   RETURN r;
 END IF;
 SELECT e.points+coalesce(sum(points),0) INTO v_left FROM public.participation_events WHERE reverses_event_id=e.id;
 IF v_left<=0 THEN RAISE EXCEPTION 'award already reversed'; END IF;
 INSERT INTO public.participation_events(season_id,group_id,membership_id,source_kind,source_id,rule_version,status,points,reason_code,earning_day,reverses_event_id,actor_id)
 VALUES(e.season_id,e.group_id,e.membership_id,'adjustment',p_request,e.rule_version,'adjustment',-v_left,p_reason,(clock_timestamp() AT TIME ZONE 'UTC')::date,e.id,p_actor) RETURNING * INTO r;
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id,after_state)
 VALUES(e.group_id,'admin',p_actor::text,'participation_reversed','participation_event',r.id::text,jsonb_build_object('points',r.points,'reason',p_reason));
 RETURN r;
END; $$;

DO $$ DECLARE t text; f regprocedure; BEGIN
 FOREACH t IN ARRAY ARRAY['participation_seasons','participation_reviews','participation_events'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY participation_deny_clients ON public.%I AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false)',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON public.%I TO service_role',t);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('create_participation_season','set_participation_season_status','review_participation_activity','award_participation','reverse_participation') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.participation_immutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.participation_member_total(p_group uuid,p_member uuid)
RETURNS bigint LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(sum(points),0)::bigint FROM public.participation_events WHERE group_id=p_group AND membership_id=p_member;
$$;
REVOKE ALL ON FUNCTION public.participation_member_total(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.participation_member_total(uuid,uuid) TO service_role;
-- Durable, bounded follow-up work. Transfer verification does not depend on point processing.
CREATE TABLE public.participation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 season_id uuid NOT NULL,
 group_id uuid NOT NULL,
 tip_id uuid NOT NULL REFERENCES public.tip_intents(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','held','dead')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 error_code text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(season_id,group_id) REFERENCES public.participation_seasons(id,group_id),
 UNIQUE(season_id,tip_id)
);
CREATE INDEX participation_jobs_ready ON public.participation_jobs(available_at) WHERE status='pending';
ALTER TABLE public.participation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY participation_deny_clients ON public.participation_jobs AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.participation_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.participation_jobs TO service_role;

CREATE FUNCTION public.queue_participation_tip() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_tip uuid;
BEGIN
 v_tip:=coalesce(to_jsonb(NEW)->>'tip_intent_id',to_jsonb(NEW)->>'id')::uuid;
 INSERT INTO public.participation_jobs(season_id,group_id,tip_id)
 SELECT s.id,s.group_id,t.id FROM public.tip_intents t
 JOIN public.verified_transfers v ON v.tip_intent_id=t.id
 JOIN public.participation_seasons s ON s.group_id=t.group_id AND s.status='active'
 WHERE t.id=v_tip AND t.status='confirmed' AND t.network=s.network AND s.network='mainnet-beta'
  AND v.confirmed_at>=s.starts_at AND v.confirmed_at<s.ends_at AND clock_timestamp()<s.ends_at
  AND v.recipient_address=t.recipient_address AND v.asset_mint IS NOT DISTINCT FROM t.asset_mint
  AND v.amount_base_units=t.amount_base_units AND v.slot>=0 AND length(v.signature)>0
 ON CONFLICT(season_id,tip_id) DO NOTHING;
 RETURN NEW;
END; $$;
CREATE TRIGGER participation_tip_status AFTER INSERT OR UPDATE OF status ON public.tip_intents FOR EACH ROW WHEN(NEW.status='confirmed') EXECUTE FUNCTION public.queue_participation_tip();
CREATE TRIGGER participation_tip_receipt AFTER INSERT ON public.verified_transfers FOR EACH ROW EXECUTE FUNCTION public.queue_participation_tip();
REVOKE ALL ON FUNCTION public.queue_participation_tip() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.process_participation_jobs(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.participation_jobs%ROWTYPE; t public.tip_intents%ROWTYPE;
 v_processed integer:=0; v_failed integer:=0; v_code text;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>20 THEN RAISE EXCEPTION 'invalid job limit'; END IF;
 FOR j IN SELECT * FROM public.participation_jobs WHERE status='pending' AND available_at<=clock_timestamp()
  ORDER BY season_id,available_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   SELECT * INTO t FROM public.tip_intents WHERE id=j.tip_id AND group_id=j.group_id;
   PERFORM public.award_participation(j.season_id,t.sender_membership_id,'tip_sent',t.id);
   PERFORM public.award_participation(j.season_id,t.recipient_membership_id,'tip_received',t.id);
   PERFORM public.award_participation(j.season_id,t.sender_membership_id,'active_day',t.id);
   PERFORM public.award_participation(j.season_id,t.recipient_membership_id,'active_day',t.id);
   UPDATE public.participation_jobs SET status='processed',attempts=attempts+1,error_code=NULL WHERE id=j.id;
   v_processed:=v_processed+1;
  EXCEPTION WHEN OTHERS THEN
   -- The inner transaction rolls all this job's point writes back. Never persist error text.
   GET STACKED DIAGNOSTICS v_code=RETURNED_SQLSTATE;
   UPDATE public.participation_jobs SET attempts=attempts+1,
    status=CASE WHEN attempts+1>=5 THEN 'dead' ELSE 'pending' END,
    available_at=clock_timestamp()+interval '1 minute'*power(2,attempts),error_code=v_code WHERE id=j.id;
   v_failed:=v_failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('processed',v_processed,'failed',v_failed);
END; $$;
REVOKE ALL ON FUNCTION public.process_participation_jobs(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_participation_jobs(integer) TO service_role;

CREATE FUNCTION public.retry_participation_job(p_job uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.participation_jobs%ROWTYPE;
BEGIN
 SELECT * INTO j FROM public.participation_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status<>'dead' THEN RAISE EXCEPTION 'dead job required'; END IF;
 UPDATE public.participation_jobs SET status='pending',attempts=0,error_code=NULL,available_at=clock_timestamp() WHERE id=j.id;
 INSERT INTO public.audit_events(group_id,actor_type,event_type,entity_type,entity_id)
 VALUES(j.group_id,'system','participation_job_retried','participation_job',j.id::text);
END; $$;
REVOKE ALL ON FUNCTION public.retry_participation_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retry_participation_job(uuid) TO service_role;
CREATE FUNCTION public.participation_member_job_counts(p_group uuid,p_member uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('pending',count(*) FILTER(WHERE j.status='pending'),'needsReview',count(*) FILTER(WHERE j.status='dead'))
 FROM public.participation_jobs j JOIN public.tip_intents t ON t.id=j.tip_id AND t.group_id=j.group_id
 WHERE j.group_id=p_group AND (t.sender_membership_id=p_member OR t.recipient_membership_id=p_member);
$$;
REVOKE ALL ON FUNCTION public.participation_member_job_counts(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.participation_member_job_counts(uuid,uuid) TO service_role;