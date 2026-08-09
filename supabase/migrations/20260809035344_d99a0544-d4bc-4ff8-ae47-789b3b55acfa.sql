CREATE TABLE public.miniapp_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  telegram_user_id bigint NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.miniapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash text NOT NULL UNIQUE,
  telegram_user_id bigint NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.miniapp_login_tokens TO service_role;
GRANT ALL ON public.miniapp_sessions TO service_role;
ALTER TABLE public.miniapp_login_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miniapp_sessions ENABLE ROW LEVEL SECURITY;