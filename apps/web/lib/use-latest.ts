"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * The latest value a render produced (often a function), for an effect to
 * call without running again each time it changes. React's own
 * `useEffectEvent` is not in the React that Next's App Router bundles.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
