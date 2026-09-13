-- Proposed only: no active signer/verifier grants or managed journal entry.
-- Persist ONE blockhash/message snapshot before signing. Leases/timers cannot
-- replace it. Signed bytes are committed once before any RPC broadcast.
CREATE TABLE public.custody_submission_snapshots (
 reservation_id uuid PRIMARY KEY REFERENCES public.custody_reservations(id),
 approval jsonb NOT NULL,
 signed_record jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (approval->>'network'='devnet')
);
CREATE UNIQUE INDEX custody_signed_signature_unique ON public.custody_submission_snapshots ((signed_record->>'signature')) WHERE signed_record IS NOT NULL;
CREATE UNIQUE INDEX custody_submission_reference_unique ON public.custody_submission_snapshots ((approval->>'reference'));
CREATE FUNCTION public.custody_submission_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable custody submission'; END IF;
 IF (to_jsonb(NEW)-'signed_record')<>(to_jsonb(OLD)-'signed_record') OR OLD.signed_record IS NOT NULL OR NEW.signed_record IS NULL THEN
  RAISE EXCEPTION 'Immutable custody submission';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER custody_submission_immutable BEFORE UPDATE OR DELETE ON public.custody_submission_snapshots FOR EACH ROW EXECUTE FUNCTION public.custody_submission_immutable();

CREATE FUNCTION public.prepare_devnet_custody_submission(p_id uuid,p_blockhash text,p_height bigint,p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.custody_reservations; a public.custody_accounts; b public.custody_accounts; chosen jsonb;
BEGIN
 SELECT * INTO r FROM public.custody_reservations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing custody reservation'; END IF;
 SELECT approval INTO chosen FROM public.custody_submission_snapshots WHERE reservation_id=p_id;
 IF FOUND THEN RETURN chosen; END IF;
 IF r.status<>'reserved' OR r.expires_at<=clock_timestamp() OR p_blockhash IS NULL OR p_reference IS NULL OR p_height IS NULL OR p_height<0 OR p_height>9007199254740991 OR p_blockhash!~'^[1-9A-HJ-NP-Za-km-z]{32,44}$' OR p_reference!~'^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN RAISE EXCEPTION 'Invalid custody submission preparation'; END IF;
 SELECT * INTO a FROM public.custody_accounts WHERE id=r.account_id;
 SELECT * INTO b FROM public.custody_accounts WHERE id=r.recipient_account_id;
 IF a.status<>'active' OR b.status<>'active' OR a.network<>'devnet' OR b.network<>'devnet' OR p_reference IN(a.address,b.address,'11111111111111111111111111111111') THEN RAISE EXCEPTION 'Unavailable custody submission'; END IF;
 chosen:=jsonb_build_object('walletId',a.id,'groupId',a.group_id,'membershipId',a.membership_id,'reservationId',r.id,'network','devnet','sender',a.address,'recipient',b.address,'reference',p_reference,'lamports',r.lamports::text,'feeCapLamports',r.fee_cap_lamports::text,'blockhash',p_blockhash,'lastValidBlockHeight',p_height);
 INSERT INTO public.custody_submission_snapshots(reservation_id,approval) VALUES(p_id,chosen);
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id,after_state)
 VALUES(a.group_id,'system',a.membership_id,'custody_submission_prepared','custody_reservation',p_id,jsonb_build_object('last_valid_block_height',p_height));
 RETURN chosen;
END $$;

CREATE FUNCTION public.persist_devnet_custody_signed(p_id uuid,p_record jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE snapshot public.custody_submission_snapshots; raw bytea;
BEGIN
 SELECT * INTO snapshot FROM public.custody_submission_snapshots WHERE reservation_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prepare custody snapshot before signing'; END IF;
 IF p_record IS NULL OR jsonb_typeof(p_record)<>'object' OR NOT p_record ?& ARRAY['reservationId','network','signature','wireBase64','lastValidBlockHeight'] OR (SELECT count(*) FROM jsonb_object_keys(p_record))<>5 OR p_record->>'reservationId' IS DISTINCT FROM p_id::text OR p_record->>'network' IS DISTINCT FROM 'devnet' OR p_record->'lastValidBlockHeight' IS DISTINCT FROM snapshot.approval->'lastValidBlockHeight' OR p_record->>'signature' IS NULL OR p_record->>'signature'!~'^[1-9A-HJ-NP-Za-km-z]{64,88}$' OR p_record->>'wireBase64' IS NULL OR p_record->>'wireBase64'!~'^[A-Za-z0-9+/]+={0,2}$' THEN RAISE EXCEPTION 'Invalid signed custody record'; END IF;
 raw:=decode(p_record->>'wireBase64','base64');
 IF octet_length(raw)<100 OR octet_length(raw)>1232 OR replace(encode(raw,'base64'),E'\n','')<>p_record->>'wireBase64' THEN RAISE EXCEPTION 'Invalid signed custody bytes'; END IF;
 IF snapshot.signed_record IS NOT NULL THEN
  IF snapshot.signed_record<>p_record THEN RAISE EXCEPTION 'Signed custody replay conflict'; END IF;
  RETURN snapshot.signed_record;
 END IF;
 UPDATE public.custody_submission_snapshots SET signed_record=p_record WHERE reservation_id=p_id;
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id,after_state)
 VALUES((snapshot.approval->>'groupId')::uuid,'system',(snapshot.approval->>'membershipId')::uuid,'custody_signed_persisted','custody_reservation',p_id,jsonb_build_object('signature',p_record->>'signature'));
 RETURN p_record;
END $$;

CREATE FUNCTION public.settle_signed_devnet_custody(p_id uuid,p_signature text,p_fee bigint,p_slot bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.custody_submission_snapshots WHERE reservation_id=p_id AND signed_record->>'signature'=p_signature) THEN RAISE EXCEPTION 'Missing matching signed custody receipt'; END IF;
 RETURN public.settle_devnet_custody_tip(p_id,p_signature,p_fee,p_slot);
END $$;
ALTER TABLE public.custody_submission_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY custody_submission_deny ON public.custody_submission_snapshots AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.custody_submission_snapshots FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.custody_submission_snapshots TO service_role;
REVOKE ALL ON FUNCTION public.custody_submission_immutable(),public.prepare_devnet_custody_submission(uuid,text,bigint,text),public.persist_devnet_custody_signed(uuid,jsonb),public.settle_signed_devnet_custody(uuid,text,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
-- SQL validates structural storage, not Ed25519 signatures/on-chain execution.
-- Future isolated signer must validate SDK message/signature before persistence;
-- verifier must match finalized proof before calling signed settlement.
