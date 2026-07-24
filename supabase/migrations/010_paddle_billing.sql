-- Paddle billing mirror + access sync for SabbathCue subscriptions.
-- Apply via Supabase SQL Editor after 009_device_activation_management.sql.

CREATE TABLE IF NOT EXISTS public.paddle_customers (
  customer_id text PRIMARY KEY,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  last_event_occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS public.paddle_customers_email_lower_idx;
CREATE INDEX paddle_customers_email_lower_idx
  ON public.paddle_customers (lower(email));

CREATE INDEX IF NOT EXISTS paddle_customers_user_id_idx
  ON public.paddle_customers (user_id);

CREATE TABLE IF NOT EXISTS public.paddle_subscriptions (
  subscription_id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES public.paddle_customers (customer_id) ON DELETE CASCADE,
  subscription_status text NOT NULL,
  price_id text NOT NULL DEFAULT '',
  product_id text NOT NULL DEFAULT '',
  current_period_end timestamptz,
  scheduled_change timestamptz,
  last_event_occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paddle_subscriptions_customer_id_idx
  ON public.paddle_subscriptions (customer_id);

CREATE INDEX IF NOT EXISTS paddle_subscriptions_status_idx
  ON public.paddle_subscriptions (subscription_status);

CREATE TABLE IF NOT EXISTS public.paddle_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Keep this migration repairable if an earlier draft was applied manually.
ALTER TABLE public.paddle_customers
  ADD COLUMN IF NOT EXISTS last_event_occurred_at timestamptz;
UPDATE public.paddle_customers
SET last_event_occurred_at = COALESCE(last_event_occurred_at, updated_at, now())
WHERE last_event_occurred_at IS NULL;
ALTER TABLE public.paddle_customers
  ALTER COLUMN last_event_occurred_at SET NOT NULL;

ALTER TABLE public.paddle_subscriptions
  ADD COLUMN IF NOT EXISTS last_event_occurred_at timestamptz;
UPDATE public.paddle_subscriptions
SET last_event_occurred_at = COALESCE(last_event_occurred_at, updated_at, now())
WHERE last_event_occurred_at IS NULL;
ALTER TABLE public.paddle_subscriptions
  ALTER COLUMN last_event_occurred_at SET NOT NULL;

ALTER TABLE public.paddle_webhook_events
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Records what Paddle last granted, so ending a subscription only lowers the
-- access Paddle itself gave. Trials, admin_set_access comps and pilot
-- extensions share account_flags.access_expires_at and must survive.
ALTER TABLE public.account_flags
  ADD COLUMN IF NOT EXISTS paddle_access_expires_at timestamptz;
UPDATE public.paddle_webhook_events
SET occurred_at = COALESCE(occurred_at, received_at)
WHERE occurred_at IS NULL;
ALTER TABLE public.paddle_webhook_events
  ALTER COLUMN occurred_at SET NOT NULL;

ALTER TABLE public.paddle_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.paddle_link_customer_user(
  p_email text,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Checkout custom data is only trusted when it agrees with the authenticated
  -- account email. Email lookup remains the fallback for customer.* events.
  IF p_user_id IS NOT NULL THEN
    SELECT id
    INTO v_user_id
    FROM auth.users
    WHERE id = p_user_id
      AND lower(email) = lower(p_email);
  END IF;

  IF v_user_id IS NULL THEN
    SELECT id
    INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(p_email);
  END IF;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.paddle_customers
    SET user_id = v_user_id, updated_at = now()
    WHERE lower(email) = lower(p_email);
  END IF;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.paddle_recalculate_user_access(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_expiry timestamptz;
  v_paddle_expiry timestamptz;
BEGIN
  SELECT max(current_period_end)
  INTO v_active_expiry
  FROM public.paddle_subscriptions s
  JOIN public.paddle_customers c ON c.customer_id = s.customer_id
  WHERE c.user_id = p_user_id
    AND s.subscription_status IN ('active', 'trialing', 'past_due');

  IF v_active_expiry IS NOT NULL THEN
    INSERT INTO public.account_flags (
      user_id, access_expires_at, paddle_access_expires_at
    )
    VALUES (p_user_id, v_active_expiry, v_active_expiry)
    ON CONFLICT (user_id) DO UPDATE SET
      -- GREATEST ignores NULLs, so a first-time grant still lands.
      access_expires_at = GREATEST(
        public.account_flags.access_expires_at,
        EXCLUDED.access_expires_at
      ),
      paddle_access_expires_at = EXCLUDED.paddle_access_expires_at;
    RETURN;
  END IF;

  -- Nothing eligible left: Paddle access ends at the last period it paid for.
  SELECT max(COALESCE(current_period_end, scheduled_change))
  INTO v_paddle_expiry
  FROM public.paddle_subscriptions s
  JOIN public.paddle_customers c ON c.customer_id = s.customer_id
  WHERE c.user_id = p_user_id;

  v_paddle_expiry := COALESCE(v_paddle_expiry, now());

  -- Only lower access that Paddle granted. When access_expires_at still holds
  -- the value Paddle last wrote, it is Paddle's to revoke; when it differs, a
  -- trial, admin comp or pilot extension set it and has to be left alone.
  UPDATE public.account_flags
  SET access_expires_at = GREATEST(
        v_paddle_expiry,
        CASE
          WHEN access_expires_at IS DISTINCT FROM paddle_access_expires_at
            THEN access_expires_at
        END
      ),
      paddle_access_expires_at = v_paddle_expiry
  WHERE user_id = p_user_id;
END;
$$;

-- Marketing-site checkout carries no supabase_user_id and the buyer may not
-- have an account yet, so the account has to claim the customer at signup.
CREATE OR REPLACE FUNCTION public.paddle_claim_customers_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_claimed integer;
BEGIN
  SELECT email::text INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RETURN false;
  END IF;

  UPDATE public.paddle_customers
  SET user_id = p_user_id, updated_at = now()
  WHERE lower(email) = lower(v_email)
    AND user_id IS DISTINCT FROM p_user_id;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed = 0 THEN
    RETURN false;
  END IF;

  PERFORM public.paddle_recalculate_user_access(p_user_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.paddle_claim_customers_on_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.paddle_claim_customers_for_user(NEW.id);
  RETURN NEW;
END;
$$;

-- Sorts after initialize_account_trial_on_user_created, so the trial row
-- already exists; paddle_recalculate_user_access inserts one either way.
DROP TRIGGER IF EXISTS paddle_claim_customers_on_user_created ON auth.users;
CREATE TRIGGER paddle_claim_customers_on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.paddle_claim_customers_on_user_created();

CREATE OR REPLACE FUNCTION public.paddle_process_customer_event(
  p_event_id text,
  p_event_type text,
  p_event_occurred_at timestamptz,
  p_customer_id text,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed integer;
  v_applied integer;
  v_user_id uuid;
BEGIN
  INSERT INTO public.paddle_webhook_events (
    event_id, event_type, occurred_at
  )
  VALUES (p_event_id, p_event_type, p_event_occurred_at)
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed = 0 THEN
    UPDATE public.paddle_webhook_events
    SET event_type = p_event_type,
        occurred_at = p_event_occurred_at
    WHERE event_id = p_event_id
      AND processed_at IS NULL;
    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO public.paddle_customers (
    customer_id, email, last_event_occurred_at
  )
  VALUES (p_customer_id, p_email, p_event_occurred_at)
  ON CONFLICT (customer_id) DO UPDATE SET
    email = EXCLUDED.email,
    last_event_occurred_at = EXCLUDED.last_event_occurred_at,
    updated_at = now()
  WHERE public.paddle_customers.last_event_occurred_at
    <= EXCLUDED.last_event_occurred_at;
  GET DIAGNOSTICS v_applied = ROW_COUNT;

  IF v_applied > 0 THEN
    -- A corrected email can link a customer whose subscriptions were already
    -- mirrored, so the newly linked account needs its access recalculated.
    v_user_id := public.paddle_link_customer_user(p_email, NULL);
    IF v_user_id IS NOT NULL THEN
      PERFORM public.paddle_recalculate_user_access(v_user_id);
    END IF;
  END IF;

  UPDATE public.paddle_webhook_events
  SET processed_at = now()
  WHERE event_id = p_event_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.paddle_process_subscription_event(
  p_event_id text,
  p_event_type text,
  p_event_occurred_at timestamptz,
  p_subscription_id text,
  p_customer_id text,
  p_email text,
  p_user_id uuid,
  p_status text,
  p_price_id text,
  p_product_id text,
  p_period_end timestamptz,
  p_scheduled_change timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed integer;
  v_applied integer;
  v_user_id uuid;
  v_effective_email text;
BEGIN
  INSERT INTO public.paddle_webhook_events (
    event_id, event_type, occurred_at
  )
  VALUES (p_event_id, p_event_type, p_event_occurred_at)
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed = 0 THEN
    UPDATE public.paddle_webhook_events
    SET event_type = p_event_type,
        occurred_at = p_event_occurred_at
    WHERE event_id = p_event_id
      AND processed_at IS NULL;
    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO public.paddle_customers (
    customer_id, email, user_id, last_event_occurred_at
  )
  VALUES (p_customer_id, p_email, NULL, p_event_occurred_at)
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT email
  INTO v_effective_email
  FROM public.paddle_customers
  WHERE customer_id = p_customer_id;

  v_user_id := public.paddle_link_customer_user(v_effective_email, p_user_id);

  INSERT INTO public.paddle_subscriptions (
    subscription_id,
    customer_id,
    subscription_status,
    price_id,
    product_id,
    current_period_end,
    scheduled_change,
    last_event_occurred_at
  )
  VALUES (
    p_subscription_id,
    p_customer_id,
    p_status,
    p_price_id,
    p_product_id,
    p_period_end,
    p_scheduled_change,
    p_event_occurred_at
  )
  ON CONFLICT (subscription_id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    subscription_status = EXCLUDED.subscription_status,
    price_id = EXCLUDED.price_id,
    product_id = EXCLUDED.product_id,
    current_period_end = EXCLUDED.current_period_end,
    scheduled_change = EXCLUDED.scheduled_change,
    last_event_occurred_at = EXCLUDED.last_event_occurred_at,
    updated_at = now()
  WHERE public.paddle_subscriptions.last_event_occurred_at
    <= EXCLUDED.last_event_occurred_at;
  GET DIAGNOSTICS v_applied = ROW_COUNT;

  IF v_applied > 0 AND v_user_id IS NOT NULL THEN
    PERFORM public.paddle_recalculate_user_access(v_user_id);
  END IF;

  UPDATE public.paddle_webhook_events
  SET processed_at = now()
  WHERE event_id = p_event_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_billing_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_access_expires_at timestamptz;
  v_customer_id text;
  v_subscription_id text;
  v_subscription_status text;
  v_scheduled_change timestamptz;
  v_current_period_end timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  SELECT email::text
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT access_expires_at
  INTO v_access_expires_at
  FROM public.account_flags
  WHERE user_id = v_user_id;

  SELECT customer_id
  INTO v_customer_id
  FROM public.paddle_customers
  WHERE user_id = v_user_id
     OR lower(email) = lower(v_email)
  ORDER BY (user_id = v_user_id) DESC, updated_at DESC
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    SELECT
      subscription_id,
      subscription_status,
      scheduled_change,
      current_period_end
    INTO
      v_subscription_id,
      v_subscription_status,
      v_scheduled_change,
      v_current_period_end
    FROM public.paddle_subscriptions
    WHERE customer_id = v_customer_id
    ORDER BY
      (subscription_status IN ('active', 'trialing', 'past_due')) DESC,
      updated_at DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'paddle_customer_id', v_customer_id,
    'subscription_id', v_subscription_id,
    'subscription_status', v_subscription_status,
    'scheduled_change', v_scheduled_change,
    'current_period_end', v_current_period_end,
    'access_expires_at', v_access_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.paddle_link_customer_user(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.paddle_recalculate_user_access(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.paddle_claim_customers_for_user(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.paddle_claim_customers_on_user_created()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.paddle_process_customer_event(
  text, text, timestamptz, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.paddle_process_subscription_event(
  text, text, timestamptz, text, text, text, uuid, text, text, text,
  timestamptz, timestamptz
)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_billing_summary() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.paddle_link_customer_user(text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.paddle_recalculate_user_access(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.paddle_process_customer_event(
  text, text, timestamptz, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.paddle_process_subscription_event(
  text, text, timestamptz, text, text, text, uuid, text, text, text,
  timestamptz, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.paddle_claim_customers_for_user(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_billing_summary() TO authenticated;

-- Backfill: accounts that already exist but bought before this migration (or
-- through the marketing site) are still unlinked, so claim them once here.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT DISTINCT u.id
    FROM public.paddle_customers c
    JOIN auth.users u ON lower(u.email) = lower(c.email)
    WHERE c.user_id IS NULL
  LOOP
    PERFORM public.paddle_claim_customers_for_user(v_user_id);
  END LOOP;
END
$$;
