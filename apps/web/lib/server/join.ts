import "server-only";
import { RateLimiter } from "@sintr/mcp";
import { headers } from "next/headers";

const holder = globalThis as typeof globalThis & { __sintrJoinLimit?: RateLimiter };

/** Invite codes looked up per address: 30 every 10 minutes, in memory, per process. */
const LOOKUPS = 30;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Count one look at an invite from this address; true when it is over the
 * limit. Codes are 60 bits and expire in a week, so guessing is already
 * hopeless; this keeps anyone from trying at volume.
 */
export async function tooManyLookups(): Promise<boolean> {
  holder.__sintrJoinLimit ??= new RateLimiter(LOOKUPS, WINDOW_MS);
  const h = await headers();
  const address = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "direct";
  return holder.__sintrJoinLimit.hit(address) > 0;
}
