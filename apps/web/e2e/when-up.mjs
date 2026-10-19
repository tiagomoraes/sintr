// Wait until the first e2e server answers at all, which means the build it
// shares with the second one is done, then exit so the next command can
// start. Any HTTP answer counts: Playwright starts the servers before its
// global setup creates the test database, so a health check would answer 503
// until then. Gives up after five minutes.
const address = process.argv[2];
const until = Date.now() + 300_000;
for (;;) {
  try {
    await fetch(address);
    process.exit(0);
  } catch {
    // Not listening yet.
  }
  if (Date.now() > until) process.exit(1);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
