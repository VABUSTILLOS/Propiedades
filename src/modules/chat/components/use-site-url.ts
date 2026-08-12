"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Resolves the canonical site origin used to build absolute share links.
 * - Browser: window.location.origin (handles localhost and custom domains).
 * - Server render: NEXT_PUBLIC_SITE_URL fallback.
 * useSyncExternalStore is the canonical safe way to read browser-only state
 * without hydration mismatches or setState-in-effect warnings.
 */
export function useSiteUrl(): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => process.env.NEXT_PUBLIC_SITE_URL ?? "",
  );
}
