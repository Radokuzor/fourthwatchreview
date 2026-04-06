import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ─── Mock db helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    saveUserAudit: vi.fn().mockResolvedValue(42),
    getUserAuditByUserId: vi.fn().mockResolvedValue(null),
    getUserAuditByEmail: vi.fn().mockResolvedValue(null),
    linkAuditToUser: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Mock scraper to avoid real network calls ─────────────────────────────────
vi.mock("./scraper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./scraper")>();
  return {
    ...actual,
    getBusinessReviews: vi.fn().mockResolvedValue([
      { reviewId: "r1", authorName: "Alice", rating: 5, text: "Great place!", relativeTime: "1 week ago", hasOwnerResponse: false },
      { reviewId: "r2", authorName: "Bob", rating: 3, text: "It was okay.", relativeTime: "2 weeks ago", hasOwnerResponse: true },
    ]),
    getCompetitorReviews: vi.fn().mockResolvedValue([]),
    runAIAnalysis: vi.fn().mockResolvedValue({
      painPoints: ["Long wait times"],
      topPraises: ["Friendly staff"],
      staffSignals: [],
      operationalIssues: [],
      doThisNow: ["Respond to all unanswered reviews"],
      sentimentTrend: { oldestFour: 70, newestFour: 80, direction: "improving", summary: "Sentiment is improving." },
      competitorKeywordGap: [],
    }),
    computeBaseMetrics: vi.fn().mockReturnValue({
      totalReviews: 2,
      averageRating: 4.0,
      responseRate: 50,
      unansweredCount: 1,
      sentimentScore: 75,
      healthScore: 72,
      reviewVelocity: "~2/month",
      competitorBenchmark: "On par with competitors",
    }),
  };
});

import { appRouter } from "./routers";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAuthContext(userId = 1, email = "test@example.com"): TrpcContext {
  return {
    user: {
      id: userId,
      clerkId: "user_test_audit",
      email,
      name: "Test User",
      loginMethod: "supabase",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("audit.getMyAudit", () => {
  it("returns null when neither userId nor email is provided", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.audit.getMyAudit({});
    expect(result).toBeNull();
  });

  it("returns null when no audit is found for the userId", async () => {
    const { getUserAuditByUserId } = await import("./db");
    vi.mocked(getUserAuditByUserId).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.audit.getMyAudit({ userId: 99 });
    expect(result).toBeNull();
  });

  it("returns parsed audit data when found by userId", async () => {
    const { getUserAuditByUserId } = await import("./db");
    vi.mocked(getUserAuditByUserId).mockResolvedValueOnce({
      id: 1,
      userId: 1,
      email: "test@example.com",
      placeId: "place123",
      businessName: "Test Business",
      createdAt: new Date(),
      auditJson: JSON.stringify({
        analysis: { painPoints: ["Slow service"], topPraises: ["Good food"], staffSignals: [], operationalIssues: [], doThisNow: [], sentimentTrend: { oldestFour: 60, newestFour: 70, direction: "improving", summary: "Getting better" }, competitorKeywordGap: [] },
        metrics: { totalReviews: 10, averageRating: 4.2, responseRate: 60, unansweredCount: 4, sentimentScore: 70, healthScore: 68, reviewVelocity: "~5/month", competitorBenchmark: "Above average" },
      }),
    });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.audit.getMyAudit({ userId: 1 });
    expect(result).not.toBeNull();
    expect(result?.businessName).toBe("Test Business");
    expect(result?.analysis.painPoints).toContain("Slow service");
    expect(result?.metrics.totalReviews).toBe(10);
  });
});

describe("onboarding.runAndSaveAudit", () => {
  it("runs audit and returns auditId on success", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.onboarding.runAndSaveAudit({
      placeId: "ChIJtest123",
      businessName: "Test Cafe",
      email: "owner@testcafe.com",
    });
    expect(result.success).toBe(true);
    expect(result.auditId).toBe(42);
    expect(result.analysis).toBeDefined();
    expect(result.metrics).toBeDefined();
  });
});
