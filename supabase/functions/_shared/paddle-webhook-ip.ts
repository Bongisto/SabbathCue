/** Paddle webhook source IPs — fetched from https://api.paddle.com/ips (do not hard-code). */

const PADDLE_IPS_URL = "https://api.paddle.com/ips"
const CACHE_TTL_MS = 60 * 60 * 1000

let cachedCidrs: string[] | null = null
let cachedAt = 0

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
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const response = await fetchImpl(PADDLE_IPS_URL, {
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
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const now = Date.now()
  if (cachedCidrs && now - cachedAt < CACHE_TTL_MS) {
    return cachedCidrs
  }

  cachedCidrs = await fetchPaddleWebhookIpv4Cidrs(fetchImpl)
  cachedAt = now
  return cachedCidrs
}

/** Best-effort client IP for Supabase Edge (behind proxies). */
export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const cfIp = request.headers.get("cf-connecting-ip")?.trim()
  return cfIp || null
}

export async function isPaddleWebhookRequestIpAllowed(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<{ allowed: boolean; ip: string | null; cidrs: string[] }> {
  const ip = clientIpFromRequest(request)
  if (!ip) {
    return { allowed: false, ip: null, cidrs: [] }
  }

  const cidrs = await getPaddleWebhookIpv4Cidrs(fetchImpl)
  return {
    allowed: ipv4MatchesAnyCidr(ip, cidrs),
    ip,
    cidrs,
  }
}
