import { create } from "zustand"
import {
  clearVerification,
  heartbeatDeviceRegistration,
  loadCachedVerification,
  refreshVerification,
  signIn as providerSignIn,
  signOut as providerSignOut,
  signUp as providerSignUp,
} from "@/lib/verification/verification-provider"
import type { VerificationStateSnapshot } from "@/types/verification"
import type { SignUpProfile } from "@/lib/supabase/auth"

const HEARTBEAT_MS = 60 * 1000
const STARTUP_VERIFICATION_TIMEOUT_MS = 15 * 1000
const STARTUP_VERIFICATION_TIMEOUT_MESSAGE =
  "Unable to confirm your session. Check your network and try again."

class StartupVerificationTimeoutError extends Error {}

async function withStartupVerificationTimeout(
  check: () => Promise<VerificationStateSnapshot>
): Promise<VerificationStateSnapshot> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new StartupVerificationTimeoutError()),
          STARTUP_VERIFICATION_TIMEOUT_MS
        )
      }),
    ])
  } finally {
    if (timeout !== null) clearTimeout(timeout)
  }
}

function applyVerificationFailure(error: unknown): void {
  const timedOut = error instanceof StartupVerificationTimeoutError
  stopHeartbeat()
  useVerificationStore.setState({
    status: "error",
    error: timedOut ? STARTUP_VERIFICATION_TIMEOUT_MESSAGE : String(error),
    errorCode: timedOut ? "network" : "unknown",
    isHydrated: true,
  })
}

interface VerificationStore extends VerificationStateSnapshot {
  isHydrated: boolean
  hydrate: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    profile: SignUpProfile
  ) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  clear: () => Promise<void>
}

let hydrationPromise: Promise<void> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let focusListenersActive = false
let suspensionCheckPromise: Promise<void> | null = null
let sessionEpoch = 0

function advanceSessionEpoch(): number {
  sessionEpoch += 1
  suspensionCheckPromise = null
  return sessionEpoch
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  stopFocusListeners()
}

function runSuspensionCheck(): Promise<void> {
  if (suspensionCheckPromise) return suspensionCheckPromise
  const epoch = sessionEpoch

  const currentCheck = (async () => {
    const snapshot = await heartbeatDeviceRegistration()
    if (epoch !== sessionEpoch) return
    if (snapshot) applySnapshot(snapshot)
  })()
    .catch(() => {
      // Transient heartbeat failures never kick an active session.
    })
    .finally(() => {
      if (suspensionCheckPromise === currentCheck) {
        suspensionCheckPromise = null
      }
    })

  suspensionCheckPromise = currentCheck
  return currentCheck
}

function handleFocusVerification(): void {
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden"
  ) {
    return
  }
  if (useVerificationStore.getState().status !== "verified") return
  void runSuspensionCheck()
}

function startFocusListeners(): void {
  if (focusListenersActive || typeof window === "undefined") return

  window.addEventListener("focus", handleFocusVerification)
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleFocusVerification)
  }
  focusListenersActive = true
}

function stopFocusListeners(): void {
  if (!focusListenersActive || typeof window === "undefined") return

  window.removeEventListener("focus", handleFocusVerification)
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleFocusVerification)
  }
  focusListenersActive = false
}

function startHeartbeat(): void {
  stopHeartbeat()
  startFocusListeners()
  heartbeatTimer = setInterval(() => {
    void runSuspensionCheck()
  }, HEARTBEAT_MS)
}

function applySnapshot(snapshot: VerificationStateSnapshot): void {
  if (snapshot.status === "verified") {
    startHeartbeat()
  } else {
    stopHeartbeat()
  }

  useVerificationStore.setState({ ...snapshot, isHydrated: true })
}

async function runSignOutTransition(
  action: () => Promise<VerificationStateSnapshot>
): Promise<void> {
  const epoch = advanceSessionEpoch()
  useVerificationStore.setState({
    status: "checking",
    error: null,
    errorCode: null,
  })
  stopHeartbeat()
  try {
    const snapshot = await action()
    if (epoch === sessionEpoch) {
      applySnapshot(snapshot)
    }
  } catch (error) {
    if (epoch !== sessionEpoch) return
    stopHeartbeat()
    useVerificationStore.setState({
      status: "error",
      verifiedUserId: null,
      verifiedDeviceId: null,
      accessTokenExpiresAt: null,
      lastVerifiedAt: null,
      offlineGraceExpiresAt: null,
      accessExpiresAt: null,
      verifiedEmail: null,
      isChurchOrganization: false,
      churchName: null,
      error: String(error),
      errorCode: "unknown",
      isHydrated: true,
    })
  }
}

export const useVerificationStore = create<VerificationStore>(() => ({
  status: "checking",
  verifiedUserId: null,
  verifiedDeviceId: null,
  accessTokenExpiresAt: null,
  lastVerifiedAt: null,
  offlineGraceExpiresAt: null,
  accessExpiresAt: null,
  isChurchOrganization: false,
  churchName: null,
  error: null,
  errorCode: null,
  isHydrated: false,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise
    const epoch = advanceSessionEpoch()
    hydrationPromise = (async () => {
      try {
        const snapshot = await withStartupVerificationTimeout(
          loadCachedVerification
        )
        if (epoch === sessionEpoch) applySnapshot(snapshot)
      } catch (error) {
        if (epoch === sessionEpoch) applyVerificationFailure(error)
      }
    })()
    return hydrationPromise
  },

  signIn: async (email, password) => {
    const epoch = advanceSessionEpoch()
    useVerificationStore.setState({
      status: "checking",
      error: null,
      errorCode: null,
    })
    try {
      const snapshot = await providerSignIn(email, password)
      if (epoch === sessionEpoch) applySnapshot(snapshot)
    } catch (error) {
      if (epoch !== sessionEpoch) return
      stopHeartbeat()
      useVerificationStore.setState({
        status: "error",
        error: String(error),
        errorCode: "unknown",
        isHydrated: true,
      })
    }
  },

  signUp: async (email, password, profile) => {
    const epoch = advanceSessionEpoch()
    useVerificationStore.setState({
      status: "checking",
      error: null,
      errorCode: null,
    })
    try {
      const snapshot = await providerSignUp(email, password, profile)
      if (epoch === sessionEpoch) applySnapshot(snapshot)
    } catch (error) {
      if (epoch !== sessionEpoch) return
      stopHeartbeat()
      useVerificationStore.setState({
        status: "error",
        error: String(error),
        errorCode: "unknown",
        isHydrated: true,
      })
    }
  },

  signOut: () => runSignOutTransition(providerSignOut),

  refresh: async () => {
    const epoch = advanceSessionEpoch()
    useVerificationStore.setState({
      status: "checking",
      error: null,
      errorCode: null,
    })
    try {
      const snapshot = await withStartupVerificationTimeout(refreshVerification)
      if (epoch === sessionEpoch) applySnapshot(snapshot)
    } catch (error) {
      if (epoch === sessionEpoch) applyVerificationFailure(error)
    }
  },

  clear: () => runSignOutTransition(clearVerification),
}))

export function hydrateVerification(): Promise<void> {
  return useVerificationStore.getState().hydrate()
}

export function isAppVerified(): boolean {
  return useVerificationStore.getState().status === "verified"
}

/** Test-only: reset hydration promise and heartbeat between cases. */
export function resetVerificationStoreForTests(): void {
  hydrationPromise = null
  stopHeartbeat()
  suspensionCheckPromise = null
  sessionEpoch = 0
}
