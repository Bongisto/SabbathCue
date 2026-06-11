export type VerificationStatus =
  | "checking"
  | "verified"
  /** Legacy stored-metadata value only — never grants app entry (online-only policy). */
  | "grace"
  | "required"
  | "expired"
  | "error"

export type VerificationErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "device_limit_reached"
  | "suspended"
  | "network"
  | "unknown"

export interface VerificationStateSnapshot {
  status: VerificationStatus
  verifiedUserId: string | null
  verifiedDeviceId: string | null
  accessTokenExpiresAt: number | null
  lastVerifiedAt: number | null
  /** Legacy field for backward-compatible reads; does not gate app entry. */
  offlineGraceExpiresAt: number | null
  error: string | null
  errorCode: VerificationErrorCode | null
  /** Signed-in account email for display; absent in legacy stored metadata. */
  verifiedEmail?: string | null
}

export interface VerificationSession {
  verifiedUserId: string
  verifiedDeviceId: string
  accessTokenExpiresAt: number
  lastVerifiedAt: number
  /** Legacy field retained for stored-metadata compatibility. */
  offlineGraceExpiresAt: number
  /** Signed-in account email for display; absent in legacy stored metadata. */
  verifiedEmail?: string | null
}
