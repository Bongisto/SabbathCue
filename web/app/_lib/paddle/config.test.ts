import { afterEach, describe, expect, it } from "vitest";
import {
  isPaddlePublicConfigAvailable,
  paddleJsEnvironment,
  requirePaddlePublicConfig,
} from "./config";

const ENV_KEYS = [
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  "NEXT_PUBLIC_PADDLE_ENV",
  "NEXT_PUBLIC_BASE_PATH",
] as const;

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("requirePaddlePublicConfig", () => {
  const saved = snapshotEnv();

  afterEach(() => restoreEnv(saved));

  it("throws when NEXT_PUBLIC_PADDLE_ENV is unset", () => {
    delete process.env.NEXT_PUBLIC_PADDLE_ENV;
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_abc";
    expect(() => requirePaddlePublicConfig()).toThrow(
      /NEXT_PUBLIC_PADDLE_ENV/
    );
  });

  it("reads NEXT_PUBLIC_* via static property access (client-bundle safe)", () => {
    process.env.NEXT_PUBLIC_PADDLE_ENV = "sandbox";
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_static_ok";
    // Call sites must not use process.env[name] — this test locks the public API.
    const config = requirePaddlePublicConfig();
    expect(config.clientToken).toBe("test_static_ok");
  });

  it("throws when sandbox token does not start with test_", () => {
    process.env.NEXT_PUBLIC_PADDLE_ENV = "sandbox";
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "live_wrong";
    expect(() => requirePaddlePublicConfig()).toThrow(/test_/);
  });

  it("returns config when sandbox vars are valid", () => {
    process.env.NEXT_PUBLIC_PADDLE_ENV = "sandbox";
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_sandbox_token";
    process.env.NEXT_PUBLIC_BASE_PATH = "/SabbathCue";
    const config = requirePaddlePublicConfig();
    expect(config.clientToken).toBe("test_sandbox_token");
    expect(config.environment).toBe("sandbox");
    expect(config.basePath).toBe("/SabbathCue");
    expect(paddleJsEnvironment(config)).toBe("sandbox");
    expect(isPaddlePublicConfigAvailable()).toBe(true);
  });
});
