"use client";

import {
  type Paddle,
  type PricePreviewParams,
  type PricePreviewResponse,
} from "@paddle/paddle-js";
import { useEffect, useState } from "react";
import { formattedTotalsByPriceId } from "./build-price-preview-params";

export type PaddlePrices = Record<string, string>;

function extractTotals(response: PricePreviewResponse): PaddlePrices {
  return formattedTotalsByPriceId(response);
}

export function usePaddlePrices(
  paddle: Paddle | undefined,
  params: PricePreviewParams | null
): { prices: PaddlePrices; loading: boolean; error: string | null } {
  const [prices, setPrices] = useState<PaddlePrices>({});
  const [error, setError] = useState<string | null>(null);
  const [completedParams, setCompletedParams] =
    useState<PricePreviewParams | null>(null);

  useEffect(() => {
    if (!paddle || !params) return;

    let cancelled = false;

    paddle
      .PricePreview(params)
      .then((response) => {
        if (cancelled) return;
        setPrices(extractTotals(response));
        setError(null);
        setCompletedParams(params);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load localized prices.");
        setCompletedParams(params);
      });

    return () => {
      cancelled = true;
    };
  }, [paddle, params]);

  const loading = Boolean(paddle && params && completedParams !== params);
  return {
    prices,
    loading,
    error: completedParams === params ? error : null,
  };
}
