/**
 * The pool of light's travel between the places it rests (the middle of the
 * home, beside the box once a conversation begins, the corner of every
 * other page, the open conversation beside a page), as plain geometry with
 * no browser in it. The pool travels as one square, moved and scaled about
 * its centre: transform only, so the compositor carries it.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The transform that lays a square of `size`, scaled about its centre, over `box`. */
export function placement(box: Box, size: number): { x: number; y: number; scale: number } {
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  return { x: centreX - size / 2, y: centreY - size / 2, scale: size > 0 ? box.width / size : 1 };
}

/** The shortest and longest a travel takes: calm, never sluggish. */
export const TRAVEL_MS = { min: 900, max: 1500 } as const;

/**
 * How long a travel takes: a little longer for a longer way, as something
 * carried across a room would be, within `TRAVEL_MS`. `diagonal` is the
 * viewport's, so a phone and a wide screen feel the same.
 */
export function travelTime(from: Box, to: Box, diagonal: number): number {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const share = diagonal > 0 ? Math.min(1, Math.hypot(dx, dy) / diagonal) : 1;
  return Math.round(TRAVEL_MS.min + (TRAVEL_MS.max - TRAVEL_MS.min) * share);
}

/** Whether any of a box is in view: a pool scrolled out of sight does not fly in from nowhere. */
export function inView(box: Box, viewport: { width: number; height: number }): boolean {
  return (
    box.width > 0 &&
    box.x + box.width > 0 &&
    box.y + box.height > 0 &&
    box.x < viewport.width &&
    box.y < viewport.height
  );
}

/** Whether a box ended where it was expected, within a pixel or two of layout rounding. */
export function sameBox(a: Box, b: Box, tolerance = 2): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}
