/** Paddle webhook source IPs — fetched from Paddle /ips (do not hard-code). */

export type PaddleWebhookEnvironment = "production" | "sandbox"

export interface PaddleWebhookIpOptions {
  environment?: string | null
  fetchImpl?: typeof fetch
}

const PADDLE_IPS_URLS: Record<PaddleWebhookEnvironment, string> = {
  production: "https://api.paddle.com/ips",
  sandbox: "https://sandbox-api.paddle.com/ips",
}
const CACHE_TTL_MS = 60 * 60 * 1000

const cidrCache = new Map<
  PaddleWebhookEnvironment,
  { cidrs: string[]; cachedAt: number }
>()

function readPaddleEnvFromRuntime(): string | undefined {
  const deno = (
    globalThis as {
      Deno?: { env?: { get?: (name: string) => string | undefined } }
    }
  ).Deno
  if (typeof deno?.env?.get === "function") {
    return deno.env.get("PADDLE_ENV")
  }
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process
  return proc?.env?.PADDLE_ENV
}

export function resolvePaddleWebhookEnvironment(
  environment?: string | null
): PaddleWebhookEnvironment {
  const raw =
    environment !== undefined
      ? environment?.trim()
      : readPaddleEnvFromRuntime()?.trim()
  return raw === "sandbox" ? "sandbox" : "production"
}

export function getPaddleIpsUrl(environment?: string | null): string {
  return PADDLE_IPS_URLS[resolvePaddleWebhookEnvironment(environment)]
}

export function clearPaddleWebhookIpCache(): void {
  cidrCache.clear()
}

function normalizeOptions(
  optionsOrFetch?: typeof fetch | PaddleWebhookIpOptions
): { environment: PaddleWebhookEnvironment; fetchImpl: typeof fetch } {
  if (typeof optionsOrFetch === "function") {
    return {
      environment: resolvePaddleWebhookEnvironment(),
      fetchImpl: optionsOrFetch,
    }
  }
  return {
    environment: resolvePaddleWebhookEnvironment(optionsOrFetch?.environment),
    fetchImpl: optionsOrFetch?.fetchImpl ?? fetch,
  }
}

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".")
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    value = ((value << 8) | octet) >>> 0
  }
  return value
}

export function ipv4MatchesCidr(ip: string, cidr: string): boolean {
  const [network, bitsText] = cidr.split("/")
  const bits = Number(bitsText)
  if (!network || !Number.isInteger(bits) || bits < 0 || bits > 32) return false

  const ipInt = ipv4ToInt(ip)
  const networkInt = ipv4ToInt(network)
  if (ipInt === null || networkInt === null) return false

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipInt & mask) === (networkInt & mask)
}

export function ipv4MatchesAnyCidr(ip: string, cidrs: string[]): boolean {
  return cidrs.some((cidr) => ipv4MatchesCidr(ip, cidr))
}

export async function fetchPaddleWebhookIpv4Cidrs(
  optionsOrFetch?: typeof fetch | PaddleWebhookIpOptions
): Promise<string[]> {
  const { environment, fetchImpl } = normalizeOptions(optionsOrFetch)
  const response = await fetchImpl(getPaddleIpsUrl(environment), {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Paddle /ips failed (${response.status})`)
  }

  const body = (await response.json()) as {
    data?: { ipv4_cidrs?: string[] }
  }
  const cidrs = body.data?.ipv4_cidrs?.filter(Boolean) ?? []
  if (cidrs.length === 0) {
    throw new Error("Paddle /ips returned no ipv4_cidrs")
  }
  return cidrs
}

export async function getPaddleWebhookIpv4Cidrs(
  optionsOrFetch?: typeof fetch | PaddleWebhookIpOptions
): Promise<string[]> {
  const { environment, fetchImpl } = normalizeOptions(optionsOrFetch)
  const now = Date.now()
  const cached = cidrCache.get(environment)
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.cidrs
  }

  const cidrs = await fetchPaddleWebhookIpv4Cidrs({ environment, fetchImpl })
  cidrCache.set(environment, { cidrs, cachedAt: Date.now() })
  return cidrs
}

/** Best-effort client IP for Supabase Edge (behind proxies). */
export function clientIpFromRequest(request: Request): string | null {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cfIp) return cfIp
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const forwardedHeader = request.headers.get("x-forwarded-for")
  if (!forwardedHeader) return null
  const hops = forwardedHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  return hops.at(-1) ?? null
}

export async function isPaddleWebhookRequestIpAllowed(
  request: Request,
  optionsOrFetch?: typeof fetch | PaddleWebhookIpOptions
): Promise<{ allowed: boolean; ip: string | null; cidrs: string[] }> {
  const ip = clientIpFromRequest(request)
  if (!ip) {
    return { allowed: false, ip: null, cidrs: [] }
  }

  const cidrs = await getPaddleWebhookIpv4Cidrs(optionsOrFetch)
  return {
    allowed: ipv4MatchesAnyCidr(ip, cidrs),
    ip,
    cidrs,
  }
}
