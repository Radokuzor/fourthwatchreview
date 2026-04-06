/**
 * Telegram Bot Service
 *
 * Sends AI-drafted review responses to the platform owner for approval.
 * Uses inline keyboard buttons: ✅ Approve | ✏️ Edit | ❌ Reject
 *
 * Webhook endpoint: POST /api/telegram/webhook
 * The bot token is stored in TELEGRAM_BOT_TOKEN env var.
 * The owner's chat ID is stored in TELEGRAM_OWNER_CHAT_ID env var.
 */

import axios from "axios";

const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  return token;
}

function getOwnerChatId(): string {
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!chatId) throw new Error("TELEGRAM_OWNER_CHAT_ID not configured");
  return chatId;
}

// ─── Send a message ───────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: object
): Promise<{ messageId: string }> {
  const token = getBotToken();
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  const res = await axios.post(`${TELEGRAM_API}/bot${token}/sendMessage`, payload);
  return { messageId: String(res.data.result.message_id) };
}

// ─── Edit an existing message ─────────────────────────────────────────────────

export async function editTelegramMessage(
  chatId: string,
  messageId: string,
  text: string,
  replyMarkup?: object
): Promise<void> {
  const token = getBotToken();
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  await axios.post(`${TELEGRAM_API}/bot${token}/editMessageText`, payload);
}

// ─── Answer a callback query ──────────────────────────────────────────────────

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = getBotToken();
  await axios.post(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
    text: text || "✅ Done",
    show_alert: false,
  });
}

// ─── Send review approval message ────────────────────────────────────────────

export interface ReviewApprovalPayload {
  responseId: number;
  reviewId: number;
  businessName: string;
  locationName: string;
  reviewerName: string;
  rating: number;
  reviewComment: string | null;
  aiDraft: string;
  chatId?: string; // defaults to owner chat
}

export async function sendReviewApprovalMessage(payload: ReviewApprovalPayload): Promise<string> {
  const chatId = payload.chatId || getOwnerChatId();
  const stars = "⭐".repeat(payload.rating) + "☆".repeat(5 - payload.rating);
  const comment = payload.reviewComment?.trim() || "(No written comment)";

  const text = [
    `🔔 <b>New Review — Action Required</b>`,
    ``,
    `🏢 <b>${payload.businessName}</b> — ${payload.locationName}`,
    `👤 <b>${payload.reviewerName || "Anonymous"}</b>  ${stars}`,
    ``,
    `📝 <b>Review:</b>`,
    `<i>${escapeHtml(comment)}</i>`,
    ``,
    `🤖 <b>AI Draft Response:</b>`,
    `<i>${escapeHtml(payload.aiDraft)}</i>`,
    ``,
    `Choose an action below:`,
  ].join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "✅ Approve & Post", callback_data: `approve:${payload.responseId}` },
        { text: "✏️ Edit Draft", callback_data: `edit:${payload.responseId}` },
      ],
      [
        { text: "❌ Reject (Client responds)", callback_data: `reject:${payload.responseId}` },
      ],
    ],
  };

  const { messageId } = await sendTelegramMessage(chatId, text, replyMarkup);
  return messageId;
}

// ─── Send approval confirmation ───────────────────────────────────────────────

export async function sendApprovalConfirmation(
  chatId: string,
  messageId: string,
  businessName: string,
  status: "approved" | "rejected" | "edited"
): Promise<void> {
  const statusText = {
    approved: "✅ Response approved and posted to Google!",
    rejected: "❌ Response rejected. Client will respond manually.",
    edited: "✏️ Response edited and posted to Google!",
  }[status];

  await editTelegramMessage(chatId, messageId, `${statusText}\n\n🏢 ${businessName}`);
}

// ─── Send edit prompt ─────────────────────────────────────────────────────────

export async function sendEditPrompt(chatId: string, responseId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `✏️ <b>Edit Mode</b>\n\nPlease reply with your edited response for review #${responseId}.\n\nFormat: <code>EDIT:${responseId}:Your new response text here</code>`
  );
}

// ─── Register webhook ─────────────────────────────────────────────────────────

export async function registerTelegramWebhook(webhookUrl: string): Promise<void> {
  const token = getBotToken();
  await axios.post(`${TELEGRAM_API}/bot${token}/setWebhook`, {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
  });
  console.log(`[Telegram] Webhook registered: ${webhookUrl}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
