/**
 * AI Response Generation Service
 *
 * Uses OpenAI (ChatGPT API) to generate contextual, professional
 * responses to Google reviews based on:
 *  - Star rating
 *  - Review text
 *  - Business context
 *  - Brand voice guidelines
 *  - Response templates per rating tier
 */

import { invokeLLM } from "./_core/llm";
import type { BrandTemplate } from "../drizzle/schema";

export interface ReviewContext {
  reviewerName: string;
  rating: number; // 1–5
  comment: string | null;
  businessName: string;
  locationName: string;
}

function buildSystemPrompt(template: BrandTemplate | undefined, businessName: string): string {
  const parts: string[] = [
    `You are a professional customer response specialist for "${businessName}".`,
    `Your job is to write genuine, helpful, and on-brand responses to Google reviews.`,
    ``,
    `CRITICAL RULES:`,
    `- Keep responses between 50–150 words`,
    `- Never be defensive, even for negative reviews`,
    `- Always thank the reviewer`,
    `- Use the reviewer's first name when available`,
    `- Sound human and authentic, never robotic or templated`,
    `- Do NOT use excessive exclamation marks`,
    `- Do NOT start with "Thank you for your review" every time — vary the opening`,
    `- Return ONLY the response text, no preamble or explanation`,
  ];

  if (template?.brandVoice) {
    parts.push(``, `BRAND VOICE: ${template.brandVoice}`);
  }

  if (template?.toneGuidelines) {
    parts.push(`TONE GUIDELINES: ${template.toneGuidelines}`);
  }

  if (template?.businessContext) {
    parts.push(`BUSINESS CONTEXT: ${template.businessContext}`);
  }

  if (template?.avoidPhrases) {
    parts.push(`AVOID THESE PHRASES: ${template.avoidPhrases}`);
  }

  if (template?.mustIncludePhrases) {
    parts.push(`ALWAYS INCLUDE: ${template.mustIncludePhrases}`);
  }

  return parts.join("\n");
}

function getRatingTier(rating: number): string {
  if (rating === 5) return "5";
  if (rating === 4) return "4";
  if (rating === 3) return "3";
  return "1-2";
}

function buildUserPrompt(
  review: ReviewContext,
  template: BrandTemplate | undefined
): string {
  const tier = getRatingTier(review.rating);

  // Check for a custom template for this rating tier
  const responseTemplates = template?.responseTemplates as Record<string, string> | null;
  const tierTemplate = responseTemplates?.[tier];

  const ratingStars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const commentText = review.comment?.trim() || "(No written comment — rating only)";

  let prompt = `Write a Google review response for the following review:

Business: ${review.businessName} — ${review.locationName}
Reviewer: ${review.reviewerName || "A customer"}
Rating: ${review.rating}/5 ${ratingStars}
Review: "${commentText}"`;

  if (tierTemplate) {
    prompt += `\n\nUse this template as a starting point but personalize it for this specific review:\n"${tierTemplate}"`;
  }

  if (review.rating <= 2) {
    prompt += `\n\nThis is a negative review. Be empathetic, apologize sincerely, and offer to make it right. Invite them to contact us directly to resolve the issue.`;
  } else if (review.rating === 3) {
    prompt += `\n\nThis is a mixed review. Acknowledge both the positives and areas for improvement. Show you take feedback seriously.`;
  } else {
    prompt += `\n\nThis is a positive review. Express genuine gratitude and reinforce what they loved about the experience.`;
  }

  return prompt;
}

export async function generateAIResponse(
  review: ReviewContext,
  template?: BrandTemplate
): Promise<string> {
  const systemPrompt = buildSystemPrompt(template, review.businessName);
  const userPrompt = buildUserPrompt(review, template);

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("LLM returned empty response");

  return content.trim();
}

export async function regenerateAIResponse(
  review: ReviewContext,
  template: BrandTemplate | undefined,
  previousDraft: string,
  editInstructions?: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(template, review.businessName);

  const userPrompt = `${buildUserPrompt(review, template)}

PREVIOUS DRAFT (do not repeat this):
"${previousDraft}"

${editInstructions ? `EDIT INSTRUCTIONS: ${editInstructions}` : "Please generate a fresh, different response."}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent2 = response?.choices?.[0]?.message?.content;
  const content2 = typeof rawContent2 === "string" ? rawContent2 : null;
  if (!content2) throw new Error("LLM returned empty response");

  return content2.trim();
}
