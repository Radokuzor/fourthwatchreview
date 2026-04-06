/**
 * Review Pipeline Orchestrator
 *
 * Coordinates the full review processing pipeline:
 * 1. Poll GBP API for new reviews across all active locations
 * 2. Store new reviews in DB
 * 3. Generate AI draft responses
 * 4. Send for approval via Telegram + email
 * 5. On approval: post reply to GBP
 * 6. On rejection: mark for manual response
 *
 * Also handles the scheduled polling job (every 15 minutes).
 */

import {
  getAllActiveLocations,
  getClientById,
  getBrandTemplate,
  createReviewResponse,
  getResponseByReviewId,
  getResponseById,
  updateReviewResponse,
  updateReviewStatus,
  updateLocation,
  upsertReview,
  getReviewById,
  getLocationById,
} from "./db";
import {
  fetchReviews,
  getValidToken,
  postReviewReply,
  starRatingToNumber,
  refreshAccessToken,
} from "./gbp";
import { generateAIResponse } from "./aiResponse";
import { sendReviewApprovalMessage, sendApprovalConfirmation } from "./telegram";
import { sendApprovalEmail } from "./emailService";

// ─── Poll all active locations for new reviews ────────────────────────────────

export async function pollAllLocations(): Promise<void> {
  console.log("[Pipeline] Starting review poll for all active locations...");
  const activeLocations = await getAllActiveLocations();
  console.log(`[Pipeline] Found ${activeLocations.length} active locations`);

  for (const location of activeLocations) {
    try {
      await pollLocationReviews(location.id);
    } catch (err) {
      console.error(`[Pipeline] Error polling location ${location.id}:`, err);
    }
  }

  console.log("[Pipeline] Poll complete");
}

// ─── Poll a single location ───────────────────────────────────────────────────

export async function pollLocationReviews(locationId: number): Promise<void> {
  const location = await getLocationById(locationId);
  if (!location || !location.isActive) return;
  if (!location.googleAccountId || !location.googleLocationId) {
    console.log(`[Pipeline] Location ${locationId} missing GBP IDs, skipping`);
    return;
  }

  let accessToken: string;
  try {
    accessToken = await getValidToken(location);
  } catch (err) {
    console.error(`[Pipeline] Cannot get token for location ${locationId}:`, err);
    return;
  }

  // Refresh OAuth token if needed and save
  if (location.onboardingPath === "oauth" && location.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(location.refreshToken);
      await updateLocation(locationId, {
        accessToken: refreshed.accessToken,
        tokenExpiresAt: refreshed.expiresAt,
      });
      accessToken = refreshed.accessToken;
    } catch {
      // Use existing token
    }
  }

  const { reviews: gbpReviews } = await fetchReviews(
    accessToken,
    location.googleAccountId,
    location.googleLocationId
  );

  let newCount = 0;
  for (const gbpReview of gbpReviews) {
    // Skip reviews that already have a reply on Google
    if (gbpReview.reviewReply) continue;

    const rating = starRatingToNumber(gbpReview.starRating);
    const publishedAt = new Date(gbpReview.createTime).getTime();

    const savedReview = await upsertReview({
      locationId,
      googleReviewId: gbpReview.reviewId,
      reviewerName: gbpReview.reviewer?.displayName || "Anonymous",
      reviewerPhotoUrl: gbpReview.reviewer?.profilePhotoUrl,
      rating,
      comment: gbpReview.comment || null,
      publishedAt,
      status: "new",
    });

    if (!savedReview) continue;

    // Only process truly new reviews (status = 'new')
    if (savedReview.status !== "new") continue;

    newCount++;
    await processNewReview(savedReview.id, location.clientId).catch((err) =>
      console.error(`[Pipeline] Error processing review ${savedReview.id}:`, err)
    );
  }

  await updateLocation(locationId, { lastPolledAt: new Date() });
  if (newCount > 0) {
    console.log(`[Pipeline] Location ${locationId}: processed ${newCount} new reviews`);
  }
}

// ─── Process a single new review ─────────────────────────────────────────────

