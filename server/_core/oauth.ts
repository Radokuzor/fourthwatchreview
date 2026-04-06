import type { Express } from "express";

/**
 * Google OAuth for GBP lives in `gbp.ts`. End-user auth is Clerk (`@clerk/express` + `ClerkProvider`).
 */
export function registerOAuthRoutes(_app: Express) {
  // Intentionally empty.
}
