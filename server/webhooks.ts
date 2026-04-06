/**
 * Webhook & Token-based approval handlers
 *
 * Registered as Express routes in server/_core/index.ts:
 *  POST /api/telegram/webhook  — Telegram bot callback
 *  GET  /api/approval/token/:token — Email approve/reject link
 */

import type { Request, Response } from "express";
import {
  answerCallbackQuery,
  sendEditPrompt,
  sendTelegramMessage,
} from "./telegram";
import {
  approveAndPostResponse,
  rejectResponse,
} from "./reviewPipeline";
import { getApprovalToken, getResponseById, markTokenUsed, updateReviewResponse } from "./db";
import { regenerateAIResponse } from "./aiResponse";
import { getBrandTemplate, getClientById, getLocationById, getReviewById } from "./db";

// ─── Telegram webhook handler ─────────────────────────────────────────────────

export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
  // Always respond 200 immediately to Telegram
  res.status(200).json({ ok: true });

  const update = req.body;

  try {
    // Handle callback query (button press)
    if (update.callback_query) {
      const query = update.callback_query;
      const data: string = query.data || "";
      const chatId = String(query.message?.chat?.id);
      const messageId = String(query.message?.message_id);

      await answerCallbackQuery(query.id);

      const [action, idStr] = data.split(":");
      const responseId = parseInt(idStr, 10);
      if (isNaN(responseId)) return;

      if (action === "approve") {
        await approveAndPostResponse(responseId);
      } else if (action === "reject") {
        await rejectResponse(responseId, "Rejected via Telegram");
      } else if (action === "edit") {
        await sendEditPrompt(chatId, responseId);
      }
      return;
    }

    // Handle text message (edit reply)
    if (update.message?.text) {
      const text: string = update.message.text;
      const chatId = String(update.message.chat?.id);

      // Format: EDIT:{responseId}:{new response text}
      if (text.startsWith("EDIT:")) {
        const firstColon = text.indexOf(":", 5);
        if (firstColon === -1) return;
        const responseId = parseInt(text.slice(5, firstColon), 10);
        const newText = text.slice(firstColon + 1).trim();

        if (isNaN(responseId) || !newText) {
          await sendTelegramMessage(chatId, "❌ Invalid format. Use: EDIT:{id}:{response text}");
          return;
        }

        await approveAndPostResponse(responseId, newText);
        await sendTelegramMessage(chatId, `✅ Response edited and posted to Google!\n\nResponse: "${newText}"`);
        return;
      }

      // Handle /regen command: REGEN:{responseId}:{optional instructions}
      if (text.startsWith("REGEN:")) {
        const firstColon = text.indexOf(":", 6);
        const responseId = parseInt(firstColon > -1 ? text.slice(6, firstColon) : text.slice(6), 10);
        const instructions = firstColon > -1 ? text.slice(firstColon + 1).trim() : undefined;

        if (isNaN(responseId)) return;

        const response = await getResponseById(responseId);
        if (!response) {
          await sendTelegramMessage(chatId, "❌ Response not found");
          return;
        }

        const review = await getReviewById(response.reviewId);
        if (!review) return;
        const location = await getLocationById(review.locationId);
        if (!location) return;
        const client = await getClientById(location.clientId);
        if (!client) return;
        const template = await getBrandTemplate(client.id);

        const newDraft = await regenerateAIResponse(
          {
            reviewerName: review.reviewerName || "Customer",
            rating: review.rating,
            comment: review.comment,
            businessName: client.businessName,
            locationName: location.locationName,
          },
          template,
          response.aiDraftResponse || "",
          instructions
        );

        await updateReviewResponse(responseId, { aiDraftResponse: newDraft, finalResponse: newDraft });
        await sendTelegramMessage(
          chatId,
          `🔄 <b>New Draft Generated:</b>\n\n<i>${newDraft}</i>\n\nTo approve: <code>EDIT:${responseId}:${newDraft}</code>`
        );
        return;
      }
    }
  } catch (err) {
    console.error("[Telegram Webhook] Error:", err);
  }
}

// ─── Email token approval handler ────────────────────────────────────────────

export async function handleApprovalToken(req: Request, res: Response): Promise<void> {
  const { token } = req.params;

  try {
    const tokenRecord = await getApprovalToken(token);

    if (!tokenRecord) {
      res.status(400).send(buildHtmlPage("❌ Invalid or Expired Link", "This approval link has already been used or has expired.", "error"));
      return;
    }

    if (Date.now() > tokenRecord.expiresAt) {
      res.status(400).send(buildHtmlPage("⏰ Link Expired", "This approval link has expired. Please use your dashboard to manage this response.", "error"));
      return;
    }

    await markTokenUsed(token);

    if (tokenRecord.action === "approve") {
      await approveAndPostResponse(tokenRecord.reviewResponseId);
      res.send(buildHtmlPage("✅ Response Approved!", "The AI-generated response has been posted to Google Business Profile.", "success"));
    } else if (tokenRecord.action === "reject") {
      await rejectResponse(tokenRecord.reviewResponseId, "Rejected via email link");
      res.send(buildHtmlPage("❌ Response Rejected", "The response has been rejected. The client will respond manually.", "info"));
    } else {
      res.status(400).send(buildHtmlPage("❌ Unknown Action", "Invalid approval action.", "error"));
    }
  } catch (err) {
    console.error("[Approval Token] Error:", err);
    res.status(500).send(buildHtmlPage("⚠️ Error", "An error occurred processing your request. Please try again or use your dashboard.", "error"));
  }
}

// ─── HTML response page ───────────────────────────────────────────────────────

function buildHtmlPage(title: string, message: string, type: "success" | "error" | "info"): string {
  const colors = {
    success: { bg: "#f0fdf4", border: "#22c55e", icon: "✅" },
    error: { bg: "#fef2f2", border: "#ef4444", icon: "❌" },
    info: { bg: "#eff6ff", border: "#3b82f6", icon: "ℹ️" },
  }[type];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — WatchReviews</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:480px;width:90%;background:#fff;border-radius:16px;padding:48px 40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-top:4px solid ${colors.border};">
    <div style="font-size:48px;margin-bottom:16px;">${colors.icon}</div>
    <h1 style="margin:0 0 12px;font-size:24px;color:#1a1a1a;">${title}</h1>
    <p style="margin:0 0 32px;font-size:16px;color:#555;line-height:1.6;">${message}</p>
    <a href="/" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
      Go to Dashboard
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#999;">WatchReviews by FourthWatch — AI-Powered Review Management</p>
  </div>
</body>
</html>`;
}
