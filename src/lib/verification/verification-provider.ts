import packageJson from "../../../package.json"
import {
  restoreSession,
  signInWithEmail,
  signOut as supabaseSignOut,
  signUpWithEmail,
} from "@/lib/supabase/auth"
import { getSupabaseClient } from "@/lib/supabase/client"
import {
  registerDevice,
  type RegisterDeviceResult,
} from "@/lib/supabase/devices"
import { getOrCreateInstallationIdentity } from "@/lib/verification/device-id"
import { verifyActivationLease } from "@/lib/verification/activation-lease"
import type { SignedActivationLease } from "@/lib/verification/activation-lease"
import {
  clearSessionMetadata,
  clearToken,
  getRefreshToken,
  getSessionMetadata,
  setSessionMetadata,
} from "@/lib/verification/session-storage"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import type {
  VerificationErrorCode,
  VerificationSession,
  VerificationStateSnapshot,
} from "@/types/verification"
import type { SignUpProfile } from "@/lib/supabase/auth"

const APP_VERSION = packageJson.version
const ACCESS_ENDED_MESSAGE =
  "Your access has ended. Contact the developer to renew."

/** How long a previously verified session may keep working without connectivity. */
export const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000

/**
 * Refresh the access token this many ms before it expires. The Supabase client
 * runs with autoRefreshToken disabled, so the heartbeat refreshes explicitly;
 * without this the register_device RPC would carry an expired JWT and its 401
 * would be misread as a transient error, silently disabling revocation checks.
 */
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000

function now(): number {
  return Date.now()
}

function getRuntimeOs(): string {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("mac")) return "macos"
  if (ua.includes("linux")) return "linux"
  return "unknown"
}

function isNetworkMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("reach") ||
    lower.includes("connect")
  )
}

function emptySnapshot(
  status: VerificationStateSnapshot["status"],
  error: string | null = null,
  errorCode: VerificationErrorCode | null = null
): VerificationStateSnapshot {
  return {
    status,
    verifiedUserId: null,
    verifiedDeviceId: null,
    accessTokenExpiresAt: null,
    lastVerifiedAt: null,
    offlineGraceExpiresAt: null,
    accessExpiresAt: null,
    error,
    errorCode,
    verifiedEmail: null,
    isChurchOrganization: false,
    churchName: null,
  }
}

function trialExpiredSnapshot(
  userId: string,
  email: string | null | undefined
): VerificationStateSnapshot {
  return {
    ...emptySnapshot("error", ACCESS_ENDED_MESSAGE, "trial_expired"),
    verifiedUserId: userId,
    verifiedEmail: email ?? null,
  }
}

function sessionFromAuth(
  userId: string,
  deviceId: string,
  accessTokenExpiresAt: number,
  email: string | null,
  accessExpiresAt: number | null,
  isChurchOrganization: boolean,
  churchName: string | null,
  activationLease: SignedActivationLease,
  leaseExpiresAt: number
): VerificationSession {
  const timestamp = now()
  return {
    verifiedUserId: userId,
    verifiedDeviceId: deviceId,
    accessTokenExpiresAt,
    lastVerifiedAt: timestamp,
    offlineGraceExpiresAt: leaseExpiresAt,
    accessExpiresAt,
    verifiedEmail: email,
    isChurchOrganization,
    churchName,
    activationLease,
  }
}

function snapshotFromSession(
  session: VerificationSession
): VerificationStateSnapshot {
  return {
    status: "verified",
    verifiedUserId: session.verifiedUserId,
    verifiedDeviceId: session.verifiedDeviceId,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    lastVerifiedAt: session.lastVerifiedAt,
    offlineGraceExpiresAt: session.offlineGraceExpiresAt,
    accessExpiresAt: session.accessExpiresAt,
    error: null,
    errorCode: null,
    verifiedEmail: session.verifiedEmail ?? null,
    isChurchOrganization: session.isChurchOrganization,
    churchName: session.churchName,
  }
}

