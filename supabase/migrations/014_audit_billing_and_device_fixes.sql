-- Security and correctness fixes from the 2026-11-25 audit:
--   BW-06: Keep stale transaction.completed webhooks from reverting newer customer emails.
--   BW-07: Recalculate previous user's access and allow clearing user_id to NULL on email reassignment.
--   BW-08: Fix NULLS FIRST ordering on (user_id = v_user_id) DESC and aggregate across all user customers.
--   BW-09: Auto-promote a pending device on re-registration when 0 approved devices remain.
-- Apply via Supabase SQL Editor AFTER 013_additive_admin_access.sql.

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
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  -- Checkout custom data is only trusted when it agrees with the authenticated
  -- account email. Email lookup remains the fallback for customer.* events.
  IF p_user_id IS NOT NULL THEN
    SELECT id
    INTO v_user_id
    FROM auth.users
    WHERE id = p_user_id
      AND lower(email) = lower(p_email)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT id
    INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(p_email)
    LIMIT 1;
  END IF;

  -- Always sync user_id (including clearing to NULL when no auth user matches)
  -- so email reassignment cannot leave a previous user attached.
  UPDATE public.paddle_customers
  SET user_id = v_user_id, updated_at = now()
  WHERE lower(email) = lower(p_email)
    AND user_id IS DISTINCT FROM v_user_id;

  RETURN v_user_id;
END;
$$;

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
  v_prev_user_id uuid;
  v_new_user_id uuid;
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

  SELECT user_id
  INTO v_prev_user_id
  FROM public.paddle_customers
  WHERE customer_id = p_customer_id
  FOR UPDATE;

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
    v_new_user_id := public.paddle_link_customer_user(p_email, NULL);
    IF v_prev_user_id IS NOT NULL
       AND v_prev_user_id IS DISTINCT FROM v_new_user_id THEN
      PERFORM public.paddle_recalculate_user_access(v_prev_user_id);
    END IF;
    IF v_new_user_id IS NOT NULL THEN
      PERFORM public.paddle_recalculate_user_access(v_new_user_id);
    END IF;
  END IF;

  UPDATE public.paddle_webhook_events
  SET processed_at = now()
  WHERE event_id = p_event_id;

  RETURN true;
END;
$$;

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
  v_applied integer;
  v_prev_user_id uuid;
  v_effective_email text;
  v_new_user_id uuid;
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

  SELECT user_id
  INTO v_prev_user_id
  FROM public.paddle_customers
  WHERE customer_id = p_customer_id
  FOR UPDATE;

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
     OR public.paddle_customers.email IS NULL;
  GET DIAGNOSTICS v_applied = ROW_COUNT;

  SELECT email
  INTO v_effective_email
  FROM public.paddle_customers
  WHERE customer_id = p_customer_id;

  v_new_user_id := public.paddle_link_customer_user(v_effective_email, p_user_id);
  IF v_applied > 0
     AND v_prev_user_id IS NOT NULL
     AND v_prev_user_id IS DISTINCT FROM v_new_user_id THEN
    PERFORM public.paddle_recalculate_user_access(v_prev_user_id);
  END IF;
  IF v_new_user_id IS NOT NULL THEN
    PERFORM public.paddle_recalculate_user_access(v_new_user_id);
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

  SELECT
    s.customer_id,
    s.subscription_id,
    s.subscription_status,
    s.scheduled_change,
    s.scheduled_change_action,
    s.current_period_end
  INTO
    v_customer_id,
    v_subscription_id,
    v_subscription_status,
    v_scheduled_change,
    v_scheduled_change_action,
    v_current_period_end
  FROM public.paddle_subscriptions s
  JOIN public.paddle_customers c ON c.customer_id = s.customer_id
  WHERE c.user_id = v_user_id
     OR (
       c.user_id IS NULL
       AND v_email IS NOT NULL
       AND lower(c.email) = lower(v_email)
     )
  ORDER BY
    (s.subscription_status IN ('active', 'trialing')) DESC,
    (s.subscription_status = 'past_due') DESC,
    (c.user_id IS NOT DISTINCT FROM v_user_id) DESC,
    s.updated_at DESC
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    SELECT c.customer_id
    INTO v_customer_id
    FROM public.paddle_customers c
    WHERE c.user_id = v_user_id
       OR (
         c.user_id IS NULL
         AND v_email IS NOT NULL
         AND lower(c.email) = lower(v_email)
       )
    ORDER BY
      (c.user_id IS NOT DISTINCT FROM v_user_id) DESC,
      c.updated_at DESC
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

