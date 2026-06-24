import { getSupabaseClient } from "@/lib/supabase/client"
import { isNetworkError } from "@/lib/supabase/errors"

export type RegisterDeviceResult =
  | { ok: true; accessExpiresAt: number | null }
  | { ok: false; code: "device_limit_reached" }
  | { ok: false; code: "suspended" }
  | { ok: false; code: "trial_expired" }
  | { ok: false; code: "error"; message: string }

function parseRegisterDeviceStatus(data: unknown): RegisterDeviceResult {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      code: "error",
      message: "Unexpected device registration response.",
    }
  }

  const status = (data as { status?: unknown }).status
  if (status === "ok") {
    const rawExpiry = (data as { access_expires_at?: unknown })
      .access_expires_at
    const accessExpiresAt =
      typeof rawExpiry === "string" ? Date.parse(rawExpiry) : null
    return {
      ok: true,
      accessExpiresAt: Number.isFinite(accessExpiresAt)
        ? accessExpiresAt
        : null,
    }
  }
  if (status === "device_limit_reached")
    return { ok: false, code: "device_limit_reached" }
  if (status === "suspended") return { ok: false, code: "suspended" }
  if (status === "trial_expired") return { ok: false, code: "trial_expired" }

  return {
    ok: false,
    code: "error",
    message: "Unexpected device registration response.",
  }
}

export async function registerDevice(
  deviceId: string,
  os: string,
  appVersion: string,
  label?: string
): Promise<RegisterDeviceResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc("register_device", {
      p_device_id: deviceId,
      p_os: os,
      p_app_version: appVersion,
      p_label: label ?? null,
    })

    if (error) {
      if (isNetworkError(error)) {
        return {
          ok: false,
          code: "error",
          message: "Unable to reach the device registration service.",
        }
      }
      return {
        ok: false,
        code: "error",
        message: error.message || "Device registration failed.",
      }
    }

    return parseRegisterDeviceStatus(data)
  } catch (error) {
    if (isNetworkError(error)) {
      return {
        ok: false,
        code: "error",
        message: "Unable to reach the device registration service.",
      }
    }
    return { ok: false, code: "error", message: "Device registration failed." }
  }
}
