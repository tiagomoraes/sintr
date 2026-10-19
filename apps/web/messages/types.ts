import type { catalog } from "./en";

/** Every sentence of a shape as a string, keeping its structure and the values it takes. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : { readonly [K in keyof T]: Widen<T[K]> };

/**
 * The app's words: the English catalog's shape, which every language gives
 * in its own words. One entry per screen or feature (DECISIONS 94).
 */
export type Messages = Widen<typeof catalog>;

/**
 * A language's catalog: each screen or feature whole, or left out and read
 * in English until it is translated (DECISIONS 98). Never half a screen, and
 * never a key in place of a sentence. The shipped languages are whole, and a
 * test says what any other is missing.
 */
export type Catalog = { readonly [F in keyof Messages]?: Messages[F] };