CREATE OR REPLACE FUNCTION public.register_device_verified(
  p_user_id uuid,
  p_device_id text,
  p_os text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_public_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_existing_status text;
  v_approved_count integer;
  v_access_expires_at timestamptz;
  v_is_admin boolean;
  v_return_access_expires_at timestamptz;
  v_is_church_organization boolean;
  v_church_name text;
  v_offline_lease_hours smallint;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_device_id IS NULL OR btrim(p_device_id) = '' THEN
    RAISE EXCEPTION 'device_id is required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.account_flags
    WHERE user_id = v_user_id AND suspended
  ) THEN
    RETURN jsonb_build_object('status', 'suspended');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = v_user_id
  ) INTO v_is_admin;
  SELECT access_expires_at, is_church_organization, church_name, offline_lease_hours
  INTO v_access_expires_at, v_is_church_organization, v_church_name, v_offline_lease_hours
  FROM public.account_flags WHERE user_id = v_user_id;

  IF NOT v_is_admin AND (
    v_access_expires_at IS NULL OR v_access_expires_at <= now()
  ) THEN
    RETURN jsonb_build_object('status', 'trial_expired');
  END IF;

  v_return_access_expires_at := CASE
    WHEN v_is_admin THEN '9999-12-31 23:59:59+00'::timestamptz
    ELSE v_access_expires_at
  END;

  PERFORM pg_advisory_xact_lock(hashtext('register_device:' || v_user_id::text));

  SELECT status INTO v_existing_status
  FROM public.devices
  WHERE user_id = v_user_id AND device_id = p_device_id;

  IF v_existing_status = 'revoked' THEN
    RETURN jsonb_build_object('status', 'device_revoked');
  END IF;
  IF v_existing_status IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devices
    WHERE user_id = v_user_id AND device_id = p_device_id
      AND public_key IS NOT NULL AND public_key <> p_public_key
  ) THEN
    RETURN jsonb_build_object('status', 'device_identity_mismatch');
  END IF;

  SELECT count(*)::integer INTO v_approved_count
  FROM public.devices
  WHERE user_id = v_user_id AND status = 'approved';

  IF v_existing_status = 'pending' THEN
    IF v_approved_count = 0 THEN
      UPDATE public.devices
      SET status = 'approved',
          approved_at = now(),
          revoked_at = NULL,
          last_seen_at = now(),
          os = COALESCE(p_os, os),
          app_version = COALESCE(p_app_version, app_version),
          label = COALESCE(p_label, label),
          public_key = COALESCE(public_key, p_public_key)
      WHERE user_id = v_user_id AND device_id = p_device_id;

      RETURN jsonb_build_object(
        'status', 'ok',
        'access_expires_at', v_return_access_expires_at,
        'is_church_organization', COALESCE(v_is_church_organization, false),
        'church_name', v_church_name,
        'offline_lease_hours', COALESCE(v_offline_lease_hours, 72)
      );
    END IF;

    UPDATE public.devices
    SET last_seen_at = now(), os = COALESCE(p_os, os),
        app_version = COALESCE(p_app_version, app_version),
        label = COALESCE(p_label, label),
        public_key = COALESCE(public_key, p_public_key)
    WHERE user_id = v_user_id AND device_id = p_device_id;
    RETURN jsonb_build_object('status', 'device_pending');
  END IF;

  IF v_existing_status = 'approved' THEN
    UPDATE public.devices
    SET last_seen_at = now(), os = COALESCE(p_os, os),
        app_version = COALESCE(p_app_version, app_version),
        label = COALESCE(p_label, label),
        public_key = COALESCE(public_key, p_public_key)
    WHERE user_id = v_user_id AND device_id = p_device_id;
    RETURN jsonb_build_object(
      'status', 'ok',
      'access_expires_at', v_return_access_expires_at,
      'is_church_organization', COALESCE(v_is_church_organization, false),
      'church_name', v_church_name,
      'offline_lease_hours', COALESCE(v_offline_lease_hours, 72)
    );
  END IF;

  IF v_approved_count >= 2 THEN
    RETURN jsonb_build_object('status', 'device_limit_reached');
  END IF;

  INSERT INTO public.devices (
    user_id, device_id, os, app_version, label, status, approved_at, public_key
  ) VALUES (
    v_user_id, p_device_id, p_os, p_app_version, p_label,
    CASE WHEN v_approved_count = 0 THEN 'approved' ELSE 'pending' END,
    CASE WHEN v_approved_count = 0 THEN now() ELSE NULL END,
    p_public_key
  );

  IF v_approved_count > 0 THEN
    RETURN jsonb_build_object('status', 'device_pending');
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'access_expires_at', v_return_access_expires_at,
    'is_church_organization', COALESCE(v_is_church_organization, false),
    'church_name', v_church_name,
    'offline_lease_hours', COALESCE(v_offline_lease_hours, 72)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.paddle_link_customer_user(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.paddle_process_customer_event(
  text, text, timestamptz, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.paddle_process_transaction_event(
  text, text, timestamptz, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_billing_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_device_verified(
  uuid, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.paddle_link_customer_user(text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.paddle_process_customer_event(
  text, text, timestamptz, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.paddle_process_transaction_event(
  text, text, timestamptz, text, text, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_billing_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_verified(
  uuid, text, text, text, text, text
) TO service_role;
