import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  approvalTokens,
  auditLeads,
  brandTemplates,
  clients,
  demoApprovals,
  locations,
  reviewResponses,
  reviews,
  userAudits,
  users,
  type InsertApprovalToken,
  type InsertBrandTemplate,
  type InsertClient,
  type InsertLocation,
  type InsertReview,
  type InsertReviewResponse,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.clerkId) throw new Error("User clerkId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { clerkId: user.clerkId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.clerkId === ENV.ownerClerkUserId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByClerkId(clerkId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return result[0];
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(clients).values(data);
  return result.insertId as number;
}

export async function getClientByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.userId, userId)).limit(1);
  return result[0];
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

// ─── Locations ────────────────────────────────────────────────────────────────
export async function createLocation(data: InsertLocation) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(locations).values(data);
  return result.insertId as number;
}

export async function getLocationsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.clientId, clientId)).orderBy(desc(locations.createdAt));
}

export async function getLocationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  return result[0];
}

export async function getAllActiveLocations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.isActive, true));
}

export async function updateLocation(id: number, data: Partial<InsertLocation>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(locations).set(data).where(eq(locations.id, id));
}

export async function deleteLocation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(locations).set({ isActive: false }).where(eq(locations.id, id));
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
export async function upsertReview(data: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(reviews)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        reviewerName: data.reviewerName,
        rating: data.rating,
        comment: data.comment,
        publishedAt: data.publishedAt,
      },
    });
  const result = await db
    .select()
    .from(reviews)
    .where(eq(reviews.googleReviewId, data.googleReviewId!))
    .limit(1);
  return result[0];
}

export async function getReviewsByLocationId(locationId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.locationId, locationId))
    .orderBy(desc(reviews.publishedAt))
    .limit(limit);
}

export async function getReviewById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return result[0];
}

export async function updateReviewStatus(id: number, status: InsertReview["status"]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(reviews).set({ status }).where(eq(reviews.id, id));
}

export async function getNewReviewsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ review: reviews, location: locations })
    .from(reviews)
    .innerJoin(locations, eq(reviews.locationId, locations.id))
    .where(and(eq(locations.clientId, clientId), eq(reviews.status, "new")))
    .orderBy(desc(reviews.publishedAt));
}

export async function getAllReviewsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ review: reviews, location: locations, client: clients })
    .from(reviews)
    .innerJoin(locations, eq(reviews.locationId, locations.id))
    .innerJoin(clients, eq(locations.clientId, clients.id))
    .orderBy(desc(reviews.fetchedAt))
    .limit(200);
}

// ─── Review Responses ─────────────────────────────────────────────────────────
export async function createReviewResponse(data: InsertReviewResponse) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(reviewResponses).values(data);
  return result.insertId as number;
}

export async function getResponseByReviewId(reviewId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviewResponses).where(eq(reviewResponses.reviewId, reviewId)).limit(1);
  return result[0];
}

export async function getResponseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reviewResponses).where(eq(reviewResponses.id, id)).limit(1);
  return result[0];
}

export async function updateReviewResponse(id: number, data: Partial<InsertReviewResponse>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(reviewResponses).set(data).where(eq(reviewResponses.id, id));
}

export async function getResponsesByClientId(clientId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ response: reviewResponses, review: reviews, location: locations })
    .from(reviewResponses)
    .innerJoin(reviews, eq(reviewResponses.reviewId, reviews.id))
    .innerJoin(locations, eq(reviews.locationId, locations.id))
    .where(eq(locations.clientId, clientId))
    .orderBy(desc(reviewResponses.createdAt))
    .limit(limit);
}

// ─── Brand Templates ──────────────────────────────────────────────────────────
export async function getBrandTemplate(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brandTemplates).where(eq(brandTemplates.clientId, clientId)).limit(1);
  return result[0];
}

export async function upsertBrandTemplate(data: InsertBrandTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(brandTemplates)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        businessContext: data.businessContext,
        brandVoice: data.brandVoice,
        toneGuidelines: data.toneGuidelines,
        responseTemplates: data.responseTemplates,
        avoidPhrases: data.avoidPhrases,
        mustIncludePhrases: data.mustIncludePhrases,
        languagePreference: data.languagePreference,
      },
    });
}

// ─── Approval Tokens ──────────────────────────────────────────────────────────
export async function createApprovalToken(data: InsertApprovalToken) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(approvalTokens).values(data);
}

export async function getApprovalToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(approvalTokens)
    .where(and(eq(approvalTokens.token, token), isNull(approvalTokens.usedAt)))
    .limit(1);
  return result[0];
}

