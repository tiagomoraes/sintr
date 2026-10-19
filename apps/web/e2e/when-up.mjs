// Wait until an address answers 200 (the first e2e server, once the build it
// shares is done), then exit so the next command can start. Gives up after
// five minutes.
const address = process.argv[2];
const until = Date.now() + 300_000;
for (;;) {
  try {
    const response = await fetch(address);
    if (response.ok) process.exit(0);
  } catch {
    // Not up yet.
  }
  if (Date.now() > until) process.exit(1);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
