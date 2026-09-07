// src/features/faction-page/ViewBeacon.tsx
"use client";

import { useEffect } from "react";

export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `faction-view:${slug}`;

    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }

    fetch(`/api/faction/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
