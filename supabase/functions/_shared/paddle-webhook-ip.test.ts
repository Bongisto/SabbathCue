import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearPaddleWebhookIpCache,
  clientIpFromRequest,
  fetchPaddleWebhookIpv4Cidrs,
  getPaddleIpsUrl,
  getPaddleWebhookIpv4Cidrs,
  ipv4MatchesAnyCidr,
  ipv4MatchesCidr,
  ipv4ToInt,
  isPaddleWebhookRequestIpAllowed,
} from "./paddle-webhook-ip"

describe("paddle-webhook-ip", () => {
  beforeEach(() => {
    clearPaddleWebhookIpCache()
  })

  afterEach(() => {
    clearPaddleWebhookIpCache()
    vi.unstubAllEnvs()
  })

  it("matches /32 CIDR entries from Paddle /ips", () => {
    expect(ipv4MatchesCidr("34.237.3.244", "34.237.3.244/32")).toBe(true)
    expect(ipv4MatchesCidr("34.237.3.245", "34.237.3.244/32")).toBe(false)
  })

  it("rejects invalid IPs", () => {
    expect(ipv4ToInt("999.1.1.1")).toBeNull()
    expect(ipv4MatchesCidr("not-an-ip", "34.237.3.244/32")).toBe(false)
  })

  it("allows when any listed CIDR matches", () => {
    const cidrs = ["34.237.3.244/32", "52.11.166.252/32"]
    expect(ipv4MatchesAnyCidr("52.11.166.252", cidrs)).toBe(true)
    expect(ipv4MatchesAnyCidr("10.0.0.1", cidrs)).toBe(false)
  })

  it("selects sandbox or production /ips URL from PADDLE_ENV", () => {
    expect(getPaddleIpsUrl("sandbox")).toBe("https://sandbox-api.paddle.com/ips")
    expect(getPaddleIpsUrl("production")).toBe("https://api.paddle.com/ips")

    vi.stubEnv("PADDLE_ENV", "sandbox")
    expect(getPaddleIpsUrl()).toBe("https://sandbox-api.paddle.com/ips")

    vi.stubEnv("PADDLE_ENV", "production")
    expect(getPaddleIpsUrl()).toBe("https://api.paddle.com/ips")
  })

  it("keys the allowlist cache independently per environment", async () => {
    const requestedUrls: string[] = []
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input)
      requestedUrls.push(url)
      const cidrs = url.startsWith("https://sandbox-api.paddle.com/")
        ? ["34.194.127.46/32"]
        : ["34.237.3.244/32"]
      return new Response(JSON.stringify({ data: { ipv4_cidrs: cidrs } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const sandboxFirst = await getPaddleWebhookIpv4Cidrs({
      environment: "sandbox",
      fetchImpl: mockFetch,
    })
    const prodFirst = await getPaddleWebhookIpv4Cidrs({
      environment: "production",
      fetchImpl: mockFetch,
    })
    const sandboxCached = await getPaddleWebhookIpv4Cidrs({
      environment: "sandbox",
      fetchImpl: mockFetch,
    })
    const prodCached = await getPaddleWebhookIpv4Cidrs({
      environment: "production",
      fetchImpl: mockFetch,
    })

    expect(sandboxFirst).toEqual(["34.194.127.46/32"])
    expect(prodFirst).toEqual(["34.237.3.244/32"])
    expect(sandboxCached).toEqual(sandboxFirst)
    expect(prodCached).toEqual(prodFirst)
    expect(requestedUrls).toEqual([
      "https://sandbox-api.paddle.com/ips",
      "https://api.paddle.com/ips",
    ])
  })

  it("validates sandbox and production webhook request IPs against the matching endpoint", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input)
      const cidrs = url.startsWith("https://sandbox-api.paddle.com/")
        ? ["34.194.127.46/32"]
        : ["34.237.3.244/32"]
      return new Response(JSON.stringify({ data: { ipv4_cidrs: cidrs } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const sandboxReq = new Request("https://example.test/paddle-webhook", {
      method: "POST",
      headers: { "x-forwarded-for": "34.194.127.46" },
    })

    const allowedInSandbox = await isPaddleWebhookRequestIpAllowed(sandboxReq, {
      environment: "sandbox",
      fetchImpl: mockFetch,
    })
    const deniedInProd = await isPaddleWebhookRequestIpAllowed(sandboxReq, {
      environment: "production",
      fetchImpl: mockFetch,
    })

    expect(allowedInSandbox.allowed).toBe(true)
    expect(deniedInProd.allowed).toBe(false)

    vi.stubEnv("PADDLE_ENV", "sandbox")
    const fetchedViaEnv = await fetchPaddleWebhookIpv4Cidrs(mockFetch)
    expect(fetchedViaEnv).toEqual(["34.194.127.46/32"])
  })

  it("prefers cf-connecting-ip and x-real-ip over spoofable x-forwarded-for", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ data: { ipv4_cidrs: ["34.237.3.244/32"] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })

    const spoofedWithCf = new Request("https://example.test/paddle-webhook", {
      method: "POST",
      headers: {
        "x-forwarded-for": "34.237.3.244, 198.51.100.99",
        "x-real-ip": "34.237.3.244",
        "cf-connecting-ip": "198.51.100.99",
      },
    })
    expect(clientIpFromRequest(spoofedWithCf)).toBe("198.51.100.99")
    const cfResult = await isPaddleWebhookRequestIpAllowed(spoofedWithCf, {
      environment: "production",
      fetchImpl: mockFetch,
    })
    expect(cfResult.allowed).toBe(false)
    expect(cfResult.ip).toBe("198.51.100.99")

    const spoofedWithRealIp = new Request("https://example.test/paddle-webhook", {
      method: "POST",
      headers: {
        "x-forwarded-for": "34.237.3.244",
        "x-real-ip": "203.0.113.10",
      },
    })
    expect(clientIpFromRequest(spoofedWithRealIp)).toBe("203.0.113.10")
  })

  it("uses the rightmost hop when falling back to x-forwarded-for", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ data: { ipv4_cidrs: ["34.237.3.244/32"] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })

    const spoofedLeftmost = new Request("https://example.test/paddle-webhook", {
      method: "POST",
      headers: {
        "x-forwarded-for": "34.237.3.244, 198.51.100.99, ",
      },
    })
    expect(clientIpFromRequest(spoofedLeftmost)).toBe("198.51.100.99")
    const result = await isPaddleWebhookRequestIpAllowed(spoofedLeftmost, {
      environment: "production",
      fetchImpl: mockFetch,
    })
    expect(result.allowed).toBe(false)
    expect(result.ip).toBe("198.51.100.99")

    const missingIp = new Request("https://example.test/paddle-webhook", {
      method: "POST",
    })
    expect(clientIpFromRequest(missingIp)).toBeNull()
  })
})
