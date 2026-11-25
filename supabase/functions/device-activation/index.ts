import { withSupabase } from "npm:@supabase/server"

const encoder = new TextEncoder()
const MAX_CHALLENGE_AGE_MS = 5 * 60 * 1000
const DEFAULT_OFFLINE_LEASE_HOURS = 72
const ALLOWED_CORS_ORIGINS = new Set([
  "https://sabbath-cue-two.vercel.app",
  "https://bongisto.github.io",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
])
const LOCAL_DEV_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/
const CORS_ALLOW_HEADERS = "authorization, apikey, content-type, x-client-info"
const CORS_ALLOW_METHODS = "POST, OPTIONS"

function extraAllowedOrigins(): string[] {
  const raw =
    typeof Deno !== "undefined" ? (Deno.env.get("ALLOWED_CORS_ORIGINS") ?? "") : ""
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*")
}

function isAllowedCorsOrigin(origin: string): boolean {
  return (
    ALLOWED_CORS_ORIGINS.has(origin) ||
    LOCAL_DEV_ORIGIN_RE.test(origin) ||
    extraAllowedOrigins().includes(origin)
  )
}

function corsHeadersForRequest(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    Vary: "Origin",
  }
  const origin = request.headers.get("origin")?.trim()
  if (origin && isAllowedCorsOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
  }
  return headers
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  headers.delete("Access-Control-Allow-Origin")
  for (const [key, value] of Object.entries(corsHeadersForRequest(request))) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function preflightResponse(request: Request): Response {
  const headers = corsHeadersForRequest(request)
  if (
    request.headers.get("origin") !== null &&
    !headers["Access-Control-Allow-Origin"]
  ) {
    return new Response("Forbidden", { status: 403, headers })
  }
  return new Response("ok", { headers })
}

interface ActivationRequest {
  action: "register" | "approve"
  userId: string
  deviceId: string
  publicKey: string
  challengeTimestamp: number
  signature: string
  os: string
  appVersion: string
  label?: string | null
  targetDeviceId?: string | null
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = ""
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function activationChallenge(body: ActivationRequest): string {
  return [
    body.action,
    body.userId,
    body.deviceId,
    body.targetDeviceId ?? "",
    body.challengeTimestamp,
    body.appVersion,
  ].join("|")
}

async function verifyInstallationProof(body: ActivationRequest): Promise<boolean> {
  if (
    typeof body.challengeTimestamp !== "number" ||
    !Number.isFinite(body.challengeTimestamp) ||
    Math.abs(Date.now() - body.challengeTimestamp) > MAX_CHALLENGE_AGE_MS
  ) {
    return false
  }
  const key = await crypto.subtle.importKey(
    "spki",
    decodeBase64(body.publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  )
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    decodeBase64(body.signature),
    encoder.encode(activationChallenge(body))
  )
}

async function signLease(payload: string): Promise<string> {
  const encodedPrivateKey = Deno.env.get("ACTIVATION_LEASE_PRIVATE_KEY")
  if (!encodedPrivateKey) throw new Error("ACTIVATION_LEASE_PRIVATE_KEY is not configured")
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64(encodedPrivateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(payload)
  )
  return encodeBase64Url(new Uint8Array(signature))
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

type RpcError = { message: string } | null
type RpcCaller = (
  name: string,
  args: Record<string, unknown>
) => Promise<{ data: Record<string, unknown> | null; error: RpcError }>

async function readActivationRequest(request: Request): Promise<ActivationRequest | Response> {
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ message: "Invalid activation request." }, 400)
    }
    return parsed as ActivationRequest
  } catch {
    return json({ message: "Invalid activation request." }, 400)
  }
}

async function proofError(
  body: ActivationRequest,
  authenticatedUserId: string
): Promise<Response | null> {
  if (!authenticatedUserId || body.userId !== authenticatedUserId) {
    return json({ message: "Activation user does not match the signed-in account." }, 403)
  }
  if (!body.deviceId || !body.publicKey || !body.signature || !body.appVersion) {
    return json({ message: "Activation proof is incomplete." }, 400)
  }
  try {
    return (await verifyInstallationProof(body))
      ? null
      : json({ message: "Activation proof was rejected." }, 403)
  } catch {
    return json({ message: "Activation proof is invalid." }, 400)
  }
}

async function approveDevice(
  body: ActivationRequest,
  authenticatedUserId: string,
  callRpc: RpcCaller
): Promise<Response> {
  if (!body.targetDeviceId) return json({ message: "Target computer is required." }, 400)
  const { error } = await callRpc("approve_device_verified", {
    p_user_id: authenticatedUserId,
    p_approver_device_id: body.deviceId,
    p_approver_public_key: body.publicKey,
    p_target_device_id: body.targetDeviceId,
  })
  return error
    ? json({ message: error.message }, 400)
    : json({ status: "approved" })
}

async function registerDevice(
  body: ActivationRequest,
  authenticatedUserId: string,
  callRpc: RpcCaller
): Promise<Response> {
  const { data: registration, error } = await callRpc("register_device_verified", {
    p_user_id: authenticatedUserId,
    p_device_id: body.deviceId,
    p_os: body.os,
    p_app_version: body.appVersion,
    p_label: body.label ?? null,
    p_public_key: body.publicKey,
  })
  if (error) return json({ message: error.message }, 400)
  if (!registration || registration.status !== "ok") return json({ registration })

  const issuedAt = Date.now()
  const leaseHours = [24, 72, 168].includes(Number(registration.offline_lease_hours))
    ? Number(registration.offline_lease_hours)
    : DEFAULT_OFFLINE_LEASE_HOURS
  const serverAccessExpiry = Date.parse(String(registration.access_expires_at ?? ""))
  const expiresAt = Math.min(
    issuedAt + leaseHours * 60 * 60 * 1000,
    Number.isFinite(serverAccessExpiry) ? serverAccessExpiry : issuedAt
  )
  const leasePayload = encodeBase64Url(
    encoder.encode(
      JSON.stringify({
        version: 1,
        userId: authenticatedUserId,
        deviceId: body.deviceId,
        issuedAt,
        expiresAt,
        accessExpiresAt: Number.isFinite(serverAccessExpiry) ? serverAccessExpiry : null,
      })
    )
  )
  return json({
    registration,
    lease: { payload: leasePayload, signature: await signLease(leasePayload) },
  })
}

const authenticated = withSupabase({ auth: "user" }, async (request, context) => {
  const body = await readActivationRequest(request)
  if (body instanceof Response) return body
  const claims = context.userClaims as Record<string, unknown> | undefined
  const authenticatedUserId = String(claims?.id ?? claims?.sub ?? "")
  const invalidProof = await proofError(body, authenticatedUserId)
  if (invalidProof) return invalidProof
  const callRpc: RpcCaller = async (name, args) => {
    const { data, error } = await context.supabaseAdmin.rpc(name, args)
    return {
      data: data as Record<string, unknown> | null,
      error: error ? { message: error.message } : null,
    }
  }
  return body.action === "approve"
    ? approveDevice(body, authenticatedUserId, callRpc)
    : registerDevice(body, authenticatedUserId, callRpc)
})

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return preflightResponse(request)
    return withCors(request, await authenticated(request))
  },
}
