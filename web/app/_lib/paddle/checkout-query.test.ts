import { describe, expect, it } from "vitest";
import {
  parsePtxnFromSearchParams,
  PADDLE_TXN_QUERY_PARAM,
} from "./checkout-query";

describe("parsePtxnFromSearchParams", () => {
  it("returns transaction id from _ptxn query param", () => {
    const txn = "txn_01gp3z8cfkqgdq07hcr3ja0q95";
    expect(
      parsePtxnFromSearchParams(`${PADDLE_TXN_QUERY_PARAM}=${txn}`)
    ).toBe(txn);
  });

  it("returns null when _ptxn is missing or invalid", () => {
    expect(parsePtxnFromSearchParams("")).toBeNull();
    expect(parsePtxnFromSearchParams("?_ptxn=not-a-txn")).toBeNull();
    expect(parsePtxnFromSearchParams("?_ptxn=txn_short")).toBeNull();
  });
});
