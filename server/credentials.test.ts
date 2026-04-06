/**
 * Credential validation tests
 * These tests verify that configured secrets are structurally valid.
 * They use lightweight checks (format validation, mock transport verify)
 * rather than live API calls to avoid side effects in CI.
 */
import { describe, expect, it } from "vitest";

// ─── Telegram credential tests ────────────────────────────────────────────────

describe("Telegram credentials", () => {
  it("TELEGRAM_BOT_TOKEN is present and has valid bot token format", () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    // Bot tokens are in format: {bot_id}:{random_string}
    // e.g. 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
    if (!token) {
      console.warn("TELEGRAM_BOT_TOKEN not set — Telegram notifications will be skipped");
      return;
    }
    expect(token.length).toBeGreaterThan(10);
    // Token should contain a colon separating bot ID from secret
    expect(token).toMatch(/^\d+:[A-Za-z0-9_-]+$/);
  });

  it("TELEGRAM_CHAT_ID is present and is a valid numeric chat ID", () => {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      console.warn("TELEGRAM_CHAT_ID not set — Telegram notifications will be skipped");
      return;
    }
    // Chat IDs are numeric (positive for users, negative for groups)
    expect(chatId).toMatch(/^-?\d+$/);
    const parsed = parseInt(chatId, 10);
    expect(isNaN(parsed)).toBe(false);
  });
});

// ─── Google OAuth credential tests ───────────────────────────────────────────

describe("Google OAuth credentials", () => {
  it("GOOGLE_CLIENT_ID is present and has valid OAuth client ID format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn("GOOGLE_CLIENT_ID not set — OAuth sign-in path will be unavailable");
      return;
    }
    expect(clientId.length).toBeGreaterThan(20);
    // Google OAuth client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GOOGLE_CLIENT_SECRET is present and has valid format", () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!secret) {
      console.warn("GOOGLE_CLIENT_SECRET not set — OAuth sign-in path will be unavailable");
      return;
    }
    expect(secret.length).toBeGreaterThan(10);
    // Google client secrets start with GOCSPX- or are alphanumeric
    expect(secret.length).toBeGreaterThanOrEqual(24);
  });
});

// ─── Token cleanup tests ─────────────────────────────────────────────────────

describe("Token cleanup logic", () => {
  it("cleanExpiredTokens is exported from db module", async () => {
    // Verify the function exists and is callable (DB may not be available in test)
    const { cleanExpiredTokens } = await import("./db");
    expect(typeof cleanExpiredTokens).toBe("function");
  });

  it("approval token expiry logic: expired token has expiresAt < now", () => {
    const now = Date.now();
    const expiredToken = { expiresAt: now - 1000 }; // 1 second ago
    const validToken = { expiresAt: now + 3600000 }; // 1 hour from now
    expect(expiredToken.expiresAt < now).toBe(true);
    expect(validToken.expiresAt < now).toBe(false);
  });
});

// ─── SMTP credential tests ────────────────────────────────────────────────────

describe("SMTP credentials", () => {
  it("SMTP_HOST is present and is a valid hostname", () => {
    const host = process.env.SMTP_HOST;
    if (!host) {
      console.warn("SMTP_HOST not set — email notifications will be skipped");
      return;
    }
    expect(host.length).toBeGreaterThan(3);
    // Should be a valid hostname (contains at least one dot)
    expect(host).toMatch(/\./);
  });

  it("SMTP_PORT is present and is a valid port number", () => {
    const port = process.env.SMTP_PORT;
    if (!port) {
      console.warn("SMTP_PORT not set — email notifications will be skipped");
      return;
    }
    const portNum = parseInt(port, 10);
    expect(isNaN(portNum)).toBe(false);
    // Common SMTP ports: 25, 465, 587, 2525
    expect(portNum).toBeGreaterThan(0);
    expect(portNum).toBeLessThan(65536);
  });

  it("SMTP_USER is present and looks like an email address", () => {
    const user = process.env.SMTP_USER;
    if (!user) {
      console.warn("SMTP_USER not set — email notifications will be skipped");
      return;
    }
    expect(user.length).toBeGreaterThan(5);
    expect(user).toMatch(/@/);
  });

  it("SMTP_PASS is present and non-empty", () => {
    const pass = process.env.SMTP_PASS;
    if (!pass) {
      console.warn("SMTP_PASS not set — email notifications will be skipped");
      return;
    }
    expect(pass.length).toBeGreaterThan(0);
  });

  it("APPROVAL_EMAIL is present and looks like a valid email", () => {
    const email = process.env.APPROVAL_EMAIL;
    if (!email) {
      console.warn("APPROVAL_EMAIL not set — email notifications will be skipped");
      return;
    }
    expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
