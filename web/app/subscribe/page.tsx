"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SubscribePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pay/");
  }, [router]);

  return null;
}
