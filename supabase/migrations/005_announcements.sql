-- SabbathCue in-app announcements: admin-authored, user-visible when published.
-- Apply via Supabase SQL Editor AFTER 004_lockdown_rls_auto_enable.sql.

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  body text NOT NULL CHECK (char_length(btrim(body)) > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'expired')),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_read_active_or_admin ON public.announcements;
CREATE POLICY announcements_read_active_or_admin
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    public.is_app_admin()
    OR (
      status = 'published'
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- Signed-in users: published announcements that are not expired.
CREATE OR REPLACE FUNCTION public.fetch_active_announcements()
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  published_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT a.id, a.title, a.body, a.published_at, a.expires_at
  FROM public.announcements a
  WHERE a.status = 'published'
    AND (a.expires_at IS NULL OR a.expires_at > now())
  ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_announcements()
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  status text,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.body,
    a.status,
    a.published_at,
    a.expires_at,
    a.created_at,
    a.updated_at
  FROM public.announcements a
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_announcement(
  p_title text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required'
      USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'body is required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.announcements (title, body, status)
  VALUES (btrim(p_title), btrim(p_body), 'draft')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_announcement(
  p_id uuid,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
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

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'published', 'expired') THEN
    RAISE EXCEPTION 'invalid status'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.announcements
  SET
    title = COALESCE(NULLIF(btrim(p_title), ''), title),
    body = COALESCE(NULLIF(btrim(p_body), ''), body),
    status = COALESCE(p_status, status),
    published_at = CASE
      WHEN p_status = 'published' AND published_at IS NULL THEN now()
      WHEN p_status = 'published' THEN published_at
      ELSE published_at
    END,
    expires_at = CASE
      WHEN p_status = 'expired' THEN COALESCE(p_expires_at, now())
      ELSE p_expires_at
    END,
    updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'announcement not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_announcement(p_id uuid)
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

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id is required'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.announcements WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'announcement not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_active_announcements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_announcements() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_announcement(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_announcement(uuid, text, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_announcement(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fetch_active_announcements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_announcements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_announcement(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_announcement(uuid, text, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_announcement(uuid) TO authenticated;
