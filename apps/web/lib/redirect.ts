/** Only same-site paths are followed after signing in; anything else lands on the home. */
export function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/home";
  return next;
}
