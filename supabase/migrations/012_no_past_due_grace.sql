-- Remove the past_due dunning grace from Paddle access recalculation.
-- Apply via Supabase SQL Editor AFTER 011_paddle_transaction_and_scheduled_action.sql.
--
-- 010 counted past_due as access-granting, commented as "grace while Paddle
-- retries payment". That grace never functioned: access_expires_at is
-- max(current_period_end), and a failed charge does not advance
-- current_period_end, so the timestamp gate in register_device closed anyway.
-- The code promised a retry window the database never honoured.
--
-- Rather than build a real grace window, the owner chose to withhold grace.
-- This states the enforced behaviour: when a renewal charge fails, access ends
-- at the last period actually paid for.
--
-- Keep in sync with subscriptionStatusGrantsAccess in src/lib/paddle/access.ts.
-- paddle-billing-contract.test.ts asserts the two agree.
--
-- Deliberately unchanged:
--   * CANCELLABLE_STATUSES (paddle-cancel-subscription) still includes
--     past_due — a failing subscription must remain cancellable.
--   * get_my_billing_summary still ranks past_due when choosing the primary
--     subscription, so the UI can report a failed payment.

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
  -- past_due intentionally absent: no dunning grace.
  SELECT max(current_period_end)
  INTO v_active_expiry
  FROM public.paddle_subscriptions s
  JOIN public.paddle_customers c ON c.customer_id = s.customer_id
  WHERE c.user_id = p_user_id
    AND s.subscription_status IN ('active', 'trialing');

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
  -- A past_due subscription reaches here, and its current_period_end is that
  -- last paid period, so access stops there rather than extending.
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
