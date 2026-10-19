/** Only same-site paths are followed after signing in; anything else lands on the home. */
export function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/home";
  // Browsers drop tabs and line breaks from an address, so "/\t/evil.example" would become "//evil.example".
  if ([...next].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return "/home";
  return next;
}