export async function processNewReview(reviewId: number, clientId: number): Promise<void> {
  const review = await getReviewById(reviewId);
  if (!review) return;

  const client = await getClientById(clientId);
  if (!client) return;

  const location = await getLocationById(review.locationId);
  if (!location) return;

  const template = await getBrandTemplate(clientId);

  // Mark as processing
  await updateReviewStatus(reviewId, "processing");

  // Generate AI draft
  let aiDraft: string;
  try {
    aiDraft = await generateAIResponse(
      {
        reviewerName: review.reviewerName || "Customer",
        rating: review.rating,
        comment: review.comment,
        businessName: client.businessName,
        locationName: location.locationName,
      },
      template
    );
  } catch (err) {
    console.error(`[Pipeline] AI generation failed for review ${reviewId}:`, err);
    await updateReviewStatus(reviewId, "new"); // reset for retry
    return;
  }

  // Save draft response
  const responseId = await createReviewResponse({
    reviewId,
    aiDraftResponse: aiDraft,
    finalResponse: aiDraft,
    status: "pending_approval",
  });

  await updateReviewStatus(reviewId, "pending_approval");

  // Determine base URL for email links
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  // Send Telegram notification
  let telegramMessageId: string | undefined;
  if (client.notifyTelegram && (client.telegramChatId || process.env.TELEGRAM_OWNER_CHAT_ID)) {
    try {
      telegramMessageId = await sendReviewApprovalMessage({
        responseId,
        reviewId,
        businessName: client.businessName,
        locationName: location.locationName,
        reviewerName: review.reviewerName || "Anonymous",
        rating: review.rating,
        reviewComment: review.comment,
        aiDraft,
        chatId: client.telegramChatId || undefined,
      });
    } catch (err) {
      console.error(`[Pipeline] Telegram notification failed:`, err);
    }
  }

  // Send email notification
  const emailRecipient = client.approvalEmail || client.contactEmail;
  if (client.notifyEmail && emailRecipient) {
    try {
      await sendApprovalEmail({
        to: emailRecipient,
        responseId,
        businessName: client.businessName,
        locationName: location.locationName,
        reviewerName: review.reviewerName || "Anonymous",
        rating: review.rating,
        reviewComment: review.comment,
        aiDraft,
        baseUrl,
      });
    } catch (err) {
      console.error(`[Pipeline] Email notification failed:`, err);
    }
  }

  // Save telegram message ID for later editing
  if (telegramMessageId) {
    await updateReviewResponse(responseId, { telegramMessageId });
  }
}

// ─── Approve and post a response ──────────────────────────────────────────────

export async function approveAndPostResponse(
  responseId: number,
  finalText?: string
): Promise<void> {
  const response = await getResponseById(responseId);
  if (!response) throw new Error("Response not found");

  const review = await getReviewById(response.reviewId);
  if (!review) throw new Error("Review not found");

  const location = await getLocationById(review.locationId);
  if (!location) throw new Error("Location not found");

  const client = await getClientById(location.clientId);
  if (!client) throw new Error("Client not found");

  const replyText = finalText || response.finalResponse || response.aiDraftResponse;
  if (!replyText) throw new Error("No response text available");

  // Post to Google
  const accessToken = await getValidToken(location);
  await postReviewReply(
    accessToken,
    location.googleAccountId!,
    location.googleLocationId!,
    review.googleReviewId,
    replyText
  );

  // Update DB
  const now = Date.now();
  await updateReviewResponse(responseId, {
    finalResponse: replyText,
    status: "posted",
    approvedAt: now,
    postedAt: now,
  });
  await updateReviewStatus(review.id, "posted");

  // Update Telegram message
  if (response.telegramMessageId) {
    const chatId = client.telegramChatId || process.env.TELEGRAM_OWNER_CHAT_ID;
    if (chatId) {
      await sendApprovalConfirmation(
        chatId,
        response.telegramMessageId,
        client.businessName,
        finalText ? "edited" : "approved"
      ).catch(() => {});
    }
  }
}

// ─── Reject a response ────────────────────────────────────────────────────────

export async function rejectResponse(responseId: number, reason?: string): Promise<void> {
  const response = await getResponseById(responseId);
  if (!response) throw new Error("Response not found");

  const review = await getReviewById(response.reviewId);
  if (!review) throw new Error("Review not found");

  const location = await getLocationById(review.locationId);
  const client = location ? await getClientById(location.clientId) : null;

  await updateReviewResponse(responseId, {
    status: "rejected",
    rejectedAt: Date.now(),
    rejectedReason: reason || "Rejected by owner",
  });
  await updateReviewStatus(review.id, "manual");

  // Update Telegram message
  if (response.telegramMessageId && client) {
    const chatId = client.telegramChatId || process.env.TELEGRAM_OWNER_CHAT_ID;
    if (chatId) {
      await sendApprovalConfirmation(chatId, response.telegramMessageId, client.businessName, "rejected").catch(() => {});
    }
  }
}

// ─── Scheduled polling job ────────────────────────────────────────────────────

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startPollingJob(intervalMs = 15 * 60 * 1000): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  console.log(`[Pipeline] Starting polling job every ${intervalMs / 1000 / 60} minutes`);

  // Run immediately on startup
  pollAllLocations().catch(console.error);

  pollingInterval = setInterval(() => {
    pollAllLocations().catch(console.error);
  }, intervalMs);
}

export function stopPollingJob(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[Pipeline] Polling job stopped");
  }
}
