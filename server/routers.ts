import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAuditLead,
  getAllAuditLeads,
  getAuditLeadByEmail,
  markAuditLeadVerified,
  createClient,
  createLocation,
  deleteAccountDataForUser,
  deleteLocation,
  getAllClients,
  getAllReviewsForAdmin,
  getBrandTemplate,
  getClientById,
  getClientByUserId,
  getLocationById,
  getLocationsByClientId,
  getNewReviewsByClientId,
  getResponseById,
  getResponseByReviewId,
  getResponsesByClientId,
  getReviewById,
  getReviewsByLocationId,
  updateClient,
  updateLocation,
  updateReviewResponse,
  upsertBrandTemplate,
  saveUserAudit,
  getUserAuditByUserId,
  getUserAuditByEmail,
  linkAuditToUser,
} from "./db";
import {
  approveAndPostResponse,
  pollLocationReviews,
  processNewReview,
  rejectResponse,
} from "./reviewPipeline";
import { generateAIResponse, regenerateAIResponse } from "./aiResponse";
import { buildGoogleOAuthUrl, exchangeCodeForTokens, listAccounts, listLocations } from "./gbp";
import { searchBusinesses, getBusinessReviews, computeBaseMetrics, runAIAnalysis, getCompetitorReviews, reviewHasOwnerResponse, type StaffSignal } from "./scraper";
import { sendSms } from "./sms";
import { sendApprovalEmail } from "./emailService";

