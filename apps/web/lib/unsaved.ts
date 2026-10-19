/**
 * What the guard against leaving with something unsaved decides without a
 * page (DECISIONS 113): which fields of a form changed, and whether a click
 * on a link takes the person off the page.
 */

/** A form's fields as it would send them: each name with its values, in order. */
export type Fields = ReadonlyMap<string, readonly string[]>;

/** Fields by name, from a form's data (`new FormData(form)`) or any pairs. Files are left out. */
export function fieldsOf(entries: Iterable<readonly [string, FormDataEntryValue]>): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  for (const [name, value] of entries) {
    if (typeof value !== "string") continue;
    fields.set(name, [...(fields.get(name) ?? []), value]);
  }
  return fields;
}

/** The names whose values differ between two moments of a form, a field there at only one of them included. */
export function changedFields(before: Fields, now: Fields): string[] {
  const names = new Set([...before.keys(), ...now.keys()]);
  return [...names].filter(
    (name) => JSON.stringify(before.get(name) ?? []) !== JSON.stringify(now.get(name) ?? []),
  );
}

/** A click on a link, as the guard sees it. */
export interface LinkClick {
  /** Where the link leads, resolved (`anchor.href`). */
  href: string;
  target: string;
  download: boolean;
  button: number;
  /** Ctrl, Cmd, Shift or Alt held: another tab, another window, a download. */
  modified: boolean;
}

/**
 * Whether following a link from `here` takes the person off the page. It
 * does not when it opens elsewhere (another tab or window, a download, a
 * call) or stays on this page (the same address, or a place on it).
 */
export function leavesPage(click: LinkClick, here: string): boolean {
  if (click.button !== 0 || click.modified || click.download) return false;
  if (click.target !== "" && click.target !== "_self") return false;
  const to = new URL(click.href, here);
  if (to.protocol !== "http:" && to.protocol !== "https:") return false;
  const from = new URL(here);
  return !(to.origin === from.origin && to.pathname === from.pathname && to.search === from.search);
}
