import { describe, expect, it } from "vitest"
import {
  ipv4MatchesAnyCidr,
  ipv4MatchesCidr,
  ipv4ToInt,
} from "./paddle-webhook-ip"

describe("paddle-webhook-ip", () => {
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
})
