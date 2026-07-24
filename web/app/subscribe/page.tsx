"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL — forwards to the Paddle default payment link page. */
export default function SubscribePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pay/");
  }, [router]);

  return null;
}
