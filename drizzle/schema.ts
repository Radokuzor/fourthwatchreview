import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Core auth user ────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  clerkId: varchar("clerkId", { length: 255 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients (businesses using the platform) ──────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // FK → users.id
  businessName: varchar("businessName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  telegramChatId: varchar("telegramChatId", { length: 64 }),
  notifyTelegram: boolean("notifyTelegram").default(true).notNull(),
  notifyEmail: boolean("notifyEmail").default(true).notNull(),
  approvalEmail: varchar("approvalEmail", { length: 320 }),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["trial", "active", "paused", "cancelled"]).default("trial").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Locations (Google Business Profile locations per client) ─────────────────
export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(), // FK → clients.id
  locationName: varchar("locationName", { length: 255 }).notNull(),
  address: text("address"),
  googleAccountId: varchar("googleAccountId", { length: 128 }),
  googleLocationId: varchar("googleLocationId", { length: 255 }),
  onboardingPath: mysqlEnum("onboardingPath", ["manager", "oauth"]).default("manager").notNull(),
  // OAuth path tokens
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: bigint("tokenExpiresAt", { mode: "number" }),
  // Manager path
  managerEmail: varchar("managerEmail", { length: 320 }),
  isActive: boolean("isActive").default(true).notNull(),
  lastPolledAt: timestamp("lastPolledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  locationId: int("locationId").notNull(), // FK → locations.id
  googleReviewId: varchar("googleReviewId", { length: 255 }).notNull().unique(),
  reviewerName: varchar("reviewerName", { length: 255 }),
  reviewerPhotoUrl: text("reviewerPhotoUrl"),
  rating: int("rating").notNull(), // 1–5
  comment: text("comment"),
  publishedAt: bigint("publishedAt", { mode: "number" }),
  status: mysqlEnum("status", ["new", "processing", "pending_approval", "approved", "posted", "rejected", "manual"]).default("new").notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// ─── Review Responses ─────────────────────────────────────────────────────────
export const reviewResponses = mysqlTable("review_responses", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull().unique(), // FK → reviews.id (1:1)
  aiDraftResponse: text("aiDraftResponse"),
  finalResponse: text("finalResponse"),
  status: mysqlEnum("status", ["draft", "pending_approval", "approved", "posted", "rejected", "manual_needed"]).default("draft").notNull(),
  approvedAt: bigint("approvedAt", { mode: "number" }),
  postedAt: bigint("postedAt", { mode: "number" }),
  rejectedAt: bigint("rejectedAt", { mode: "number" }),
  rejectedReason: text("rejectedReason"),
  telegramMessageId: varchar("telegramMessageId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReviewResponse = typeof reviewResponses.$inferSelect;
export type InsertReviewResponse = typeof reviewResponses.$inferInsert;

// ─── Brand Templates (per client) ─────────────────────────────────────────────
export const brandTemplates = mysqlTable("brand_templates", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(), // FK → clients.id (1:1)
  businessContext: text("businessContext"), // e.g. "We are a family-owned Italian restaurant..."
  brandVoice: text("brandVoice"), // e.g. "Warm, professional, never defensive"
  toneGuidelines: text("toneGuidelines"), // e.g. "Always thank reviewer by first name"
  // JSON: { "5": "template for 5-star", "4": "...", "3": "...", "1-2": "..." }
  responseTemplates: json("responseTemplates"),
  // Additional instructions for AI
  avoidPhrases: text("avoidPhrases"),
  mustIncludePhrases: text("mustIncludePhrases"),
  languagePreference: varchar("languagePreference", { length: 16 }).default("en"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandTemplate = typeof brandTemplates.$inferSelect;
export type InsertBrandTemplate = typeof brandTemplates.$inferInsert;

// ─── Approval Tokens (email approve/reject links) ─────────────────────────────
export const approvalTokens = mysqlTable("approval_tokens", {
  id: int("id").autoincrement().primaryKey(),
  reviewResponseId: int("reviewResponseId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  action: mysqlEnum("action", ["approve", "reject"]).notNull(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  usedAt: bigint("usedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalToken = typeof approvalTokens.$inferSelect;
export type InsertApprovalToken = typeof approvalTokens.$inferInsert;

// ─── Audit Leads (from public audit page) ─────────────────────────────────────
export const auditLeads = mysqlTable("audit_leads", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  businessName: text("businessName").notNull(),
  placeId: varchar("placeId", { length: 256 }),
  healthScore: int("healthScore"),
  responseRate: int("responseRate"),
  totalReviews: int("totalReviews"),
  averageRating: varchar("averageRating", { length: 10 }),
  verificationCode: varchar("verificationCode", { length: 10 }),
  verified: boolean("verified").default(false).notNull(),
  convertedToClient: boolean("convertedToClient").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLead = typeof auditLeads.$inferSelect;
export type InsertAuditLead = typeof auditLeads.$inferInsert;

// ─── Demo Approvals (onboarding free-trial demo flow) ─────────────────────────
export const demoApprovals = mysqlTable("demo_approvals", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  businessName: text("businessName").notNull(),
  reviewText: text("reviewText"),
  reviewerName: varchar("reviewerName", { length: 255 }),
  rating: int("rating"),
  demoResponse: text("demoResponse"),
  decision: mysqlEnum("decision", ["pending", "approved", "denied"]).default("pending").notNull(),
  decidedAt: bigint("decidedAt", { mode: "number" }),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DemoApproval = typeof demoApprovals.$inferSelect;
export type InsertDemoApproval = typeof demoApprovals.$inferInsert;

// ─── User Audits (onboarding + dashboard audit results) ─────────────────────────────────
export const userAudits = mysqlTable("user_audits", {
  id: int("id").autoincrement().primaryKey(),
  // Either userId (signed-in) or email (anonymous) — at least one must be set
  userId: int("userId"), // FK → users.id (nullable for anonymous)
  email: varchar("email", { length: 320 }), // fallback for anonymous users
  placeId: varchar("placeId", { length: 256 }).notNull(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  auditJson: text("auditJson").notNull(), // full AuditAnalysis JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserAudit = typeof userAudits.$inferSelect;
export type InsertUserAudit = typeof userAudits.$inferInsert;
