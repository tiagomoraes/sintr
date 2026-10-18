"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => undefined;

/**
 * False while the page is still server HTML, true once React runs. A form
 * that submits through JavaScript keeps its button disabled until then, so
 * an early click never falls back to a plain GET that would put what was
 * typed (an email address) in the URL.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
