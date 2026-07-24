export const PADDLE_TXN_QUERY_PARAM = "_ptxn";

/** Parse Paddle transaction id from default payment link query (?_ptxn=txn_...). */
export function parsePtxnFromSearchParams(
  search: string | URLSearchParams
): string | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const value = params.get(PADDLE_TXN_QUERY_PARAM)?.trim();
  if (!value || !/^txn_[a-z\d]{26}$/.test(value)) return null;
  return value;
}
