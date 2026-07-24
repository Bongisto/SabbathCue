-- Behavioural tests for supabase/migrations/010_paddle_billing.sql.
-- Run with `npm run test:db` (spins up a throwaway Postgres via Docker).
--
-- Each test runs in its own DO block; a failure is recorded rather than
-- aborting the run, so one broken case does not hide the rest.

CREATE TABLE IF NOT EXISTS test_results (
  name text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text
);
TRUNCATE test_results;

CREATE OR REPLACE FUNCTION test_assert(p_condition boolean, p_label text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS NOT TRUE THEN
    RAISE EXCEPTION 'assertion failed: %', p_label;
  END IF;
END;
$$;


-- A customer who buys on the marketing site before creating an account must
-- get their paid access when they sign up. The web checkout sends no
-- supabase_user_id, so the email is the only link.
DO $$
DECLARE
  v_user uuid;
  v_access timestamptz;
BEGIN
  PERFORM public.paddle_process_subscription_event(
    'evt_presignup_1', 'subscription.created', now(),
    'sub_presignup', 'ctm_presignup', 'Early.Buyer@Example.com', NULL,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL);

  PERFORM test_assert(
    (SELECT user_id IS NULL FROM public.paddle_customers
      WHERE customer_id = 'ctm_presignup'),
    'customer starts unlinked when no account exists');

  INSERT INTO auth.users (email) VALUES ('early.buyer@example.com')
  RETURNING id INTO v_user;

  PERFORM test_assert(
    (SELECT user_id = v_user FROM public.paddle_customers
      WHERE customer_id = 'ctm_presignup'),
    'signup claims the paddle customer regardless of email case');

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;

  PERFORM test_assert(v_access > now() + interval '29 days',
    'signup grants the paid period, not just the 14-day trial');

  INSERT INTO test_results VALUES
    ('subscription_before_signup_grants_access_on_signup', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('subscription_before_signup_grants_access_on_signup', false, SQLERRM);
END
$$;


-- An access grant made outside Paddle (admin comp, pilot extension) must not be
-- clawed back when an unrelated Paddle subscription reports canceled.
DO $$
DECLARE
  v_admin uuid;
  v_user uuid;
  v_access timestamptz;
BEGIN
  INSERT INTO auth.users (email) VALUES ('comp.admin@example.com')
  RETURNING id INTO v_admin;
  INSERT INTO public.app_admins (user_id) VALUES (v_admin);

  INSERT INTO auth.users (email) VALUES ('comped@example.com')
  RETURNING id INTO v_user;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM public.admin_set_access(v_user, 365);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  PERFORM public.paddle_process_subscription_event(
    'evt_comp_1', 'subscription.created', now() - interval '1 minute',
    'sub_comp', 'ctm_comp', 'comped@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL);

  -- Paddle sends current_billing_period as null on subscription.canceled.
  PERFORM public.paddle_process_subscription_event(
    'evt_comp_2', 'subscription.canceled', now(),
    'sub_comp', 'ctm_comp', 'comped@example.com', v_user,
    'canceled', 'pri_1', 'pro_1', NULL, NULL);

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;

  PERFORM test_assert(v_access > now() + interval '300 days',
    'admin comp survives a paddle cancellation');

  INSERT INTO test_results VALUES
    ('admin_grant_survives_subscription_cancel', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('admin_grant_survives_subscription_cancel', false, SQLERRM);
END
$$;


-- The other side of the same rule: access that Paddle granted must still be
-- revoked when the subscription ends.
DO $$
DECLARE
  v_user uuid;
  v_access timestamptz;
BEGIN
  INSERT INTO auth.users (email) VALUES ('paddleonly@example.com')
  RETURNING id INTO v_user;

  PERFORM public.paddle_process_subscription_event(
    'evt_only_1', 'subscription.created', now() - interval '1 minute',
    'sub_only', 'ctm_only', 'paddleonly@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL);

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;
  PERFORM test_assert(v_access > now() + interval '29 days',
    'active subscription extends access past the trial');

  PERFORM public.paddle_process_subscription_event(
    'evt_only_2', 'subscription.canceled', now(),
    'sub_only', 'ctm_only', 'paddleonly@example.com', v_user,
    'canceled', 'pri_1', 'pro_1', NULL, NULL);

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;
  PERFORM test_assert(v_access <= now() + interval '1 minute',
    'paddle-granted access is revoked once the subscription ends');

  INSERT INTO test_results VALUES
    ('paddle_granted_access_is_revoked_on_cancel', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('paddle_granted_access_is_revoked_on_cancel', false, SQLERRM);
END
$$;


-- Trialing subscriptions grant access until the trial / period end.
DO $$
DECLARE
  v_user uuid;
  v_access timestamptz;
BEGIN
  INSERT INTO auth.users (email) VALUES ('trialing@example.com')
  RETURNING id INTO v_user;

  PERFORM public.paddle_process_subscription_event(
    'evt_trial_1', 'subscription.created', now() - interval '1 minute',
    'sub_trial', 'ctm_trial', 'trialing@example.com', v_user,
    'trialing', 'pri_1', 'pro_1', now() + interval '14 days', NULL);

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;
  PERFORM test_assert(v_access > now() + interval '13 days',
    'trialing subscription grants access through the trial period');

  INSERT INTO test_results VALUES
    ('trialing_subscription_grants_access', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('trialing_subscription_grants_access', false, SQLERRM);
END
$$;


-- A renewal pushes the expiry out.
DO $$
DECLARE
  v_user uuid;
  v_access timestamptz;
BEGIN
  INSERT INTO auth.users (email) VALUES ('renewer@example.com')
  RETURNING id INTO v_user;

  PERFORM public.paddle_process_subscription_event(
    'evt_renew_1', 'subscription.created', now() - interval '1 minute',
    'sub_renew', 'ctm_renew', 'renewer@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL);

  PERFORM public.paddle_process_subscription_event(
    'evt_renew_2', 'subscription.updated', now(),
    'sub_renew', 'ctm_renew', 'renewer@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '60 days', NULL);

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;
  PERFORM test_assert(v_access > now() + interval '59 days',
    'renewal extends access to the new period end');

  INSERT INTO test_results VALUES ('renewal_extends_access', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES ('renewal_extends_access', false, SQLERRM);
END
$$;


-- Paddle retries webhooks; replaying an event must not change anything.
DO $$
DECLARE
  v_user uuid;
  v_second boolean;
  v_rows integer;
BEGIN
  INSERT INTO auth.users (email) VALUES ('replay@example.com')
  RETURNING id INTO v_user;

  PERFORM public.paddle_process_subscription_event(
    'evt_replay_1', 'subscription.created', now(),
    'sub_replay', 'ctm_replay', 'replay@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL);

  SELECT public.paddle_process_subscription_event(
    'evt_replay_1', 'subscription.created', now(),
    'sub_replay', 'ctm_replay', 'replay@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL)
  INTO v_second;

  PERFORM test_assert(v_second IS FALSE, 'replayed event reports not-processed');

  SELECT count(*) INTO v_rows FROM public.paddle_subscriptions
  WHERE subscription_id = 'sub_replay';
  PERFORM test_assert(v_rows = 1, 'replayed event does not duplicate the row');

  INSERT INTO test_results VALUES ('replayed_event_is_ignored', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES ('replayed_event_is_ignored', false, SQLERRM);
END
$$;


-- Paddle does not guarantee delivery order; an older event must not overwrite
-- newer subscription state.
DO $$
DECLARE
  v_user uuid;
  v_status text;
  v_access timestamptz;
BEGIN
  INSERT INTO auth.users (email) VALUES ('reorder@example.com')
  RETURNING id INTO v_user;

  PERFORM public.paddle_process_subscription_event(
    'evt_reorder_new', 'subscription.updated', now(),
    'sub_reorder', 'ctm_reorder', 'reorder@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL);

  PERFORM public.paddle_process_subscription_event(
    'evt_reorder_old', 'subscription.canceled', now() - interval '1 hour',
    'sub_reorder', 'ctm_reorder', 'reorder@example.com', v_user,
    'canceled', 'pri_1', 'pro_1', NULL, NULL);

  SELECT subscription_status INTO v_status
  FROM public.paddle_subscriptions WHERE subscription_id = 'sub_reorder';
  PERFORM test_assert(v_status = 'active',
    'late-arriving older event does not overwrite newer status');

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;
  PERFORM test_assert(v_access > now() + interval '29 days',
    'late-arriving older event does not revoke access');

  INSERT INTO test_results VALUES ('out_of_order_event_is_ignored', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('out_of_order_event_is_ignored', false, SQLERRM);
END
$$;


-- customer.updated is what links a checkout to an account when the
-- subscription event arrived with an address Paddle later corrected.
DO $$
DECLARE
  v_user uuid;
  v_access timestamptz;
BEGIN
  PERFORM public.paddle_process_subscription_event(
    'evt_cust_1', 'subscription.created', now() - interval '1 minute',
    'sub_cust', 'ctm_cust', 'placeholder@example.invalid', NULL,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL);

  INSERT INTO auth.users (email) VALUES ('corrected@example.com')
  RETURNING id INTO v_user;

  PERFORM public.paddle_process_customer_event(
    'evt_cust_2', 'customer.updated', now(),
    'ctm_cust', 'corrected@example.com');

  PERFORM test_assert(
    (SELECT user_id = v_user FROM public.paddle_customers
      WHERE customer_id = 'ctm_cust'),
    'customer event links the account');

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;
  PERFORM test_assert(v_access > now() + interval '29 days',
    'customer event recalculates access for the newly linked user');

  INSERT INTO test_results VALUES
    ('customer_event_links_and_grants_access', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('customer_event_links_and_grants_access', false, SQLERRM);
END
$$;


-- A scheduled cancel must keep access while status stays active.
DO $$
DECLARE
  v_user uuid;
  v_status text;
  v_action text;
  v_access timestamptz;
BEGIN
  INSERT INTO auth.users (email) VALUES ('scheduled@example.com')
  RETURNING id INTO v_user;

  PERFORM public.paddle_process_subscription_event(
    'evt_sched_1', 'subscription.created', now() - interval '1 minute',
    'sub_sched', 'ctm_sched', 'scheduled@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days', NULL, NULL);

  PERFORM public.paddle_process_subscription_event(
    'evt_sched_2', 'subscription.updated', now(),
    'sub_sched', 'ctm_sched', 'scheduled@example.com', v_user,
    'active', 'pri_1', 'pro_1', now() + interval '30 days',
    now() + interval '30 days', 'cancel');

  SELECT subscription_status, scheduled_change_action
  INTO v_status, v_action
  FROM public.paddle_subscriptions WHERE subscription_id = 'sub_sched';

  PERFORM test_assert(v_status = 'active',
    'scheduled cancel leaves status active');
  PERFORM test_assert(v_action = 'cancel',
    'scheduled_change_action is stored');

  SELECT access_expires_at INTO v_access
  FROM public.account_flags WHERE user_id = v_user;
  PERFORM test_assert(v_access > now() + interval '29 days',
    'scheduled cancel does not revoke access early');

  INSERT INTO test_results VALUES
    ('scheduled_cancel_keeps_access_while_active', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('scheduled_cancel_keeps_access_while_active', false, SQLERRM);
END
$$;


-- transaction.completed upserts the customer and is idempotent on replay.
DO $$
DECLARE
  v_first boolean;
  v_second boolean;
  v_email text;
BEGIN
  SELECT public.paddle_process_transaction_event(
    'evt_txn_1', 'transaction.completed', now(),
    'ctm_txn', 'txn.buyer@example.com', NULL)
  INTO v_first;
  PERFORM test_assert(v_first IS TRUE, 'first transaction event processes');

  SELECT email INTO v_email
  FROM public.paddle_customers WHERE customer_id = 'ctm_txn';
  PERFORM test_assert(v_email = 'txn.buyer@example.com',
    'transaction event upserts customer email');

  SELECT public.paddle_process_transaction_event(
    'evt_txn_1', 'transaction.completed', now(),
    'ctm_txn', 'txn.buyer@example.com', NULL)
  INTO v_second;
  PERFORM test_assert(v_second IS FALSE, 'replayed transaction is ignored');

  INSERT INTO test_results VALUES
    ('transaction_completed_upserts_customer_idempotently', true, NULL);
EXCEPTION WHEN others THEN
  INSERT INTO test_results VALUES
    ('transaction_completed_upserts_customer_idempotently', false, SQLERRM);
END
$$;


\echo ''
SELECT
  CASE WHEN passed THEN 'ok  ' ELSE 'FAIL' END AS result,
  name,
  detail
FROM test_results
ORDER BY passed, name;

DO $$
DECLARE
  v_failures integer;
BEGIN
  SELECT count(*) INTO v_failures FROM test_results WHERE NOT passed;
  IF v_failures > 0 THEN
    RAISE EXCEPTION '% of % SQL test(s) failed',
      v_failures, (SELECT count(*) FROM test_results);
  END IF;
  RAISE NOTICE 'all % SQL test(s) passed', (SELECT count(*) FROM test_results);
END
$$;
