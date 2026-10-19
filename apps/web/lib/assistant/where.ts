/**
 * Where the assistant is on a page of the diary. The home is its room: the
 * pool of light sits in the middle of the page and the conversation is the
 * page. Every other page of the person's diary carries it in a corner, a
 * tap away. The practice's pages carry neither the assistant nor the help
 * lines: they are the professional's desk, not the person's diary
 * (DECISIONS 68).
 */
export type Presence = "room" | "corner" | "none";

/** The home, and a conversation (which is the home, continued). */
export function isRoom(pathname: string): boolean {
  return pathname === "/home" || pathname === "/talk" || pathname.startsWith("/talk/");
}

export function presenceOn(pathname: string): Presence {
  if (isRoom(pathname)) return "room";
  if (pathname === "/practice" || pathname.startsWith("/practice/")) return "none";
  return "corner";
}
