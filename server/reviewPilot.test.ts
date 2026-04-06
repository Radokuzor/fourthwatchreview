import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB and external services ───────────────────────────────────────────

vi.mock("./db", () => ({
  getClientByUserId: vi.fn(),
  getClientById: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  getLocationById: vi.fn(),
  getLocationsByClientId: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
  getReviewsByLocationId: vi.fn(),
  getReviewById: vi.fn(),
  getNewReviewsByClientId: vi.fn(),
  getResponseById: vi.fn(),
  getResponseByReviewId: vi.fn(),
  getResponsesByClientId: vi.fn(),
  updateReviewResponse: vi.fn(),
  updateReviewStatus: vi.fn(),
  getBrandTemplate: vi.fn(),
  upsertBrandTemplate: vi.fn(),
  getAllClients: vi.fn(),
  getAllReviewsForAdmin: vi.fn(),
  getAllActiveLocations: vi.fn(),
  upsertReview: vi.fn(),
  createReviewResponse: vi.fn(),
  createApprovalToken: vi.fn(),
  getApprovalToken: vi.fn(),
  markTokenUsed: vi.fn(),
}));

vi.mock("./reviewPipeline", () => ({
  approveAndPostResponse: vi.fn(),
  rejectResponse: vi.fn(),
  pollLocationReviews: vi.fn(),
  processNewReview: vi.fn(),
}));

vi.mock("./aiResponse", () => ({
  generateAIResponse: vi.fn(),
  regenerateAIResponse: vi.fn(),
}));

vi.mock("./gbp", () => ({
  buildGoogleOAuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  listAccounts: vi.fn(),
  listLocations: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<TrpcContext["user"]>): TrpcContext {
  return {
    user: {
      id: 1,
      clerkId: "user_test_1",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "supabase",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeAdminCtx(): TrpcContext {
  return makeCtx({ role: "admin" });
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result?.email).toBe("test@example.com");
  });

  it("returns null for unauthenticated requests", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

// ─── Client tests ─────────────────────────────────────────────────────────────

describe("clients.me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no client profile exists", async () => {
    const { getClientByUserId } = await import("./db");
    vi.mocked(getClientByUserId).mockResolvedValue(undefined);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.me();
    expect(result).toBeUndefined();
    expect(getClientByUserId).toHaveBeenCalledWith(1);
  });

  it("returns client profile when it exists", async () => {
    const { getClientByUserId } = await import("./db");
    const mockClient = {
      id: 1,
      userId: 1,
      businessName: "Test Business",
      contactEmail: "test@example.com",
      approvalEmail: null,
      telegramChatId: null,
      notifyTelegram: true,
      notifyEmail: true,
      subscriptionStatus: "trial" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getClientByUserId).mockResolvedValue(mockClient);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.me();
    expect(result?.businessName).toBe("Test Business");
  });
});

describe("clients.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a client profile successfully", async () => {
    const { getClientByUserId, createClient, getClientById } = await import("./db");
    vi.mocked(getClientByUserId).mockResolvedValue(undefined);
    vi.mocked(createClient).mockResolvedValue(42);
    vi.mocked(getClientById).mockResolvedValue({
      id: 42,
      userId: 1,
      businessName: "My Restaurant",
      contactEmail: "owner@restaurant.com",
      approvalEmail: null,
      telegramChatId: null,
      notifyTelegram: true,
      notifyEmail: true,
      subscriptionStatus: "trial" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.create({ businessName: "My Restaurant", notifyTelegram: true, notifyEmail: true });
    expect(result?.businessName).toBe("My Restaurant");
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ businessName: "My Restaurant" }));
  });

  it("throws CONFLICT if client already exists", async () => {
    const { getClientByUserId } = await import("./db");
    vi.mocked(getClientByUserId).mockResolvedValue({
      id: 1, userId: 1, businessName: "Existing", contactEmail: null,
      approvalEmail: null, telegramChatId: null, notifyTelegram: true,
      notifyEmail: true, subscriptionStatus: "trial" as const,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.clients.create({ businessName: "New Business", notifyTelegram: true, notifyEmail: true })
    ).rejects.toThrow("Client profile already exists");
  });
});

// ─── Admin access tests ───────────────────────────────────────────────────────

