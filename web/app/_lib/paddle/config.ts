import type { Environments } from "@paddle/paddle-js";

export type PaddlePublicEnvironment = "sandbox" | "production";

export interface PaddlePublicConfig {
  clientToken: string;
  environment: PaddlePublicEnvironment;
  basePath: string;
}

/**
 * NEXT_PUBLIC_* must be read as static property access so Next can inline them
 * into the client bundle. Dynamic process.env[name] is always undefined in the
 * browser.
 */
function readClientToken(): string {
  const value = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
  if (!value) {
    throw new Error(
      "Missing required Paddle env var NEXT_PUBLIC_PADDLE_CLIENT_TOKEN. Set it in web/.env.local before building or running the pricing page."
    );
  }
  return value;
}

function readEnvironment(): PaddlePublicEnvironment {
  const value = process.env.NEXT_PUBLIC_PADDLE_ENV?.trim();
  if (!value) {
    throw new Error(
      "Missing required Paddle env var NEXT_PUBLIC_PADDLE_ENV. Set it in web/.env.local before building or running the pricing page."
    );
  }
  if (value !== "sandbox" && value !== "production") {
    throw new Error(
      `Invalid NEXT_PUBLIC_PADDLE_ENV="${value}". Expected "sandbox" or "production".`
    );
  }
  return value;
}

/** Fail loudly if Paddle public config is incomplete or invalid. */
export function requirePaddlePublicConfig(): PaddlePublicConfig {
  const clientToken = readClientToken();
  const environment = readEnvironment();

  if (environment === "sandbox" && !clientToken.startsWith("test_")) {
    throw new Error(
      "Sandbox builds require NEXT_PUBLIC_PADDLE_CLIENT_TOKEN to start with test_."
    );
  }

  if (environment === "production" && !clientToken.startsWith("live_")) {
    throw new Error(
      "Production builds require NEXT_PUBLIC_PADDLE_CLIENT_TOKEN to start with live_."
    );
  }

  const basePath =
    process.env.NEXT_PUBLIC_BASE_PATH !== undefined
      ? process.env.NEXT_PUBLIC_BASE_PATH.trim()
      : "/SabbathCue";

  return {
    clientToken,
    environment,
    basePath,
  };
}

export function paddleJsEnvironment(
  config: PaddlePublicConfig
): Environments {
  return config.environment as Environments;
}

export function isPaddlePublicConfigAvailable(): boolean {
  try {
    requirePaddlePublicConfig();
    return true;
  } catch {
    return false;
  }
}