export async function markTokenUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(approvalTokens).set({ usedAt: Date.now() }).where(eq(approvalTokens.token, token));
}

export async function cleanExpiredTokens() {
  const db = await getDb();
  if (!db) return;
  await db.delete(approvalTokens).where(lt(approvalTokens.expiresAt, Date.now()));
}

// ─── Audit Leads ──────────────────────────────────────────────────────────────
export async function createAuditLead(data: {
  email: string;
  phone?: string;
  businessName: string;
  placeId?: string;
  healthScore?: number;
  responseRate?: number;
  totalReviews?: number;
  averageRating?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { auditLeads } = await import("../drizzle/schema");
  const result = await db.insert(auditLeads).values({
    email: data.email,
    phone: data.phone ?? null,
    businessName: data.businessName,
    placeId: data.placeId ?? null,
    healthScore: data.healthScore ?? null,
    responseRate: data.responseRate ?? null,
    totalReviews: data.totalReviews ?? null,
    averageRating: data.averageRating ?? null,
  });
  return result;
}

export async function getAllAuditLeads() {
  const db = await getDb();
  if (!db) return [];
  const { auditLeads } = await import("../drizzle/schema");
  return db.select().from(auditLeads).orderBy(auditLeads.createdAt);
}

export async function getAuditLeadByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const { auditLeads } = await import("../drizzle/schema");
  const result = await db.select().from(auditLeads).where(eq(auditLeads.email, email)).limit(1);
  return result[0] ?? null;
}

// Pass code to store the OTP; omit code to mark as verified
export async function markAuditLeadVerified(email: string, code?: string) {
  const db = await getDb();
  if (!db) return;
  const { auditLeads } = await import("../drizzle/schema");
  await db.update(auditLeads)
    .set(code ? { verificationCode: code } : { verified: true })
    .where(eq(auditLeads.email, email));
}

// ─── User Audits ──────────────────────────────────────────────────────────────
export async function saveUserAudit(data: {
  userId?: number | null;
  email?: string | null;
  placeId: string;
  businessName: string;
  auditJson: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { userAudits } = await import("../drizzle/schema");
  const [result] = await db.insert(userAudits).values({
    userId: data.userId ?? null,
    email: data.email ?? null,
    placeId: data.placeId,
    businessName: data.businessName,
    auditJson: data.auditJson,
  });
  return result.insertId as number;
}

export async function getUserAuditByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { userAudits } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(userAudits)
    .where(eq(userAudits.userId, userId))
    .orderBy(desc(userAudits.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserAuditByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const { userAudits } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(userAudits)
    .where(eq(userAudits.email, email))
    .orderBy(desc(userAudits.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function linkAuditToUser(email: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  const { userAudits } = await import("../drizzle/schema");
  await db
    .update(userAudits)
    .set({ userId })
    .where(eq(userAudits.email, email));
}

/** Hard-delete all app data for a user (locations, reviews, client, audits, leads). Caller deletes Clerk user after. */
export async function deleteAccountDataForUser(opts: {
  userId: number;
  email: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const client = await getClientByUserId(opts.userId);
  if (client) {
    const locRows = await db.select({ id: locations.id }).from(locations).where(eq(locations.clientId, client.id));
    const locIds = locRows.map((l) => l.id);
    if (locIds.length > 0) {
      const revRows = await db.select({ id: reviews.id }).from(reviews).where(inArray(reviews.locationId, locIds));
      const revIds = revRows.map((r) => r.id);
      if (revIds.length > 0) {
        const respRows = await db
          .select({ id: reviewResponses.id })
          .from(reviewResponses)
          .where(inArray(reviewResponses.reviewId, revIds));
        const respIds = respRows.map((r) => r.id);
        if (respIds.length > 0) {
          await db.delete(approvalTokens).where(inArray(approvalTokens.reviewResponseId, respIds));
        }
        await db.delete(reviewResponses).where(inArray(reviewResponses.reviewId, revIds));
        await db.delete(reviews).where(inArray(reviews.id, revIds));
      }
      await db.delete(locations).where(inArray(locations.id, locIds));
    }
    await db.delete(brandTemplates).where(eq(brandTemplates.clientId, client.id));
    await db.delete(clients).where(eq(clients.id, client.id));
  }

  await db.delete(userAudits).where(eq(userAudits.userId, opts.userId));
  if (opts.email) {
    await db.delete(userAudits).where(eq(userAudits.email, opts.email));
    await db.delete(auditLeads).where(eq(auditLeads.email, opts.email));
    await db.delete(demoApprovals).where(eq(demoApprovals.email, opts.email));
  }

  await db.delete(users).where(eq(users.id, opts.userId));
}
