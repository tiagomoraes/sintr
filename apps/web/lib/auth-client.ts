"use client";

import { createAuthClient } from "better-auth/react";

/** Talks to /api/auth on the same origin; no third party is involved. */
export const authClient = createAuthClient({ basePath: "/api/auth" });
