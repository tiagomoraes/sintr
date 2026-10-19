// Bundle the worker, the migration runner and the seats admin path into
// self-contained files for the Docker image: no node_modules are needed at runtime.
import { build } from "esbuild";

await build({
  entryPoints: {
    worker: "src/main.ts",
    migrate: "src/migrate.ts",
    "practice-plan": "../../packages/core/src/practice/plan-cli.ts",
  },
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  legalComments: "none",
  // Some dependencies still call require(); give ESM output a real one.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "warning",
});