// Helper to send a plain email (wraps sendApprovalEmail with a generic template)
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  // Re-use the nodemailer transport from emailService via a direct import
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
}
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function requireClientForUser(userId: number) {
  const client = await getClientByUserId(userId);
  if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client profile not found" });
  return client;
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      return { success: true } as const;
    }),

    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.clerkId === ENV.ownerClerkUserId && ENV.ownerClerkUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account cannot be deleted from the app.",
        });
      }
      await deleteAccountDataForUser({
        userId: ctx.user.id,
        email: ctx.user.email ?? null,
      });
      if (ENV.clerkSecretKey) {
        const { createClerkClient } = await import("@clerk/backend");
        const clerk = createClerkClient({ secretKey: ENV.clerkSecretKey });
        await clerk.users.deleteUser(ctx.user.clerkId);
      }
      return { success: true } as const;
    }),
  }),

  // ─── Client profile ─────────────────────────────────────────────────────────
  clients: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      return getClientByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          businessName: z.string().min(1).max(255),
          contactEmail: z.string().email().optional(),
          approvalEmail: z.string().email().optional(),
          telegramChatId: z.string().optional(),
          notifyTelegram: z.boolean().default(true),
          notifyEmail: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getClientByUserId(ctx.user.id);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Client profile already exists" });

        const id = await createClient({
          userId: ctx.user.id,
          businessName: input.businessName,
          contactEmail: input.contactEmail || ctx.user.email || undefined,
          approvalEmail: input.approvalEmail,
          telegramChatId: input.telegramChatId,
          notifyTelegram: input.notifyTelegram,
          notifyEmail: input.notifyEmail,
        });
        return getClientById(id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          businessName: z.string().min(1).max(255).optional(),
          contactEmail: z.string().email().optional(),
          approvalEmail: z.string().email().optional(),
          telegramChatId: z.string().optional(),
          notifyTelegram: z.boolean().optional(),
          notifyEmail: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        await updateClient(client.id, input);
        return getClientById(client.id);
      }),
  }),

  // ─── Locations ───────────────────────────────────────────────────────────────
  locations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const client = await requireClientForUser(ctx.user.id);
      return getLocationsByClientId(client.id);
    }),

    add: protectedProcedure
      .input(
        z.object({
          locationName: z.string().min(1).max(255),
          address: z.string().optional(),
          onboardingPath: z.enum(["manager", "oauth"]).default("manager"),
          googleAccountId: z.string().optional(),
          googleLocationId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const managerEmail = process.env.GOOGLE_MANAGER_EMAIL || "platform@reviewpilot.com";
        const id = await createLocation({
          clientId: client.id,
          locationName: input.locationName,
          address: input.address,
          onboardingPath: input.onboardingPath,
          googleAccountId: input.googleAccountId,
          googleLocationId: input.googleLocationId,
          managerEmail: input.onboardingPath === "manager" ? managerEmail : undefined,
          isActive: true,
        });
        return getLocationById(id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          locationId: z.number(),
          locationName: z.string().optional(),
          address: z.string().optional(),
          googleAccountId: z.string().optional(),
          googleLocationId: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const location = await getLocationById(input.locationId);
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        const { locationId, ...data } = input;
        await updateLocation(locationId, data);
        return getLocationById(locationId);
      }),

    remove: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const location = await getLocationById(input.locationId);
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        await deleteLocation(input.locationId);
        return { success: true };
      }),

    pollNow: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const location = await getLocationById(input.locationId);
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        await pollLocationReviews(input.locationId);
        return { success: true };
      }),

    // GBP OAuth: get auth URL
    getOAuthUrl: protectedProcedure
      .input(z.object({ redirectUri: z.string() }))
      .query(async ({ input }) => {
        const state = `reviewpilot_oauth_${Date.now()}`;
        const url = buildGoogleOAuthUrl(input.redirectUri, state);
        return { url, state };
      }),

    // GBP OAuth: exchange code for tokens
    connectOAuth: protectedProcedure
      .input(z.object({ locationId: z.number(), code: z.string(), redirectUri: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const location = await getLocationById(input.locationId);
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });

        const tokens = await exchangeCodeForTokens(input.code, input.redirectUri);
        await updateLocation(input.locationId, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          onboardingPath: "oauth",
        });
        return { success: true };
      }),

    // List GBP accounts for OAuth-connected user
    listGBPAccounts: protectedProcedure
      .input(z.object({ locationId: z.number() }))
      .query(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const location = await getLocationById(input.locationId);
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (!location.accessToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Not connected to Google" });
        return listAccounts(location.accessToken);
      }),

    listGBPLocations: protectedProcedure
      .input(z.object({ locationId: z.number(), accountId: z.string() }))
      .query(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const location = await getLocationById(input.locationId);
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (!location.accessToken) throw new TRPCError({ code: "PRECONDITION_FAILED" });
        return listLocations(location.accessToken, input.accountId);
      }),
  }),

  // ─── Reviews ─────────────────────────────────────────────────────────────────
  reviews: router({
    byLocation: protectedProcedure
      .input(z.object({ locationId: z.number(), limit: z.number().max(100).default(50) }))
      .query(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const location = await getLocationById(input.locationId);
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        return getReviewsByLocationId(input.locationId, input.limit);
      }),

    newForClient: protectedProcedure.query(async ({ ctx }) => {
      const client = await requireClientForUser(ctx.user.id);
      return getNewReviewsByClientId(client.id);
    }),

    withResponse: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ ctx, input }) => {
        const review = await getReviewById(input.reviewId);
        if (!review) throw new TRPCError({ code: "NOT_FOUND" });
        const response = await getResponseByReviewId(input.reviewId);
        return { review, response };
      }),
  }),

  // ─── Responses / Approval ────────────────────────────────────────────────────
  responses: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().max(100).default(50) }))
      .query(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        return getResponsesByClientId(client.id, input.limit);
      }),

    approve: protectedProcedure
      .input(z.object({ responseId: z.number(), finalText: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const response = await getResponseById(input.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const review = await getReviewById(response.reviewId);
        const location = review ? await getLocationById(review.locationId) : null;
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });

        await approveAndPostResponse(input.responseId, input.finalText);
        return { success: true };
      }),

    reject: protectedProcedure
      .input(z.object({ responseId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const response = await getResponseById(input.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const review = await getReviewById(response.reviewId);
        const location = review ? await getLocationById(review.locationId) : null;
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });

        await rejectResponse(input.responseId, input.reason);
        return { success: true };
      }),

    edit: protectedProcedure
      .input(z.object({ responseId: z.number(), finalText: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const response = await getResponseById(input.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const review = await getReviewById(response.reviewId);
        const location = review ? await getLocationById(review.locationId) : null;
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });

        await updateReviewResponse(input.responseId, { finalResponse: input.finalText });
        return { success: true };
      }),

    regenerate: protectedProcedure
      .input(z.object({ responseId: z.number(), instructions: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        const response = await getResponseById(input.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const review = await getReviewById(response.reviewId);
        const location = review ? await getLocationById(review.locationId) : null;
        if (!location || location.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });

        const template = await getBrandTemplate(client.id);
        const newDraft = await regenerateAIResponse(
          {
            reviewerName: review!.reviewerName || "Customer",
            rating: review!.rating,
            comment: review!.comment,
            businessName: client.businessName,
            locationName: location.locationName,
          },
          template,
          response.aiDraftResponse || "",
          input.instructions
        );

        await updateReviewResponse(input.responseId, { aiDraftResponse: newDraft, finalResponse: newDraft });
        return { newDraft };
      }),
  }),

  // ─── Brand Templates ──────────────────────────────────────────────────────────
  templates: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const client = await requireClientForUser(ctx.user.id);
      return getBrandTemplate(client.id);
    }),

    upsert: protectedProcedure
      .input(
        z.object({
          businessContext: z.string().optional(),
          brandVoice: z.string().optional(),
          toneGuidelines: z.string().optional(),
          responseTemplates: z.record(z.string(), z.string()).optional(),
          avoidPhrases: z.string().optional(),
          mustIncludePhrases: z.string().optional(),
          languagePreference: z.string().default("en"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const client = await requireClientForUser(ctx.user.id);
        await upsertBrandTemplate({
          clientId: client.id,
          businessContext: input.businessContext,
          brandVoice: input.brandVoice,
          toneGuidelines: input.toneGuidelines,
          responseTemplates: input.responseTemplates || null,
          avoidPhrases: input.avoidPhrases,
          mustIncludePhrases: input.mustIncludePhrases,
          languagePreference: input.languagePreference,
        });
        return getBrandTemplate(client.id);
      }),
  }),

  // ─── Admin ───────────────────────────────────────────────────────────────────
  admin: router({
    allClients: adminProcedure.query(async () => {
      return getAllClients();
    }),

    allReviews: adminProcedure.query(async () => {
      return getAllReviewsForAdmin();
    }),

    clientDetail: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const client = await getClientById(input.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        const locs = await getLocationsByClientId(input.clientId);
        const responses = await getResponsesByClientId(input.clientId, 100);
        return { client, locations: locs, responses };
      }),

    updateClientStatus: adminProcedure
      .input(
        z.object({
          clientId: z.number(),
          subscriptionStatus: z.enum(["trial", "active", "paused", "cancelled"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateClient(input.clientId, { subscriptionStatus: input.subscriptionStatus });
        return { success: true };
      }),

    triggerPoll: adminProcedure
      .input(z.object({ locationId: z.number() }))
      .mutation(async ({ input }) => {
        await pollLocationReviews(input.locationId);
        return { success: true };
      }),

    triggerProcessReview: adminProcedure
      .input(z.object({ reviewId: z.number(), clientId: z.number() }))
      .mutation(async ({ input }) => {
        await processNewReview(input.reviewId, input.clientId);
        return { success: true };
      }),
  }),
  audit: router({
    searchBusinesses: publicProcedure
      .input(z.object({ query: z.string().min(2).max(100) }))
      .mutation(async ({ input }) => {
        const results = await searchBusinesses(input.query);
        return { results };
      }),

    getAuditData: publicProcedure
      .input(z.object({
        placeId: z.string(),
        businessName: z.string(),
        totalReviews: z.number().nullable(),
        category: z.string().nullable().optional(),
        address: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const reviews = await getBusinessReviews(input.placeId);
        const metrics = computeBaseMetrics(reviews, input.totalReviews);

        // Fetch competitor names for AI analysis
        let competitorNames: string[] = [];
        if (input.category && input.address) {
          try {
            const competitors = await getCompetitorReviews(input.category, input.address);
            competitorNames = competitors
              .filter((c) => c.name !== input.businessName)
              .slice(0, 3)
              .map((c) => c.name);
          } catch (e) {
            console.warn("[Audit] competitor fetch failed:", e);
          }
        }

        // Run AI-powered industry-specific analysis
        const analysis = await runAIAnalysis(
          reviews,
          input.businessName,
          input.category ?? null,
          competitorNames
        );

        const reviewSummary = reviews.slice(0, 5).map((r) => ({
          reviewId: r.reviewId,
          authorName: r.authorName,
          rating: r.rating,
          text: r.text,
          relativeTime: r.relativeTime,
          hasOwnerResponse: reviewHasOwnerResponse(r),
        }));

        return { metrics, analysis, reviews: reviewSummary, competitorNames };
      }),

    captureEmail: publicProcedure
      .input(z.object({
        email: z.string().email(),
        businessName: z.string(),
        placeId: z.string().optional(),
        healthScore: z.number().optional(),
        responseRate: z.number().optional(),
        totalReviews: z.number().optional(),
        averageRating: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Generate a 6-digit OTP and store it on the lead
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await createAuditLead({
          email: input.email,
          businessName: input.businessName,
          placeId: input.placeId,
          healthScore: input.healthScore,
          responseRate: input.responseRate,
          totalReviews: input.totalReviews,
          averageRating: input.averageRating,
        });
        // Store OTP separately via update
        await markAuditLeadVerified(input.email, otp);
        // Send OTP via email
        try {
          await sendEmail({
            to: input.email,
            subject: `Your WatchReviews verification code: ${otp}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="color:#1e40af">WatchReviews — Verify Your Email</h2>
              <p>Here is your verification code to unlock your free business audit report for <strong>${input.businessName}</strong>:</p>
              <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
                <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e293b">${otp}</span>
              </div>
              <p style="color:#64748b;font-size:14px">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>`,
          });
        } catch (e) {
          console.warn("[Audit] OTP email failed:", e);
        }
        return { success: true };
      }),
    verifyEmail: publicProcedure
      .input(z.object({ email: z.string().email(), code: z.string().length(6) }))
      .mutation(async ({ input }) => {
        const lead = await getAuditLeadByEmail(input.email);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
        if (lead.verificationCode !== input.code) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code" });
        await markAuditLeadVerified(input.email);
        return { success: true };
      }),

    /** After Clerk email OTP — save lead using authenticated user email (no app SMTP). */
    syncHomeAuditLead: protectedProcedure
      .input(
        z.object({
          businessName: z.string(),
          placeId: z.string().optional(),
          healthScore: z.number().optional(),
          responseRate: z.number().optional(),
          totalReviews: z.number().optional(),
          averageRating: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const email = ctx.user?.email?.trim();
        if (!email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Missing email on account" });
        }
        const existing = await getAuditLeadByEmail(email);
        if (!existing) {
          await createAuditLead({
            email,
            businessName: input.businessName,
            placeId: input.placeId,
            healthScore: input.healthScore,
            responseRate: input.responseRate,
            totalReviews: input.totalReviews,
            averageRating: input.averageRating,
          });
        }
        await markAuditLeadVerified(email);
        return { success: true };
      }),

    capturePhone: publicProcedure
      .input(z.object({
        email: z.string().email(),
        phone: z.string().min(10),
        businessName: z.string(),
        placeId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Update the lead with phone number
        await createAuditLead({
          email: input.email,
          phone: input.phone,
          businessName: input.businessName,
          placeId: input.placeId,
        });
        // Send welcome SMS
        const smsResult = await sendSms(
          input.phone,
          `Hi! Your WatchReviews demo is ready. We just generated an AI response to one of your Google reviews. Check your email to approve or deny it. Reply STOP to opt out.`
        );
        return { success: true, smsSent: smsResult.success };
      }),

    generateDemoResponse: publicProcedure
      .input(z.object({
        reviewText: z.string(),
        reviewerName: z.string(),
        rating: z.number().min(1).max(5),
        businessName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `You are a professional business owner responding to a Google review.

Business: ${input.businessName}
Reviewer: ${input.reviewerName}
Rating: ${input.rating}/5 stars
Review: "${input.reviewText}"

Write a warm, professional, personalized response (2-4 sentences). Thank the reviewer by name. If the rating is low, acknowledge their concern and invite them to reach out directly. Do not be defensive. Do not use generic phrases like "We appreciate your feedback". Sound like a real human business owner.`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: "You are a professional business owner writing Google review responses. Be warm, genuine, and concise." },
            { role: "user", content: prompt },
          ],
        });

        const responseText = result?.choices?.[0]?.message?.content ?? "Thank you for your review! We appreciate your feedback and look forward to serving you again.";
        return { response: responseText };
      }),

    getLeads: adminProcedure.query(async () => {
      return getAllAuditLeads();
    }),

    sendDetailedReport: publicProcedure
      .input(z.object({
        email: z.string().email(),
        businessName: z.string(),
        placeId: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Re-fetch reviews and run full analysis for the detailed report
        const reviews = await getBusinessReviews(input.placeId);
        const analysis = await runAIAnalysis(reviews, input.businessName, null, []);
        const metrics = computeBaseMetrics(reviews, null);

        const logoUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663492121254/dd2dpCppv6NJGLXJF3QZ3N/watchreviews-logo_022832b1.png";

        const painPointsHtml = analysis.painPoints.map((p: string) => `<li style="margin-bottom:6px;color:#b91c1c">${p}</li>`).join("");
        const praisesHtml = analysis.topPraises.map((p: string) => `<li style="margin-bottom:6px;color:#065f46">${p}</li>`).join("");
        const operationalHtml = analysis.operationalIssues.length > 0
          ? analysis.operationalIssues.map((o: string) => `<li style="margin-bottom:6px;color:#92400e">${o}</li>`).join("")
          : `<li style="color:#6b7280">No major operational issues detected.</li>`;
        const positiveStaff = (analysis.staffSignals as StaffSignal[]).filter((s) => s.sentiment === "positive");
        const negativeStaff = (analysis.staffSignals as StaffSignal[]).filter((s) => s.sentiment === "negative");
        const staffPositiveHtml = positiveStaff.map((s) => `<li style="color:#065f46">✓ ${s.name} — ${s.context}</li>`).join("");
        const staffNegativeHtml = negativeStaff.map((s) => `<li style="color:#b91c1c">✗ ${s.name} — ${s.context}</li>`).join("");
        const competitorHtml = (analysis.competitorKeywordGap ?? []).map((g: string) => `<li style="margin-bottom:6px;color:#1e40af">→ ${g}</li>`).join("");
        const trend = analysis.sentimentTrend;
        const oldColor = trend.oldestFour >= 70 ? "#10b981" : trend.oldestFour >= 45 ? "#f59e0b" : "#ef4444";
        const newColor = trend.newestFour >= 70 ? "#10b981" : trend.newestFour >= 45 ? "#f59e0b" : "#ef4444";
        const sentimentHtml = `<span style="margin-right:16px">Oldest reviews: <strong style="color:${oldColor}">${trend.oldestFour}/100</strong></span><span>Recent reviews: <strong style="color:${newColor}">${trend.newestFour}/100</strong></span><br><span style="font-size:12px;color:#64748b;margin-top:4px;display:block">${trend.summary}</span>`;

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:32px 40px;text-align:center">
          <img src="${logoUrl}" alt="WatchReviews" width="48" style="margin-bottom:12px" />
          <h1 style="color:#ffffff;font-size:24px;margin:0 0 4px">WatchReviews</h1>
          <p style="color:#93c5fd;font-size:13px;margin:0">by FourthWatch</p>
        </td></tr>
        <!-- Title -->
        <tr><td style="padding:32px 40px 16px;border-bottom:1px solid #e2e8f0">
          <h2 style="color:#0f172a;font-size:20px;margin:0 0 6px">Full Business Intelligence Report</h2>
          <p style="color:#64748b;font-size:14px;margin:0">${input.businessName}</p>
        </td></tr>
        <!-- Scores -->
        <tr><td style="padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;padding:12px;background:#eff6ff;border-radius:12px;width:30%">
                <div style="font-size:28px;font-weight:bold;color:#1e40af">${metrics.healthScore}</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px">Health Score</div>
              </td>
              <td width="4%"></td>
              <td style="text-align:center;padding:12px;background:#f0fdf4;border-radius:12px;width:30%">
                <div style="font-size:28px;font-weight:bold;color:#065f46">${metrics.averageRating} ⭐</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px">Avg Rating</div>
              </td>
              <td width="4%"></td>
              <td style="text-align:center;padding:12px;background:#fff7ed;border-radius:12px;width:30%">
                <div style="font-size:28px;font-weight:bold;color:#c2410c">${metrics.unansweredCount}</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px">Unanswered Reviews</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Pain Points -->
        <tr><td style="padding:0 40px 24px">
          <div style="background:#fef2f2;border-radius:12px;padding:20px">
            <h3 style="color:#991b1b;font-size:15px;margin:0 0 12px">⚠ Customer Pain Points</h3>
            <ul style="margin:0;padding-left:18px">${painPointsHtml}</ul>
          </div>
        </td></tr>
        <!-- What Customers Love -->
        <tr><td style="padding:0 40px 24px">
          <div style="background:#f0fdf4;border-radius:12px;padding:20px">
            <h3 style="color:#065f46;font-size:15px;margin:0 0 12px">✓ What Customers Love</h3>
            <ul style="margin:0;padding-left:18px">${praisesHtml}</ul>
          </div>
        </td></tr>
        <!-- Staff Signals -->
        <tr><td style="padding:0 40px 24px">
          <div style="background:#faf5ff;border-radius:12px;padding:20px">
            <h3 style="color:#5b21b6;font-size:15px;margin:0 0 12px">👥 Staff Performance Signals</h3>
            <ul style="margin:0;padding-left:18px">${staffPositiveHtml}${staffNegativeHtml || "<li style='color:#6b7280'>No negative staff signals detected.</li>"}</ul>
          </div>
        </td></tr>
        <!-- Operational Issues -->
        <tr><td style="padding:0 40px 24px">
          <div style="background:#fffbeb;border-radius:12px;padding:20px">
            <h3 style="color:#92400e;font-size:15px;margin:0 0 12px">⚙ Operational Issues</h3>
            <ul style="margin:0;padding-left:18px">${operationalHtml}</ul>
          </div>
        </td></tr>
        <!-- Sentiment Trend -->
        <tr><td style="padding:0 40px 24px">
          <div style="background:#f8fafc;border-radius:12px;padding:20px">
            <h3 style="color:#0f172a;font-size:15px;margin:0 0 12px">📈 Sentiment Trend (Oldest → Newest)</h3>
            <p style="margin:0;font-size:13px">${sentimentHtml}</p>
          </div>
        </td></tr>
        <!-- Competitor Gap -->
        <tr><td style="padding:0 40px 24px">
          <div style="background:#eff6ff;border-radius:12px;padding:20px">
            <h3 style="color:#1e40af;font-size:15px;margin:0 0 12px">🏆 Competitor Gap Analysis</h3>
            <ul style="margin:0;padding-left:18px">${competitorHtml || "<li style='color:#6b7280'>Competitor data not available for this search.</li>"}</ul>
          </div>
        </td></tr>
        <!-- Do This Now -->
        <tr><td style="padding:0 40px 24px">
          <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);border-radius:12px;padding:20px">
            <h3 style="color:#ffffff;font-size:15px;margin:0 0 8px">⚡ Do This Now</h3>
            <ul style="margin:0;padding-left:18px">${(analysis.doThisNow ?? []).map((item: string) => `<li style="color:#bfdbfe;font-size:14px;margin-bottom:6px">${item}</li>`).join("")}</ul>
          </div>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:24px 40px 32px;text-align:center">
          <p style="color:#64748b;font-size:14px;margin:0 0 16px">Ready to automate your review responses and protect your reputation?</p>
          <a href="https://watchreviews.fourthwatch.com" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">Book a Free Demo Call</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="color:#94a3b8;font-size:12px;margin:0">© ${new Date().getFullYear()} WatchReviews by FourthWatch. This report was generated automatically based on your public Google Business Profile data.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        await sendEmail({
          to: input.email,
          subject: `Your Full Business Intelligence Report — ${input.businessName}`,
          html,
        });

        return { success: true };
      }),

    // Get the saved audit for the current user (by userId or email)
    getMyAudit: publicProcedure
      .input(z.object({
        userId: z.number().optional(),
        email: z.string().email().optional(),
      }))
      .query(async ({ input }) => {
        if (!input.userId && !input.email) return null;
        let row = null;
        if (input.userId) {
          row = await getUserAuditByUserId(input.userId);
        }
        if (!row && input.email) {
          row = await getUserAuditByEmail(input.email);
        }
        if (!row) return null;
        try {
          const parsed = JSON.parse(row.auditJson);
          return {
            id: row.id,
            businessName: row.businessName,
            placeId: row.placeId,
            createdAt: row.createdAt,
            analysis: parsed.analysis,
            metrics: parsed.metrics,
          };
        } catch {
          return null;
        }
      }),
  }),

  onboarding: router({
    // Get reviews for a business without running full AI analysis
    getReviewsOnly: publicProcedure
      .input(z.object({ placeId: z.string() }))
      .mutation(async ({ input }) => {
        const reviews = await getBusinessReviews(input.placeId);
        return {
          reviews: reviews.map((r) => ({
            reviewId: r.reviewId,
            authorName: r.authorName,
            rating: r.rating,
            text: r.text,
            relativeTime: r.relativeTime,
            hasOwnerResponse: reviewHasOwnerResponse(r),
          })),
        };
      }),

    // Generate a demo AI response for a single review
    generateDemoResponse: publicProcedure
      .input(z.object({
        reviewText: z.string(),
        reviewerName: z.string(),
        rating: z.number(),
        businessName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a professional business owner responding to a Google review for ${input.businessName}. Write a warm, professional, and specific response (2-3 sentences max). Do not use generic phrases like 'We appreciate your feedback'. Be genuine and address the specific content of the review.`,
            },
            {
              role: "user",
              content: `Reviewer: ${input.reviewerName}\nRating: ${input.rating}/5 stars\nReview: "${input.reviewText || 'No text — rating only'}"\n\nWrite a response from the business owner.`,
            },
          ],
        });
        const response = result?.choices?.[0]?.message?.content ?? "Thank you for your review! We truly appreciate your feedback and look forward to serving you again soon.";
        return { response };
      }),

    // Send demo approval email + SMS
    sendDemoApproval: publicProcedure
      .input(z.object({
        email: z.string().email(),
        phone: z.string().optional(),
        businessName: z.string(),
        reviewText: z.string(),
        reviewerName: z.string(),
        rating: z.number(),
        demoResponse: z.string(),
      }))
      .mutation(async ({ input }) => {
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h

        // Save demo approval record
        const { demoApprovals } = await import("../drizzle/schema");
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          await db.insert(demoApprovals).values({
            token,
            email: input.email,
            phone: input.phone ?? null,
            businessName: input.businessName,
            reviewText: input.reviewText,
            reviewerName: input.reviewerName,
            rating: input.rating,
            demoResponse: input.demoResponse,
            expiresAt,
          });
        }

        const origin = `https://fourthwatchtech.com`;
        const approveUrl = `${origin}/api/demo/approve?token=${token}`;
        const denyUrl = `${origin}/api/demo/deny?token=${token}`;

        // Send approval email
        const stars = "★".repeat(input.rating) + "☆".repeat(5 - input.rating);
        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px 40px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#ffffff">Watch<span style="color:#60a5fa">Reviews</span></div>
          <div style="color:#94a3b8;font-size:13px;margin-top:4px">by FourthWatch</div>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <h2 style="color:#0f172a;font-size:22px;margin:0 0 8px">Demo Approval Request</h2>
          <p style="color:#64748b;margin:0 0 24px">Here's a real review from <strong>${input.businessName}</strong> and our AI-generated response. Approve or deny it to see how WatchReviews works.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="font-weight:600;color:#0f172a;margin-bottom:4px">${input.reviewerName}</div>
            <div style="color:#f59e0b;font-size:18px;margin-bottom:8px">${stars}</div>
            <p style="color:#374151;margin:0;font-size:14px;line-height:1.6">${input.reviewText || '(Rating only — no text)'}</p>
          </div>
          <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:28px">
            <div style="font-weight:700;color:#1d4ed8;margin-bottom:8px">🤖 WatchReviews AI Response</div>
            <p style="color:#1e40af;margin:0;font-size:14px;line-height:1.6">${input.demoResponse}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48%"><a href="${approveUrl}" style="display:block;background:#16a34a;color:#ffffff;text-align:center;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">✓ Approve Response</a></td>
              <td width="4%"></td>
              <td width="48%"><a href="${denyUrl}" style="display:block;background:#dc2626;color:#ffffff;text-align:center;padding:14px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">✗ Deny Response</a></td>
            </tr>
          </table>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px">This is a demo — no response will actually be posted. Links expire in 24 hours.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="color:#94a3b8;font-size:12px;margin:0">© ${new Date().getFullYear()} WatchReviews by FourthWatch</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        try {
          await sendEmail({ to: input.email, subject: `Demo: Approve or Deny Your AI Response — ${input.businessName}`, html: emailHtml });
        } catch (e) {
          console.error("[Demo] Failed to send approval email:", e);
        }

        // Send SMS if phone provided
        if (input.phone) {
          const snippet = input.reviewText.length > 80 ? input.reviewText.substring(0, 80) + "..." : input.reviewText;
          const smsText = `WatchReviews Demo\n"${snippet}"\n\nOur response: "${input.demoResponse.substring(0, 100)}..."\n\nApprove: ${approveUrl}`;
          try {
            await sendSms(input.phone, smsText);
          } catch (e) {
            console.error("[Demo] Failed to send SMS:", e);
          }
        }

        return { token };
      }),

    // Save brand voice answers from onboarding questionnaire
    saveBrandVoice: publicProcedure
      .input(z.object({
        email: z.string().email(),
        brandTone: z.string(),          // e.g. "Warm & Friendly"
        topPriority: z.string(),        // e.g. "Personal touch"
        avoidPhrases: z.string().optional(),
        mustIncludePhrases: z.string().optional(),
        businessName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Build a businessContext from the questionnaire answers
        const businessContext = [
          input.businessName ? `Business: ${input.businessName}` : null,
          `Brand tone: ${input.brandTone}`,
          `Top priority in responses: ${input.topPriority}`,
        ].filter(Boolean).join(". ");

        // Try to find a user by email and upsert their brand template
        const { getDb } = await import("./db");
        const { users, brandTemplates } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const userRows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
          const user = userRows[0];
          if (user) {
            // Find client for this user
            const { clients } = await import("../drizzle/schema");
            const clientRows = await db.select().from(clients).where(eq(clients.userId, user.id)).limit(1);
            const client = clientRows[0];
            if (client) {
              // Upsert brand template
              const existing = await db.select().from(brandTemplates).where(eq(brandTemplates.clientId, client.id)).limit(1);
              if (existing[0]) {
                await db.update(brandTemplates).set({
                  businessContext,
                  brandVoice: input.brandTone,
                  avoidPhrases: input.avoidPhrases ?? null,
                  mustIncludePhrases: input.mustIncludePhrases ?? null,
                }).where(eq(brandTemplates.clientId, client.id));
              } else {
                await db.insert(brandTemplates).values({
                  clientId: client.id,
                  businessContext,
                  brandVoice: input.brandTone,
                  avoidPhrases: input.avoidPhrases ?? null,
                  mustIncludePhrases: input.mustIncludePhrases ?? null,
                });
              }
              console.log(`[Onboarding] Brand voice saved for client ${client.id}`);
            }
          }
        }

        // Always return success — brand voice is saved if user exists, otherwise it's stored in Stripe metadata
        return { saved: true };
      }),

    // Persist the exact payload from the home-page free audit (no second AI run)
    saveHomeAuditSnapshot: publicProcedure
      .input(z.object({
        placeId: z.string(),
        businessName: z.string(),
        analysis: z.any(),
        metrics: z.any(),
        email: z.string().email().optional(),
        userId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const auditPayload = {
          analysis: input.analysis,
          metrics: input.metrics,
          businessName: input.businessName,
          placeId: input.placeId,
        };
        const auditId = await saveUserAudit({
          userId: input.userId ?? null,
          email: input.email ?? null,
          placeId: input.placeId,
          businessName: input.businessName,
          auditJson: JSON.stringify(auditPayload),
        });
        return { success: true as const, auditId };
      }),

    // Run full AI audit + save to DB (called from onboarding step 2)
    runAndSaveAudit: publicProcedure
      .input(z.object({
        placeId: z.string(),
        businessName: z.string(),
        businessCategory: z.string().optional(),
        businessAddress: z.string().optional(),
        /** Google Places-style total review count — same as free-tool getAuditData for matching metrics */
        totalReviews: z.number().nullable().optional(),
        email: z.string().email().optional(),
        userId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Fetch reviews
          const reviews = await getBusinessReviews(input.placeId);
          // Same competitor shaping as audit.getAuditData
          let competitorNames: string[] = [];
          if (input.businessCategory && input.businessAddress) {
            try {
              const competitors = await getCompetitorReviews(input.businessCategory, input.businessAddress);
              competitorNames = competitors
                .filter((c) => c.name !== input.businessName)
                .slice(0, 3)
                .map((c) => c.name);
            } catch (e) {
              console.warn("[Onboarding] competitor fetch failed:", e);
            }
          }
          // Run AI analysis
          const analysis = await runAIAnalysis(reviews, input.businessName, input.businessCategory ?? null, competitorNames);
          // Match free-tool metrics: use Places total when provided, else fetched count
          const metrics = computeBaseMetrics(reviews, input.totalReviews ?? null);
          // Save to DB
          const auditPayload = { analysis, metrics, businessName: input.businessName, placeId: input.placeId };
          const auditId = await saveUserAudit({
            userId: input.userId ?? null,
            email: input.email ?? null,
            placeId: input.placeId,
            businessName: input.businessName,
            auditJson: JSON.stringify(auditPayload),
          });
          return { success: true, auditId, analysis, metrics };
        } catch (err: any) {
          console.error("[Onboarding] runAndSaveAudit error:", err?.message);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Audit generation failed" });
        }
      }),

    // Link an anonymous audit (by email) to a newly signed-in user
    linkAuditToUser: publicProcedure
      .input(z.object({ email: z.string().email(), userId: z.number() }))
      .mutation(async ({ input }) => {
        await linkAuditToUser(input.email, input.userId);
        return { success: true };
      }),

    // Activate promo access — create a client record so the user gets the full dashboard
    promoActivate: protectedProcedure
      .input(z.object({
        businessName: z.string().min(1).max(255),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Idempotent — if client already exists, just return it
        const existing = await getClientByUserId(ctx.user.id);
        if (existing) return { clientId: existing.id, created: false };
        const id = await createClient({
          userId: ctx.user.id,
          businessName: input.businessName,
          contactEmail: input.email || ctx.user.email || undefined,
          notifyEmail: true,
          notifyTelegram: false,
        });
        // Also link any email-based audit row to this userId
        const emailToLink = input.email || ctx.user.email;
        if (emailToLink) {
          await linkAuditToUser(emailToLink, ctx.user.id);
        }
        return { clientId: id, created: true };
      }),

    // Poll demo approval status
    pollDemoStatus: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        if (!input.token) return { decision: "pending" as const };
        const { demoApprovals } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await import("./db").then((m) => m.getDb());
        if (!db) return { decision: "pending" as const };
        const rows = await db.select().from(demoApprovals).where(eq(demoApprovals.token, input.token)).limit(1);
        const row = rows[0];
        if (!row) return { decision: "pending" as const };
        return { decision: row.decision as "pending" | "approved" | "denied" };
      }),
  }),

  billing: router({
    createCheckout: protectedProcedure
      .input(z.object({ planId: z.enum(["entry", "basic", "legendary"]), trial: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
        const PLAN_PRICES: Record<string, { unit_amount: number; nickname: string }> = {
          entry: { unit_amount: 1999, nickname: "Entry Plan" },
          basic: { unit_amount: 2999, nickname: "Basic Plan" },
          legendary: { unit_amount: 8999, nickname: "Legendary Plan" },
        };
        const plan = PLAN_PRICES[input.planId];
        if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid plan" });
        const origin = ctx.req.headers.origin as string || "https://localhost:3000";
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email ?? "",
            customer_name: ctx.user.name ?? "",
            plan_id: input.planId,
          },
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: plan.nickname },
              unit_amount: plan.unit_amount,
              recurring: { interval: "month" },
            },
            quantity: 1,
          }],
          subscription_data: input.trial ? { trial_period_days: 14 } : undefined,
          success_url: `${origin}/dashboard?checkout=success&plan=${input.planId}`,
          cancel_url: `${origin}/pricing?checkout=cancelled`,
        });
        return { url: session.url, planId: input.planId };
      }),
    createSetupIntent: publicProcedure
      .input(z.object({
        email: z.string().email(),
        planId: z.enum(["entry", "basic", "legendary"]),
        yearly: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

        // Monthly prices in cents
        const MONTHLY_PRICES: Record<string, number> = { entry: 1999, basic: 2999, legendary: 8999 };
        const YEARLY_PRICES: Record<string, number> = { entry: 1599, basic: 2399, legendary: 7199 };
        const unitAmount = input.yearly ? YEARLY_PRICES[input.planId] : MONTHLY_PRICES[input.planId];
        const interval = input.yearly ? ("year" as const) : ("month" as const);

        // Create or retrieve customer
        const customers = await stripe.customers.list({ email: input.email, limit: 1 });
        let customerId = customers.data[0]?.id;
        if (!customerId) {
          const customer = await stripe.customers.create({ email: input.email });
          customerId = customer.id;
        }

        // Create a one-off price for this subscription
        const planName = `WatchReviews ${input.planId.charAt(0).toUpperCase() + input.planId.slice(1)} Plan`;
        const price = await stripe.prices.create({
          currency: "usd",
          unit_amount: unitAmount,
          recurring: { interval },
          product_data: { name: planName },
        });

        // Create a subscription with trial and payment_behavior: default_incomplete
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: price.id }],
          trial_period_days: 14,
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
          metadata: { plan_id: input.planId, yearly: input.yearly ? "true" : "false" },
        });

        const invoice = subscription.latest_invoice as any;
        const paymentIntent = invoice?.payment_intent as any;
        const clientSecret = paymentIntent?.client_secret;

        if (!clientSecret) {
          // Trial subscription with no immediate payment — create a SetupIntent instead
          const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ["card"],
            metadata: { plan_id: input.planId, yearly: input.yearly ? "true" : "false", subscription_id: subscription.id },
          });
          return { clientSecret: setupIntent.client_secret! };
        }

        return { clientSecret };
      }),

    getSubscription: protectedProcedure.query(async ({ ctx }) => {
      const client = await getClientByUserId(ctx.user.id);
      return {
        plan: client?.subscriptionStatus ?? "none",
        clientId: client?.id ?? null,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
