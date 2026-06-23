-- SabbathCue trial and renewable access gates.
-- Apply via Supabase SQL Editor AFTER 005_announcements.sql.
--
-- Existing non-admin accounts are intentionally not backfilled. Without an
-- access_expires_at value, register_device fails closed with trial_expired.

ALTER TABLE public.account_flags
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.initialize_account_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_flags (user_id, access_expires_at)
  VALUES (NEW.id, now() + interval '14 days')
  ON CONFLICT (user_id) DO UPDATE SET
    access_expires_at = COALESCE(
      public.account_flags.access_expires_at,
      EXCLUDED.access_expires_at
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS initialize_account_trial_on_user_created ON auth.users;
CREATE TRIGGER initialize_account_trial_on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_account_trial();

CREATE OR REPLACE FUNCTION public.register_device(
  p_device_id text,
  p_os text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_device_count integer;
  v_access_expires_at timestamptz;
  v_is_admin boolean;
  v_return_access_expires_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.account_flags
    WHERE user_id = v_user_id AND suspended
  ) THEN
    RETURN jsonb_build_object('status', 'suspended');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = v_user_id
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    SELECT access_expires_at
    INTO v_access_expires_at
    FROM public.account_flags
    WHERE user_id = v_user_id;

    IF v_access_expires_at IS NULL OR v_access_expires_at <= now() THEN
      RETURN jsonb_build_object('status', 'trial_expired');
    END IF;
  END IF;

  IF p_device_id IS NULL OR btrim(p_device_id) = '' THEN
    RAISE EXCEPTION 'device_id is required'
      USING ERRCODE = '22023';
  END IF;

  -- Preserve the race fix from 003: serialize registration per account.
  PERFORM pg_advisory_xact_lock(hashtext('register_device:' || v_user_id::text));

  v_return_access_expires_at := CASE
    WHEN v_is_admin THEN '9999-12-31 23:59:59+00'::timestamptz
    ELSE v_access_expires_at
  END;

  IF EXISTS (
    SELECT 1
    FROM public.devices
    WHERE user_id = v_user_id
      AND device_id = p_device_id
  ) THEN
    UPDATE public.devices
    SET
      last_seen_at = now(),
      os = COALESCE(p_os, os),
      app_version = COALESCE(p_app_version, app_version),
      label = COALESCE(p_label, label)
    WHERE user_id = v_user_id
      AND device_id = p_device_id;

    RETURN jsonb_build_object(
      'status', 'ok',
      'access_expires_at', v_return_access_expires_at
    );
  END IF;

  SELECT count(*)::integer
  INTO v_device_count
  FROM public.devices
  WHERE user_id = v_user_id;

  IF v_device_count >= 2 THEN
    RETURN jsonb_build_object('status', 'device_limit_reached');
  END IF;

  INSERT INTO public.devices (user_id, device_id, os, app_version, label)
  VALUES (v_user_id, p_device_id, p_os, p_app_version, p_label);

  RETURN jsonb_build_object(
    'status', 'ok',
    'access_expires_at', v_return_access_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_access(
  p_user_id uuid,
  p_days integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_days IS NULL OR p_days <= 0 THEN
    RAISE EXCEPTION 'days must be positive'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.account_flags (user_id, access_expires_at)
  VALUES (p_user_id, now() + make_interval(days => p_days))
  ON CONFLICT (user_id) DO UPDATE SET
    access_expires_at = EXCLUDED.access_expires_at;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_accounts();
CREATE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  suspended boolean,
  suspend_reason text,
  access_expires_at timestamptz,
  device_count bigint,
  last_seen_at timestamptz,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COALESCE(f.suspended, false),
    f.suspend_reason,
    f.access_expires_at,
    count(d.id),
    max(d.last_seen_at),
    EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.account_flags f ON f.user_id = u.id
  LEFT JOIN public.devices d ON d.user_id = u.id
  GROUP BY u.id, u.email, u.created_at, f.suspended, f.suspend_reason, f.access_expires_at
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_account_trial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_access(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_set_access(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated;