async function completeVerification(
  userId: string,
  accessTokenExpiresAt: number,
  email: string | null
): Promise<VerificationStateSnapshot> {
  const identity = await getOrCreateInstallationIdentity()
  const deviceId = identity.deviceId
  const registration = await registerDevice(
    userId,
    deviceId,
    getRuntimeOs(),
    APP_VERSION,
    identity.publicKey
  )

  if (!registration.ok) {
    if (registration.code === "device_limit_reached") {
      return emptySnapshot(
        "error",
        "This account is already registered on the maximum number of devices (2). Remove a device or contact support.",
        "device_limit_reached"
      )
    }

    if (registration.code === "device_pending") {
      return emptySnapshot(
        "error",
        "This computer is waiting for activation approval.",
        "device_pending"
      )
    }

    if (registration.code === "device_revoked") {
      return emptySnapshot(
        "error",
        "This computer has been deactivated.",
        "device_revoked"
      )
    }

    if (registration.code === "device_identity_mismatch") {
      return emptySnapshot(
        "error",
        "This computer could not prove its saved activation identity.",
        "device_revoked"
      )
    }

    if (registration.code === "suspended") {
      return emptySnapshot(
        "error",
        "This account has been suspended. Contact support for assistance.",
        "suspended"
      )
    }

    if (registration.code === "trial_expired") {
      return trialExpiredSnapshot(userId, email)
    }

    const message = registration.message ?? "Device registration failed."
    return emptySnapshot(
      "error",
      message,
      isNetworkMessage(message) ? "network" : "unknown"
    )
  }

  const lease = await verifyActivationLease(
    registration.lease,
    userId,
    deviceId,
    now()
  )
  if (!lease) {
    return emptySnapshot(
      "error",
      "The activation service returned an invalid offline lease.",
      "unknown"
    )
  }

  const session = sessionFromAuth(
    userId,
    deviceId,
    accessTokenExpiresAt,
    email,
    registration.accessExpiresAt,
    registration.isChurchOrganization,
    registration.churchName,
    registration.lease,
    lease.expiresAt
  )
  await setSessionMetadata(session)
  return snapshotFromSession(session)
}

/**
 * Offline fallback requires an unexpired server-signed activation lease bound
 * to this installation's local hardware/keychain identity.
 */
async function offlineGraceSnapshot(
  expectedUserId?: string
): Promise<VerificationStateSnapshot | null> {
  const session = await getSessionMetadata()
  if (!session) return null

  if (expectedUserId && session.verifiedUserId !== expectedUserId) {
    return null
  }

  if (!session.activationLease) return null
  const identity = await getOrCreateInstallationIdentity().catch(() => null)
  if (!identity) return null
  const lease = await verifyActivationLease(
    session.activationLease,
    expectedUserId ?? session.verifiedUserId,
    identity.deviceId,
    now()
  )
  if (!lease) return null

  return snapshotFromSession({
    ...session,
    verifiedDeviceId: identity.deviceId,
  })
}

export async function loadCachedVerification(): Promise<VerificationStateSnapshot> {
  if (!isTauriRuntime()) return emptySnapshot("required")

  const refreshToken = await getRefreshToken()
  if (!refreshToken) return emptySnapshot("required")

  const restored = await restoreSession()
  if (!restored.ok) {
    if (restored.code === "expired") {
      await Promise.allSettled([clearToken(), clearSessionMetadata()])
      return emptySnapshot("required")
    }
    if (restored.code === "network") {
      const grace = await offlineGraceSnapshot()
      return grace ?? emptySnapshot("error", restored.message, "network")
    }
    return emptySnapshot("error", restored.message, "unknown")
  }

  const snapshot = await completeVerification(
    restored.userId,
    restored.accessTokenExpiresAt,
    restored.email
  )
  if (snapshot.status === "error" && snapshot.errorCode === "network") {
    const grace = await offlineGraceSnapshot(restored.userId)
    return grace ?? snapshot
  }
  return snapshot
}

export async function signIn(
  email: string,
  password: string
): Promise<VerificationStateSnapshot> {
  const result = await signInWithEmail(email, password)
  if (!result.ok) {
    return emptySnapshot("error", result.message, result.code)
  }

  return completeVerification(
    result.userId,
    result.accessTokenExpiresAt,
    result.email ?? (email.trim() || null)
  )
}

export async function signUp(
  email: string,
  password: string,
  profile: SignUpProfile
): Promise<VerificationStateSnapshot> {
  const result = await signUpWithEmail(email, password, profile)
  if (!result.ok) {
    return emptySnapshot("error", result.message, result.code)
  }

  if (result.needsEmailConfirmation) {
    return emptySnapshot(
      "required",
      "Account created. Check your email to confirm your address, then sign in."
    )
  }

  return completeVerification(
    result.userId,
    result.accessTokenExpiresAt,
    result.email ?? (email.trim() || null)
  )
}

export async function signOut(): Promise<VerificationStateSnapshot> {
  try {
    await supabaseSignOut()
  } finally {
    try {
      await clearSessionMetadata()
    } catch (error) {
      console.warn("[verification] clear session metadata failed", error)
    }
  }
  return emptySnapshot("required")
}

export async function refreshVerification(): Promise<VerificationStateSnapshot> {
  return loadCachedVerification()
}

export async function clearVerification(): Promise<VerificationStateSnapshot> {
  return signOut()
}

