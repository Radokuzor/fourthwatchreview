/**
 * Email Notification Service
 *
 * Sends HTML approval emails with one-click Approve / Reject links via SMTP (Nodemailer).
 */

import nodemailer from "nodemailer";
import { nanoid } from "nanoid";
import { createApprovalToken } from "./db";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendEmailSmtp(to: string, subject: string, html: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[Email] SMTP not configured — would send to ${to}: ${subject}`);
    return false;
  }
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@localhost";
  try {
    await transporter.sendMail({ from, to, subject, html });
    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}

// ─── Generate approval tokens ─────────────────────────────────────────────────

export async function generateApprovalLinks(
  responseId: number,
  baseUrl: string
): Promise<{ approveUrl: string; rejectUrl: string }> {
  const approveToken = nanoid(32);
  const rejectToken = nanoid(32);
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

  await createApprovalToken({ reviewResponseId: responseId, token: approveToken, action: "approve", expiresAt });
  await createApprovalToken({ reviewResponseId: responseId, token: rejectToken, action: "reject", expiresAt });

  return {
    approveUrl: `${baseUrl}/api/approval/token/${approveToken}`,
    rejectUrl: `${baseUrl}/api/approval/token/${rejectToken}`,
  };
}

// ─── Build approval email HTML ────────────────────────────────────────────────

function buildApprovalEmailHtml(params: {
  businessName: string;
  locationName: string;
  reviewerName: string;
  rating: number;
  reviewComment: string | null;
  aiDraft: string;
  approveUrl: string;
  rejectUrl: string;
  dashboardUrl: string;
}): string {
  const stars = "★".repeat(params.rating) + "☆".repeat(5 - params.rating);
  const comment = params.reviewComment?.trim() || "(No written comment — rating only)";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Review Response Approval — WatchReviews</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🔔 New Review Needs Your Approval</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">WatchReviews by FourthWatch — AI-Powered Review Management</p>
    </div>

    <!-- Content -->
    <div style="padding:32px 40px;">
      <!-- Business info -->
      <div style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Business</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:#1a1a1a;">${params.businessName}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#555;">${params.locationName}</p>
      </div>

      <!-- Review -->
      <div style="margin-bottom:24px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#333;">📝 Customer Review</h2>
        <div style="border-left:4px solid #e8eaed;padding:12px 16px;background:#fafafa;border-radius:0 8px 8px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#555;">
            <strong>${params.reviewerName || "Anonymous"}</strong> &nbsp;
            <span style="color:#f4b400;font-size:16px;">${stars}</span>
          </p>
          <p style="margin:0;font-size:15px;color:#333;line-height:1.6;font-style:italic;">"${comment}"</p>
        </div>
      </div>

      <!-- AI Draft -->
      <div style="margin-bottom:32px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#333;">🤖 AI-Generated Response Draft</h2>
        <div style="border:2px solid #1a73e8;border-radius:8px;padding:16px 20px;background:#f0f7ff;">
          <p style="margin:0;font-size:15px;color:#1a1a1a;line-height:1.7;">${params.aiDraft}</p>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${params.approveUrl}" style="display:inline-block;background:#34a853;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;margin:0 8px 12px;">
          ✅ Approve &amp; Post
        </a>
        <a href="${params.rejectUrl}" style="display:inline-block;background:#ea4335;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;margin:0 8px 12px;">
          ❌ Reject
        </a>
      </div>

      <p style="text-align:center;margin:0;">
        <a href="${params.dashboardUrl}" style="color:#1a73e8;font-size:13px;text-decoration:none;">
          Or edit the response in your dashboard →
        </a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #e8eaed;">
      <p style="margin:0;font-size:12px;color:#999;text-align:center;">
        This email was sent by WatchReviews. Approval links expire in 48 hours.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Main send function ───────────────────────────────────────────────────────

export interface ApprovalEmailParams {
  to: string;
  responseId: number;
  businessName: string;
  locationName: string;
  reviewerName: string;
  rating: number;
  reviewComment: string | null;
  aiDraft: string;
  baseUrl: string;
}

export async function sendApprovalEmail(params: ApprovalEmailParams): Promise<boolean> {
  const { approveUrl, rejectUrl } = await generateApprovalLinks(params.responseId, params.baseUrl);
  const dashboardUrl = `${params.baseUrl}/dashboard`;

  const html = buildApprovalEmailHtml({
    businessName: params.businessName,
    locationName: params.locationName,
    reviewerName: params.reviewerName,
    rating: params.rating,
    reviewComment: params.reviewComment,
    aiDraft: params.aiDraft,
    approveUrl,
    rejectUrl,
    dashboardUrl,
  });

  const subject = `[Action Required] New ${params.rating}★ review from ${params.reviewerName || "a customer"} — ${params.businessName}`;

  return sendEmailSmtp(params.to, subject, html);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Admin / owner alerts from system.notifyOwner — uses APPROVAL_EMAIL or SMTP_USER as recipient. */
export async function sendOwnerNotificationEmail(
  title: string,
  plainBody: string
): Promise<boolean> {
  const to =
    process.env.APPROVAL_EMAIL?.trim() || process.env.SMTP_USER?.trim();
  if (!to) {
    console.warn(
      "[Email] Owner notification skipped — set APPROVAL_EMAIL or SMTP_USER"
    );
    return false;
  }
  const subject = `[ReviewPilot] ${title}`;
  const html = `<div style="font-family:-apple-system,sans-serif;font-size:15px;line-height:1.5;">
<p style="margin:0 0 12px;font-weight:600;">${escapeHtml(title)}</p>
<p style="margin:0;white-space:pre-wrap;">${escapeHtml(plainBody)}</p>
</div>`;
  return sendEmailSmtp(to, subject, html);
}
