-- Enforce group ownership where records carry both a group and a membership,
-- season, or call. Application checks remain useful for clear error messages;
-- these constraints are the final write boundary.

ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_id_group_key UNIQUE (id, group_id);

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_id_group_key UNIQUE (id, group_id);

ALTER TABLE public.calls
  DROP CONSTRAINT calls_caller_membership_id_fkey,
  DROP CONSTRAINT calls_season_id_fkey,
  ADD CONSTRAINT calls_id_group_key UNIQUE (id, group_id),
  ADD CONSTRAINT calls_caller_membership_id_fkey
    FOREIGN KEY (caller_membership_id, group_id)
    REFERENCES public.group_members (id, group_id)
    ON DELETE CASCADE
    NOT VALID,
  ADD CONSTRAINT calls_season_id_fkey
    FOREIGN KEY (season_id, group_id)
    REFERENCES public.seasons (id, group_id)
    ON DELETE SET NULL (season_id)
    NOT VALID;

ALTER TABLE public.tip_intents
  DROP CONSTRAINT tip_intents_sender_membership_id_fkey,
  DROP CONSTRAINT tip_intents_recipient_membership_id_fkey,
  DROP CONSTRAINT tip_intents_call_id_fkey,
  ADD CONSTRAINT tip_intents_sender_membership_id_fkey
    FOREIGN KEY (sender_membership_id, group_id)
    REFERENCES public.group_members (id, group_id)
    ON DELETE CASCADE
    NOT VALID,
  ADD CONSTRAINT tip_intents_recipient_membership_id_fkey
    FOREIGN KEY (recipient_membership_id, group_id)
    REFERENCES public.group_members (id, group_id)
    ON DELETE CASCADE
    NOT VALID,
  ADD CONSTRAINT tip_intents_call_id_fkey
    FOREIGN KEY (call_id, group_id)
    REFERENCES public.calls (id, group_id)
    ON DELETE SET NULL (call_id)
    NOT VALID;

ALTER TABLE public.disputes
  DROP CONSTRAINT disputes_call_id_fkey,
  DROP CONSTRAINT disputes_raised_by_membership_id_fkey,
  DROP CONSTRAINT disputes_resolved_by_membership_id_fkey,
  ADD CONSTRAINT disputes_call_id_fkey
    FOREIGN KEY (call_id, group_id)
    REFERENCES public.calls (id, group_id)
    ON DELETE CASCADE
    NOT VALID,
  ADD CONSTRAINT disputes_raised_by_membership_id_fkey
    FOREIGN KEY (raised_by_membership_id, group_id)
    REFERENCES public.group_members (id, group_id)
    ON DELETE SET NULL (raised_by_membership_id)
    NOT VALID,
  ADD CONSTRAINT disputes_resolved_by_membership_id_fkey
    FOREIGN KEY (resolved_by_membership_id, group_id)
    REFERENCES public.group_members (id, group_id)
    ON DELETE SET NULL (resolved_by_membership_id)
    NOT VALID;

-- Validation intentionally fails the migration if legacy cross-group rows exist;
-- do not silently preserve identity corruption.
ALTER TABLE public.calls VALIDATE CONSTRAINT calls_caller_membership_id_fkey;
ALTER TABLE public.calls VALIDATE CONSTRAINT calls_season_id_fkey;
ALTER TABLE public.tip_intents VALIDATE CONSTRAINT tip_intents_sender_membership_id_fkey;
ALTER TABLE public.tip_intents VALIDATE CONSTRAINT tip_intents_recipient_membership_id_fkey;
ALTER TABLE public.tip_intents VALIDATE CONSTRAINT tip_intents_call_id_fkey;
ALTER TABLE public.disputes VALIDATE CONSTRAINT disputes_call_id_fkey;
ALTER TABLE public.disputes VALIDATE CONSTRAINT disputes_raised_by_membership_id_fkey;
ALTER TABLE public.disputes VALIDATE CONSTRAINT disputes_resolved_by_membership_id_fkey;