async function heartbeatBlockFor(
  registration: Exclude<RegisterDeviceResult, { ok: true }>,
  cached?: Pick<VerificationSession, "verifiedUserId" | "verifiedEmail">
): Promise<VerificationStateSnapshot | null> {
  const details =
    registration.code === "suspended"
      ? [
          "This account has been suspended. Contact support for assistance.",
          "suspended",
        ] as const
      : registration.code === "trial_expired"
        ? [ACCESS_ENDED_MESSAGE, "trial_expired"] as const
        : registration.code === "device_limit_reached"
          ? [
              "This account is already registered on the maximum number of devices (2). Remove a device or contact support.",
              "device_limit_reached",
            ] as const
          : registration.code === "device_pending"
            ? [
                "This computer is waiting for activation approval.",
                "device_pending",
              ] as const
            : registration.code === "device_revoked"
              ? ["This computer has been deactivated.", "device_revoked"] as const
              : registration.code === "device_identity_mismatch"
                ? [
                    "This computer could not prove its saved activation identity.",
                    "device_revoked",
                  ] as const
                : null
  if (!details) return null
  await clearSessionMetadata()
  if (registration.code === "trial_expired" && cached) {
    return trialExpiredSnapshot(cached.verifiedUserId, cached.verifiedEmail)
  }
  return emptySnapshot("error", details[0], details[1])
}

async function hasInMemoryAccessToken(): Promise<boolean> {
  try {
    const { data, error } = await getSupabaseClient().auth.getSession()
    if (error) return false
    return Boolean(data.session?.access_token)
  } catch {
    return false
  }
}

function offlineHeartbeatExpirySnapshot(
  cached: VerificationSession
): VerificationStateSnapshot | null {
  const timestamp = now()
  if (cached.accessExpiresAt !== null && cached.accessExpiresAt <= timestamp) {
    return trialExpiredSnapshot(cached.verifiedUserId, cached.verifiedEmail)
  }
  if (cached.offlineGraceExpiresAt <= timestamp) {
    return emptySnapshot(
      "error",
      "Unable to verify your session offline. Connect to the internet and try again.",
      "network"
    )
  }
  return null
}

async function getMatchingSessionMetadata(
  expectedUserId: string
): Promise<VerificationSession | null> {
  const session = await getSessionMetadata()
  if (!session || session.verifiedUserId !== expectedUserId) {
    return null
  }
  return session
}

/**
 * Periodic re-registration while the app is running. Returns a blocking
 * snapshot when access was revoked mid-session or offline access/grace
 * expires; null means no state change while still within an active offline
 * grace window.
 */
export async function heartbeatDeviceRegistration(): Promise<VerificationStateSnapshot | null> {
  if (!isTauriRuntime()) return null

  const cached = await getSessionMetadata()
  if (!cached) return emptySnapshot("required")
  const needsSessionRefresh =
    now() > cached.accessTokenExpiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS ||
    !(await hasInMemoryAccessToken())
  if (needsSessionRefresh) {
    const restored = await restoreSession()
    if (!restored.ok) {
      if (restored.code === "network") {
        return offlineHeartbeatExpirySnapshot(cached)
      }
      const latest = await getSessionMetadata()
      if (latest && latest.verifiedUserId !== cached.verifiedUserId) {
        return null
      }
      await Promise.allSettled([clearToken(), clearSessionMetadata()])
      return emptySnapshot("required")
    }
    if (restored.userId !== cached.verifiedUserId) {
      return null
    }
    const latest = await getMatchingSessionMetadata(cached.verifiedUserId)
    if (!latest) return null
    await setSessionMetadata({
      ...latest,
      accessTokenExpiresAt: restored.accessTokenExpiresAt,
    })
  }

  const identity = await getOrCreateInstallationIdentity()
  const deviceId = identity.deviceId
  const registration = await registerDevice(
    cached.verifiedUserId,
    deviceId,
    getRuntimeOs(),
    APP_VERSION,
    identity.publicKey
  )

  if (!registration.ok) {
    if (!(await getMatchingSessionMetadata(cached.verifiedUserId))) {
      return null
    }
    const blockingSnapshot = await heartbeatBlockFor(registration, cached)
    if (blockingSnapshot) return blockingSnapshot
    return offlineHeartbeatExpirySnapshot(cached)
  }

  if (registration.ok) {
    const lease = await verifyActivationLease(
      registration.lease,
      cached.verifiedUserId,
      deviceId,
      now()
    )
    if (!lease) {
      if (await getMatchingSessionMetadata(cached.verifiedUserId)) {
        await clearSessionMetadata()
      }
      return emptySnapshot(
        "error",
        "The activation service returned an invalid offline lease.",
        "unknown"
      )
    }
    const session = await getMatchingSessionMetadata(cached.verifiedUserId)
    if (session) {
      const timestamp = now()
      await setSessionMetadata({
        ...session,
        accessExpiresAt: registration.accessExpiresAt,
        isChurchOrganization: registration.isChurchOrganization,
        churchName: registration.churchName,
        lastVerifiedAt: timestamp,
        offlineGraceExpiresAt: lease.expiresAt,
        activationLease: registration.lease,
      })
    }
  }

  return null
}