describe("admin.allClients", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows admin users to access all clients", async () => {
    const { getAllClients } = await import("./db");
    vi.mocked(getAllClients).mockResolvedValue([]);

    const ctx = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.allClients();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = makeCtx({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.allClients()).rejects.toThrow("FORBIDDEN");
  });
});

// ─── Response approval tests ──────────────────────────────────────────────────

describe("responses.approve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves a response for an owned review", async () => {
    const { getClientByUserId, getResponseById, getReviewById, getLocationById } = await import("./db");
    const { approveAndPostResponse } = await import("./reviewPipeline");

    vi.mocked(getClientByUserId).mockResolvedValue({
      id: 1, userId: 1, businessName: "Test", contactEmail: null,
      approvalEmail: null, telegramChatId: null, notifyTelegram: true,
      notifyEmail: true, subscriptionStatus: "trial" as const,
      createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(getResponseById).mockResolvedValue({
      id: 10, reviewId: 5, aiDraftResponse: "Great response!", finalResponse: "Great response!",
      status: "pending_approval" as const, telegramMessageId: null,
      approvedAt: null, postedAt: null, rejectedAt: null, rejectedReason: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(getReviewById).mockResolvedValue({
      id: 5, locationId: 3, googleReviewId: "abc123", reviewerName: "John",
      reviewerPhotoUrl: null, rating: 5, comment: "Great place!",
      publishedAt: Date.now(), status: "pending_approval" as const,
      fetchedAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(getLocationById).mockResolvedValue({
      id: 3, clientId: 1, locationName: "Main St", address: null,
      onboardingPath: "manager" as const, googleAccountId: null,
      googleLocationId: null, managerEmail: null, accessToken: null,
      refreshToken: null, tokenExpiresAt: null, isActive: true,
      lastPolledAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(approveAndPostResponse).mockResolvedValue(undefined);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.responses.approve({ responseId: 10 });
    expect(result.success).toBe(true);
    expect(approveAndPostResponse).toHaveBeenCalledWith(10, undefined);
  });

  it("throws FORBIDDEN if response belongs to different client", async () => {
    const { getClientByUserId, getResponseById, getReviewById, getLocationById } = await import("./db");

    vi.mocked(getClientByUserId).mockResolvedValue({
      id: 1, userId: 1, businessName: "Test", contactEmail: null,
      approvalEmail: null, telegramChatId: null, notifyTelegram: true,
      notifyEmail: true, subscriptionStatus: "trial" as const,
      createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(getResponseById).mockResolvedValue({
      id: 10, reviewId: 5, aiDraftResponse: "Draft", finalResponse: "Draft",
      status: "pending_approval" as const, telegramMessageId: null,
      approvedAt: null, postedAt: null, rejectedAt: null, rejectedReason: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(getReviewById).mockResolvedValue({
      id: 5, locationId: 99, googleReviewId: "xyz", reviewerName: "Jane",
      reviewerPhotoUrl: null, rating: 4, comment: "Good",
      publishedAt: Date.now(), status: "pending_approval" as const,
      fetchedAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(getLocationById).mockResolvedValue({
      id: 99, clientId: 999, // Different client!
      locationName: "Other Location", address: null,
      onboardingPath: "manager" as const, googleAccountId: null,
      googleLocationId: null, managerEmail: null, accessToken: null,
      refreshToken: null, tokenExpiresAt: null, isActive: true,
      lastPolledAt: null, createdAt: new Date(), updatedAt: new Date(),
    });

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.responses.approve({ responseId: 10 })).rejects.toThrow("FORBIDDEN");
  });
});

// ─── Template tests ───────────────────────────────────────────────────────────

describe("templates.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no template exists", async () => {
    const { getClientByUserId, getBrandTemplate } = await import("./db");
    vi.mocked(getClientByUserId).mockResolvedValue({
      id: 1, userId: 1, businessName: "Test", contactEmail: null,
      approvalEmail: null, telegramChatId: null, notifyTelegram: true,
      notifyEmail: true, subscriptionStatus: "trial" as const,
      createdAt: new Date(), updatedAt: new Date(),
    });
    vi.mocked(getBrandTemplate).mockResolvedValue(undefined);

    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.get();
    expect(result).toBeUndefined();
  });
});
