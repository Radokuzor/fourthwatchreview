/**
 * Google Business Profile (GBP) API Service
 *
 * Handles:
 *  - OAuth 2.0 token management (Path 2)
 *  - Fetching reviews for a location
 *  - Posting replies to reviews
 *
 * Path 1 (Manager invite): The platform owner's Google account is added as a
 * manager on the client's GBP. The owner's credentials (stored as env vars)
 * are used to access the API on behalf of the location.
 *
 * Path 2 (OAuth): The client signs in via Google OAuth and grants access.
 * Their tokens are stored encrypted in the locations table.
 */

import axios from "axios";

const GBP_BASE = "https://mybusiness.googleapis.com/v4";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GBP_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
].join(" ");

// ─── Token refresh ────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const res = await axios.post(TOKEN_URL, null, {
    params: {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });

  return {
    accessToken: res.data.access_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
}

// ─── OAuth URL builder ────────────────────────────────────────────────────────

export function buildGoogleOAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GBP_OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const res = await axios.post(TOKEN_URL, null, {
    params: {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    },
  });

  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
}

// ─── Get valid token for a location ──────────────────────────────────────────

export async function getValidToken(location: {
  onboardingPath: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
}): Promise<string> {
  // Path 1: use platform owner's service account token from env
  if (location.onboardingPath === "manager") {
    const token = process.env.GOOGLE_PLATFORM_ACCESS_TOKEN;
    if (!token) throw new Error("Platform Google access token not configured. Set GOOGLE_PLATFORM_ACCESS_TOKEN env var.");
    return token;
  }

  // Path 2: use client's OAuth token, refresh if needed
  if (!location.accessToken || !location.refreshToken) {
    throw new Error("Location OAuth tokens not found");
  }

  const bufferMs = 5 * 60 * 1000; // 5 min buffer
  if (!location.tokenExpiresAt || Date.now() > location.tokenExpiresAt - bufferMs) {
    const refreshed = await refreshAccessToken(location.refreshToken);
    return refreshed.accessToken;
  }

  return location.accessToken;
}

// ─── List accounts ────────────────────────────────────────────────────────────

export async function listAccounts(accessToken: string) {
  const res = await axios.get(`${GBP_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data.accounts || [];
}

// ─── List locations for an account ───────────────────────────────────────────

export async function listLocations(accessToken: string, accountId: string) {
  const res = await axios.get(`${GBP_BASE}/${accountId}/locations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { pageSize: 100 },
  });
  return res.data.locations || [];
}

// ─── Fetch reviews for a location ────────────────────────────────────────────

export interface GBPReview {
  name: string; // "accounts/{accountId}/locations/{locationId}/reviews/{reviewId}"
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName: string;
    isAnonymous?: boolean;
  };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

const STAR_TO_NUM: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export function starRatingToNumber(star: string): number {
  return STAR_TO_NUM[star] ?? 0;
}

export async function fetchReviews(
  accessToken: string,
  accountId: string,
  locationId: string,
  pageToken?: string
): Promise<{ reviews: GBPReview[]; nextPageToken?: string }> {
  const params: Record<string, string | number> = { pageSize: 50, orderBy: "updateTime desc" };
  if (pageToken) params.pageToken = pageToken;

  const res = await axios.get(
    `${GBP_BASE}/${accountId}/locations/${locationId}/reviews`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
    }
  );

  return {
    reviews: res.data.reviews || [],
    nextPageToken: res.data.nextPageToken,
  };
}

// ─── Post a reply to a review ─────────────────────────────────────────────────

export async function postReviewReply(
  accessToken: string,
  accountId: string,
  locationId: string,
  reviewId: string,
  replyText: string
): Promise<void> {
  await axios.put(
    `${GBP_BASE}/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
    { comment: replyText },
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  );
}

// ─── Delete a reply ───────────────────────────────────────────────────────────

export async function deleteReviewReply(
  accessToken: string,
  accountId: string,
  locationId: string,
  reviewId: string
): Promise<void> {
  await axios.delete(
    `${GBP_BASE}/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}
