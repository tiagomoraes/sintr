// Bundle the stdio bridge into one self-contained script, dist/sintr-mcp.mjs,
// and place a copy where the web app serves it (/sintr-mcp.mjs), so a person
// can download it from their own sintr. Not minified: whoever runs it can read it.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Paths from this file, so the web app's build can run it from its own folder.
const here = (path) => fileURLToPath(new URL(path, import.meta.url));

await build({
  entryPoints: { "sintr-mcp": here("src/bin.ts") },
  outdir: here("dist"),
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  sourcemap: false,
  legalComments: "none",
  banner: {
    js: [
      "#!/usr/bin/env node",
      "// sintr MCP stdio bridge. Forwards MCP messages between a local client and your sintr.",
      "// Set SINTR_URL and SINTR_TOKEN. Source: packages/mcp/src/stdio.ts. AGPL-3.0.",
      "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "warning",
});

mkdirSync(here("../../apps/web/public"), { recursive: true });
copyFileSync(here("dist/sintr-mcp.mjs"), here("../../apps/web/public/sintr-mcp.mjs"));
