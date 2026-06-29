import { getSupabaseClient } from "@/lib/supabase/client"
import { failureMessage, isNetworkError } from "@/lib/supabase/errors"

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export interface CallRpcOptions {
  args?: Record<string, unknown>
  errorFallback: string
  catchFallback: string
}

/** Shared Supabase RPC wrapper — client lookup, error mapping, network catch. */
export async function callRpc<T>(
  name: string,
  options: CallRpcOptions
): Promise<RpcResult<T>> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = options.args
      ? await supabase.rpc(name, options.args)
      : await supabase.rpc(name)
    if (error) {
      const message = isNetworkError(error)
        ? options.catchFallback
        : failureMessage(error, options.errorFallback)
      return { ok: false, message }
    }
    return { ok: true, data: data as T }
  } catch (error) {
    if (isNetworkError(error)) {
      return { ok: false, message: options.catchFallback }
    }
    return { ok: false, message: options.catchFallback }
  }
}
