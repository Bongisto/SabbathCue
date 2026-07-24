-- Extend Paddle subscription mirror with scheduled_change_action and
-- transaction.completed idempotent processing.
-- Apply after 010_paddle_billing.sql.

ALTER TABLE public.paddle_subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_change_action text;

-- Idempotent ledger + customer upsert for transaction.completed.
-- Subscription access still comes from subscription.* events; this ensures
-- the customer row exists (and is email-linked) as soon as payment completes.
CREATE OR REPLACE FUNCTION public.paddle_process_transaction_event(
  p_event_id text,
  p_event_type text,
  p_event_occurred_at timestamptz,
  p_customer_id text,
  p_email text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed integer;
  v_user_id uuid;
BEGIN
  IF p_customer_id IS NULL OR btrim(p_customer_id) = '' THEN
    RAISE EXCEPTION 'transaction event missing customer_id';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'transaction event missing email';
  END IF;

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
    last_event_occurred_at = GREATEST(
      public.paddle_customers.last_event_occurred_at,
      EXCLUDED.last_event_occurred_at
    ),
    updated_at = now()
  WHERE public.paddle_customers.last_event_occurred_at
    <= EXCLUDED.last_event_occurred_at
     OR public.paddle_customers.email IS DISTINCT FROM EXCLUDED.email;

  v_user_id := public.paddle_link_customer_user(p_email, p_user_id);
  IF v_user_id IS NOT NULL THEN
    PERFORM public.paddle_recalculate_user_access(v_user_id);
  END IF;

  UPDATE public.paddle_webhook_events
  SET processed_at = now()
  WHERE event_id = p_event_id;

  RETURN true;
END;
$$;

-- Replace subscription processor to persist scheduled_change_action.
-- DROP the 010 signature first — CREATE OR REPLACE does not replace when
-- the argument list changes.
DROP FUNCTION IF EXISTS public.paddle_process_subscription_event(
  text, text, timestamptz, text, text, text, uuid, text, text, text,
  timestamptz, timestamptz
);

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
  p_scheduled_change timestamptz,
  p_scheduled_change_action text DEFAULT NULL
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
    scheduled_change_action,
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
    p_scheduled_change_action,
    p_event_occurred_at
  )
  ON CONFLICT (subscription_id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    subscription_status = EXCLUDED.subscription_status,
    price_id = EXCLUDED.price_id,
    product_id = EXCLUDED.product_id,
    current_period_end = EXCLUDED.current_period_end,
    scheduled_change = EXCLUDED.scheduled_change,
    scheduled_change_action = EXCLUDED.scheduled_change_action,
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

REVOKE ALL ON FUNCTION public.paddle_process_transaction_event(
  text, text, timestamptz, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.paddle_process_transaction_event(
  text, text, timestamptz, text, text, uuid
) TO service_role;

-- New overload with scheduled_change_action; keep grants on the 12-arg form
-- from 010 working via DEFAULT NULL on the new parameter in Postgres.
REVOKE ALL ON FUNCTION public.paddle_process_subscription_event(
  text, text, timestamptz, text, text, text, uuid, text, text, text,
  timestamptz, timestamptz, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.paddle_process_subscription_event(
  text, text, timestamptz, text, text, text, uuid, text, text, text,
  timestamptz, timestamptz, text
) TO service_role;

-- Expose scheduled_change_action on authenticated billing summaries.
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
  v_scheduled_change_action text;
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
      scheduled_change_action,
      current_period_end
    INTO
      v_subscription_id,
      v_subscription_status,
      v_scheduled_change,
      v_scheduled_change_action,
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
    'scheduled_change_action', v_scheduled_change_action,
    'current_period_end', v_current_period_end,
    'access_expires_at', v_access_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_billing_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_billing_summary() TO authenticated;
