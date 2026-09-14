-- Inactive devnet accounting core. No wallet, balance or secret is seeded.
CREATE TABLE public.custody_accounts (
 id uuid PRIMARY KEY, group_id uuid NOT NULL, membership_id uuid NOT NULL,
 network text NOT NULL DEFAULT 'devnet' CHECK(network='devnet'),
 address text NOT NULL CHECK(address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 status text NOT NULL DEFAULT 'frozen' CHECK(status IN ('active','frozen','closed')),
 confirmed_lamports bigint NOT NULL DEFAULT 0 CHECK(confirmed_lamports>=0),
 reserved_lamports bigint NOT NULL DEFAULT 0 CHECK(reserved_lamports>=0 AND reserved_lamports<=confirmed_lamports),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(membership_id,group_id) REFERENCES public.group_members(id,group_id),
 UNIQUE(membership_id,network), UNIQUE(address,network), UNIQUE(id,group_id)
);
CREATE TABLE public.custody_key_envelopes (
 account_id uuid PRIMARY KEY REFERENCES public.custody_accounts(id),
 envelope jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.custody_reservations (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES public.custody_accounts(id),
 recipient_account_id uuid NOT NULL REFERENCES public.custody_accounts(id),
 lamports bigint NOT NULL CHECK(lamports>0), fee_cap_lamports bigint NOT NULL CHECK(fee_cap_lamports>=0 AND fee_cap_lamports<=1000000),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','cancelled','settled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 UNIQUE(id,account_id), CHECK(account_id<>recipient_account_id),
 CHECK(lamports<=9000000000000000-fee_cap_lamports)
);
CREATE TABLE public.custody_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES public.custody_accounts(id),
 kind text NOT NULL CHECK(kind IN ('deposit','tip_debit','tip_credit','fee_debit')),
 lamports bigint NOT NULL CHECK(lamports<>0), signature text NOT NULL CHECK(signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$'),
 reservation_id uuid REFERENCES public.custody_reservations(id), slot bigint NOT NULL CHECK(slot>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((kind IN ('deposit','tip_credit') AND lamports>0) OR (kind IN ('tip_debit','fee_debit') AND lamports<0)),
 UNIQUE(signature,kind,account_id), UNIQUE(reservation_id,kind)
);
CREATE UNIQUE INDEX custody_unique_deposit ON public.custody_ledger(signature) WHERE kind='deposit';
CREATE UNIQUE INDEX custody_unique_tip_signature ON public.custody_ledger(signature) WHERE kind='tip_debit';

CREATE FUNCTION public.custody_ledger_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Custody history is append-only'; END $$;
CREATE TRIGGER custody_ledger_immutable BEFORE UPDATE OR DELETE ON public.custody_ledger FOR EACH ROW EXECUTE FUNCTION public.custody_ledger_immutable();

CREATE FUNCTION public.provision_devnet_custody(p_id uuid,p_group uuid,p_member uuid,p_address text,p_envelope jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE existing public.custody_accounts;
BEGIN
 PERFORM 1 FROM public.group_members m JOIN public.groups g ON g.id=m.group_id
 WHERE m.id=p_member AND m.group_id=p_group AND NOT m.is_banned AND NOT g.is_paused AND g.removed_at IS NULL FOR UPDATE OF m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ineligible custody membership'; END IF;
 SELECT * INTO existing FROM public.custody_accounts WHERE membership_id=p_member AND network='devnet';
 IF FOUND THEN RETURN existing.id; END IF;
 IF p_envelope IS NULL OR jsonb_typeof(p_envelope)<>'object' THEN RAISE EXCEPTION 'Invalid custody envelope'; END IF;
 IF p_envelope->>'walletId' IS DISTINCT FROM p_id::text OR p_envelope->>'groupId' IS DISTINCT FROM p_group::text
 OR p_envelope->>'membershipId' IS DISTINCT FROM p_member::text OR p_envelope->>'address' IS DISTINCT FROM p_address
 OR p_envelope->>'network' IS DISTINCT FROM 'devnet' OR p_envelope->>'version' IS DISTINCT FROM '1'
 OR NOT (p_envelope ?& ARRAY['wrappingKeyVersion','seedIv','encryptedSeed','wrappingIv','wrappedDataKey'])
 OR (SELECT count(*) FROM jsonb_object_keys(p_envelope))<>11
 THEN RAISE EXCEPTION 'Invalid custody envelope'; END IF;
 INSERT INTO public.custody_accounts(id,group_id,membership_id,address) VALUES(p_id,p_group,p_member,p_address);
 INSERT INTO public.custody_key_envelopes(account_id,envelope) VALUES(p_id,p_envelope);
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id,after_state)
 VALUES(p_group,'system',p_member,'custody_provisioned','custody_account',p_id,'{"network":"devnet","status":"frozen"}');
 RETURN p_id;
END $$;

-- Trusted verifier only: the caller must independently verify finalized genesis,
-- sender/recipient and exact transfer instructions, excluding internal transfers.
CREATE FUNCTION public.credit_devnet_custody(p_account uuid,p_signature text,p_lamports bigint,p_slot bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.custody_accounts; existing public.custody_ledger;
BEGIN
 SELECT * INTO a FROM public.custody_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.status='closed' OR p_lamports IS NULL OR p_lamports<=0 OR p_slot IS NULL OR p_slot<0 THEN RAISE EXCEPTION 'Invalid custody deposit'; END IF;
 SELECT * INTO existing FROM public.custody_ledger WHERE signature=p_signature AND kind='deposit';
 IF FOUND THEN
   IF existing.account_id<>p_account OR existing.lamports<>p_lamports OR existing.slot<>p_slot THEN RAISE EXCEPTION 'Deposit receipt conflict'; END IF;
   RETURN false;
 END IF;
 IF EXISTS(SELECT 1 FROM public.custody_ledger WHERE signature=p_signature AND kind='tip_debit') THEN RAISE EXCEPTION 'Internal transfer cannot be a deposit'; END IF;
 INSERT INTO public.custody_ledger(account_id,kind,lamports,signature,slot) VALUES(p_account,'deposit',p_lamports,p_signature,p_slot);
 UPDATE public.custody_accounts SET confirmed_lamports=confirmed_lamports+p_lamports WHERE id=p_account;
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id,after_state)
 VALUES(a.group_id,'system',a.membership_id,'custody_deposit_confirmed','custody_account',a.id,jsonb_build_object('lamports',p_lamports));
 RETURN true;
END $$;

CREATE FUNCTION public.reserve_devnet_custody_tip(p_id uuid,p_group uuid,p_member uuid,p_sender uuid,p_recipient uuid,p_lamports bigint,p_fee_cap bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.custody_accounts; r public.custody_reservations;
BEGIN
 IF p_lamports IS NULL OR p_fee_cap IS NULL OR p_lamports<=0 OR p_fee_cap<0 OR p_fee_cap>1000000 OR p_lamports>9000000000000000-p_fee_cap OR p_sender=p_recipient THEN RAISE EXCEPTION 'Invalid custody tip'; END IF;
 -- Canonical account lock order shared with settlement prevents opposing-tip deadlocks.
 PERFORM 1 FROM public.custody_accounts WHERE id IN(p_sender,p_recipient) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.group_members WHERE id IN(SELECT membership_id FROM public.custody_accounts WHERE id IN(p_sender,p_recipient)) ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.groups WHERE id=p_group FOR SHARE;
 SELECT * INTO a FROM public.custody_accounts WHERE id=p_sender AND group_id=p_group AND membership_id=p_member;
 IF NOT FOUND THEN RAISE EXCEPTION 'Foreign custody account'; END IF;
 SELECT * INTO r FROM public.custody_reservations WHERE id=p_id;
 IF FOUND THEN
  IF r.account_id<>p_sender OR r.recipient_account_id<>p_recipient OR r.lamports<>p_lamports OR r.fee_cap_lamports<>p_fee_cap THEN RAISE EXCEPTION 'Reservation replay conflict'; END IF;
  RETURN r.id;
 END IF;
 IF a.status<>'active' OR NOT EXISTS(SELECT 1 FROM public.custody_accounts b JOIN public.group_members m ON m.id=b.membership_id
 WHERE b.id=p_recipient AND b.group_id=p_group AND b.status='active' AND NOT m.is_banned AND m.telegram_user_id<>(SELECT telegram_user_id FROM public.group_members WHERE id=p_member))
 OR NOT EXISTS(SELECT 1 FROM public.group_members m JOIN public.groups g ON g.id=m.group_id WHERE m.id=p_member AND NOT m.is_banned AND NOT g.is_paused AND g.removed_at IS NULL)
 THEN RAISE EXCEPTION 'Custody tipping unavailable'; END IF;
 IF a.confirmed_lamports-a.reserved_lamports<p_lamports+p_fee_cap THEN RAISE EXCEPTION 'Insufficient available custody balance'; END IF;
 INSERT INTO public.custody_reservations(id,account_id,recipient_account_id,lamports,fee_cap_lamports,expires_at)
 VALUES(p_id,p_sender,p_recipient,p_lamports,p_fee_cap,clock_timestamp()+interval '5 minutes');
 UPDATE public.custody_accounts SET reserved_lamports=reserved_lamports+p_lamports+p_fee_cap WHERE id=p_sender;
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id,after_state)
 VALUES(p_group,'system',p_member,'custody_tip_reserved','custody_reservation',p_id,jsonb_build_object('lamports',p_lamports,'fee_cap',p_fee_cap));
 RETURN p_id;
END $$;

-- Accounting settlement only, NOT a chain verifier. No signer/cancellation RPC
-- is exposed until durable signed-transaction recovery and step-up auth exist.
CREATE FUNCTION public.settle_devnet_custody_tip(p_id uuid,p_signature text,p_fee bigint,p_slot bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.custody_reservations; a public.custody_accounts; existing public.custody_ledger;
BEGIN
 SELECT * INTO r FROM public.custody_reservations WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown custody reservation'; END IF;
 PERFORM 1 FROM public.custody_accounts WHERE id IN(r.account_id,r.recipient_account_id) ORDER BY id FOR UPDATE;
 SELECT * INTO r FROM public.custody_reservations WHERE id=p_id FOR UPDATE;
 IF p_fee IS NULL OR p_fee<0 OR p_fee>r.fee_cap_lamports OR p_slot IS NULL OR p_slot<0 THEN RAISE EXCEPTION 'Invalid custody settlement'; END IF;
 IF r.status='settled' THEN
  SELECT * INTO existing FROM public.custody_ledger WHERE reservation_id=p_id AND kind='tip_debit';
  IF existing.signature<>p_signature OR existing.slot<>p_slot OR COALESCE((SELECT -lamports FROM public.custody_ledger WHERE reservation_id=p_id AND kind='fee_debit'),0)<>p_fee THEN RAISE EXCEPTION 'Settlement replay conflict'; END IF;
  RETURN false;
 END IF;
 IF r.status<>'reserved' OR EXISTS(SELECT 1 FROM public.custody_ledger WHERE signature=p_signature AND kind='deposit') THEN RAISE EXCEPTION 'Custody settlement conflict'; END IF;
 SELECT * INTO a FROM public.custody_accounts WHERE id=r.account_id;
 INSERT INTO public.custody_ledger(account_id,kind,lamports,signature,reservation_id,slot) VALUES
 (r.account_id,'tip_debit',-r.lamports,p_signature,p_id,p_slot),
 (r.recipient_account_id,'tip_credit',r.lamports,p_signature,p_id,p_slot);
 IF p_fee>0 THEN INSERT INTO public.custody_ledger(account_id,kind,lamports,signature,reservation_id,slot) VALUES(r.account_id,'fee_debit',-p_fee,p_signature,p_id,p_slot); END IF;
 UPDATE public.custody_accounts SET confirmed_lamports=confirmed_lamports-r.lamports-p_fee,reserved_lamports=reserved_lamports-r.lamports-r.fee_cap_lamports WHERE id=r.account_id;
 UPDATE public.custody_accounts SET confirmed_lamports=confirmed_lamports+r.lamports WHERE id=r.recipient_account_id;
 UPDATE public.custody_reservations SET status='settled' WHERE id=p_id;
 INSERT INTO public.audit_events(group_id,actor_type,actor_id,event_type,entity_type,entity_id,after_state)
 VALUES(a.group_id,'system',a.membership_id,'custody_tip_settled','custody_reservation',p_id,jsonb_build_object('lamports',r.lamports,'fee',p_fee));
 RETURN true;
END $$;

ALTER TABLE public.custody_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_key_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY custody_accounts_deny ON public.custody_accounts AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY custody_keys_deny ON public.custody_key_envelopes AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY custody_reservations_deny ON public.custody_reservations AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY custody_ledger_deny ON public.custody_ledger AS RESTRICTIVE FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON public.custody_accounts,public.custody_key_envelopes,public.custody_reservations,public.custody_ledger FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.custody_accounts,public.custody_reservations,public.custody_ledger TO service_role;
REVOKE ALL ON FUNCTION public.custody_ledger_immutable() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.provision_devnet_custody(uuid,uuid,uuid,text,jsonb),public.credit_devnet_custody(uuid,text,bigint,bigint),public.reserve_devnet_custody_tip(uuid,uuid,uuid,uuid,uuid,bigint,bigint),public.settle_devnet_custody_tip(uuid,text,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
-- Intentionally no function EXECUTE grants: core is inert until the controlled
-- signer/verifier role and passkey authorization design are implemented/reviewed.
