import { defineConfig } from "vitest/config";

// Unit tests only: no database, no network. Every model is the scripted fake.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
