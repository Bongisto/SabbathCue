import { getSupabaseClient } from "../supabase-client";

export async function fetchSignedInPaddleCustomerId(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;

    const { data, error } = await supabase.rpc("get_my_billing_summary");
    if (error || !data || typeof data !== "object") return null;

    const customerId = (data as { paddle_customer_id?: unknown })
      .paddle_customer_id;
    return typeof customerId === "string" && customerId.startsWith("ctm_")
      ? customerId
      : null;
  } catch {
    return null;
  }
}
