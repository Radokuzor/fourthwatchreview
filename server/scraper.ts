import axios from "axios";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";

const SCRAPINGDOG_BASE = "https://api.scrapingdog.com";

export type BusinessResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  totalReviews: number | null;
  category: string | null;
  phone: string | null;
  website: string | null;
};

export type ReviewResult = {
  reviewId: string;
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  ownerResponse: string | null;
};

export type StaffSignal = {
  name: string;
  sentiment: "positive" | "negative";
  mentions: number;
  context: string;
};

export type AuditAnalysis = {
  painPoints: string[];          // 3-4 specific pain points from actual review text
  topPraises: string[];          // 3-4 specific praises from actual review text
  staffSignals: StaffSignal[];   // Staff names mentioned + sentiment
  operationalIssues: string[];   // Operational patterns (parking, wait times, out-of-stock, etc.)
  doThisNow: string[];           // 1-2 specific actionable suggestions based on reviews + industry
  sentimentTrend: {
    oldestFour: number;          // avg rating of oldest 4 reviews (0-100 scale)
    newestFour: number;          // avg rating of newest 4 reviews (0-100 scale)
    direction: "improving" | "declining" | "stable";
    summary: string;
  };
  competitorKeywordGap: string[]; // What competitors are praised for that this business isn't
};

export type AuditData = {
  business: BusinessResult;
  reviews: ReviewResult[];
  metrics: {
    totalReviews: number;
    averageRating: number;
    responseRate: number;
    unansweredCount: number;
    sentimentScore: number;
    healthScore: number;
    reviewVelocity: string;
    competitorBenchmark: string;
  };
  analysis: AuditAnalysis;
};

/**
 * Search for businesses by name using ScrapingDog Google Maps API
 */
export async function searchBusinesses(query: string): Promise<BusinessResult[]> {
  try {
    const response = await axios.get(`${SCRAPINGDOG_BASE}/google_maps`, {
      params: {
        api_key: ENV.scrapingDogApiKey,
        query: query,
        type: "search",
      },
      timeout: 20000,
    });

    const data = response.data;
    const rawResults = data?.search_results ?? [];

    if (!Array.isArray(rawResults) || rawResults.length === 0) {
      console.warn("[Scraper] searchBusinesses: no search_results in response", Object.keys(data));
      return [];
    }

    const results: BusinessResult[] = [];
    for (const item of rawResults.slice(0, 6)) {
      const placeId = item.data_id ?? item.place_id ?? "";
      if (!placeId) continue;
      results.push({
        placeId,
        name: item.title ?? item.name ?? "Unknown Business",
        address: item.address ?? "",
        rating: item.rating ? parseFloat(String(item.rating)) : null,
        totalReviews: item.reviews ? parseInt(String(item.reviews)) : null,
        category: item.type ?? item.category ?? null,
        phone: item.phone ?? null,
        website: item.website ?? null,
      });
    }

    return results;
  } catch (error: any) {
    console.error("[Scraper] searchBusinesses error:", error?.response?.status, error?.message);
    return [];
  }
}

/**
 * Get reviews for a business — sorted by newest first
 */
export async function getBusinessReviews(dataId: string): Promise<ReviewResult[]> {
  try {
    const response = await axios.get(`${SCRAPINGDOG_BASE}/google_maps/reviews`, {
      params: {
        api_key: ENV.scrapingDogApiKey,
        data_id: dataId,
        sort_by: "newestFirst",
      },
      timeout: 20000,
    });

    const data = response.data;
    const rawReviews = data?.reviews_results ?? [];

    const reviews: ReviewResult[] = [];
    for (const r of rawReviews) {
      reviews.push({
        reviewId: r.review_id ?? r.id ?? String(Math.random()),
        authorName: r.user?.name ?? r.author_name ?? "Anonymous",
        rating: typeof r.rating === "number" ? r.rating : parseInt(String(r.rating ?? "3")),
        text: r.snippet ?? r.text ?? r.description ?? "",
        relativeTime: r.date ?? r.relative_time ?? "recently",
        ownerResponse: r.response?.response_from_owner_string ?? r.owner_answer ?? null,
      });
    }

    return reviews;
  } catch (error: any) {
    console.error("[Scraper] getBusinessReviews error:", error?.response?.status, error?.message);
    return [];
  }
}

/**
 * Fetch top 3 competitors in the same category and city
 */
export async function getCompetitorReviews(category: string, address: string): Promise<BusinessResult[]> {
  try {
    // Extract city from address (last 2 parts usually city, state)
    const cityParts = address.split(",").slice(-2).join(",").trim();
    const query = `${category} ${cityParts}`;

    const response = await axios.get(`${SCRAPINGDOG_BASE}/google_maps`, {
      params: {
        api_key: ENV.scrapingDogApiKey,
        query,
        type: "search",
      },
      timeout: 20000,
    });

    const rawResults = response.data?.search_results ?? [];
    return rawResults.slice(0, 4).map((item: any) => ({
      placeId: item.data_id ?? item.place_id ?? "",
      name: item.title ?? "Unknown",
      address: item.address ?? "",
      rating: item.rating ? parseFloat(String(item.rating)) : null,
      totalReviews: item.reviews ? parseInt(String(item.reviews)) : null,
      category: item.type ?? null,
      phone: null,
      website: null,
    })).filter((b: BusinessResult) => b.placeId);
  } catch (error: any) {
    console.error("[Scraper] getCompetitorReviews error:", error?.message);
    return [];
  }
}

/**
 * Compute unanswered count using the "highest number" rule:
 * - If total > 100: use max(actual, 45% of total)
 * - If total > 20: use max(actual, 10)
 * - Otherwise: use actual
 */
export function computeUnansweredCount(actualUnanswered: number, totalReviews: number): number {
  if (totalReviews > 100) {
    const fortyFivePercent = Math.round(totalReviews * 0.45);
    return Math.max(actualUnanswered, fortyFivePercent);
  }
  if (totalReviews > 20) {
    return Math.max(actualUnanswered, 10);
  }
  return actualUnanswered;
}

/**
 * Compute sentiment trend: compare oldest 4 vs newest 4 reviews
 */
export function computeSentimentTrend(reviews: ReviewResult[]): AuditAnalysis["sentimentTrend"] {
  if (reviews.length < 4) {
    return {
      oldestFour: 60,
      newestFour: 60,
      direction: "stable",
      summary: "Not enough reviews to determine trend",
    };
  }

  // Reviews are sorted newest first from API
  const newest4 = reviews.slice(0, 4);
  const oldest4 = reviews.slice(-4);

  const toScore = (rs: ReviewResult[]) =>
    Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length / 5) * 100);

  const newestScore = toScore(newest4);
  const oldestScore = toScore(oldest4);
  const diff = newestScore - oldestScore;

  let direction: "improving" | "declining" | "stable";
  let summary: string;

  if (diff >= 10) {
    direction = "improving";
    summary = `Sentiment is trending up — recent customers are ${diff} points happier than before`;
  } else if (diff <= -10) {
    direction = "declining";
    summary = `Sentiment is declining — recent reviews are ${Math.abs(diff)} points lower than older ones`;
  } else {
    direction = "stable";
    summary = "Sentiment is consistent — customer experience is steady";
  }

  return { oldestFour: oldestScore, newestFour: newestScore, direction, summary };
}

/**
 * Run AI-powered analysis on reviews — industry-specific, non-generic
 */
export async function runAIAnalysis(
  reviews: ReviewResult[],
  businessName: string,
  category: string | null,
  competitorNames: string[]
): Promise<AuditAnalysis> {
  if (reviews.length === 0) {
    return {
      painPoints: ["No reviews available to analyze"],
      topPraises: ["No reviews available to analyze"],
      staffSignals: [],
      operationalIssues: [],
      doThisNow: ["Claim your Google Business Profile and start collecting reviews"],
      sentimentTrend: { oldestFour: 50, newestFour: 50, direction: "stable", summary: "No data" },
      competitorKeywordGap: [],
    };
  }

  const industry = category ?? "local business";
  const reviewText = reviews
    .slice(0, 20)
    .map((r, i) => `Review ${i + 1} (${r.rating}★, ${r.relativeTime}${r.ownerResponse ? ", owner replied" : ", NO reply"}): "${r.text}"`)
    .join("\n");

  const prompt = `You are a business intelligence analyst specializing in the ${industry} industry.

Analyze these real customer reviews for "${businessName}" (a ${industry}) and extract SPECIFIC, ACTIONABLE insights. 
Do NOT give generic advice. Every insight must reference something actually mentioned in the reviews.

REVIEWS:
${reviewText}

${competitorNames.length > 0 ? `COMPETITORS IN THE AREA: ${competitorNames.join(", ")}` : ""}

Return a JSON object with EXACTLY this structure:
{
  "painPoints": [
    "3-4 specific pain points customers actually complained about — quote or paraphrase real review content, be specific to this ${industry}"
  ],
  "topPraises": [
    "3-4 specific things customers genuinely praised — must be DIFFERENT from pain points, quote real content"
  ],
  "staffSignals": [
    {
      "name": "actual staff name mentioned in reviews, or 'Staff member' if unnamed",
      "sentiment": "positive or negative",
      "mentions": number_of_times_mentioned,
      "context": "brief quote or paraphrase of what was said about them"
    }
  ],
  "operationalIssues": [
    "2-3 specific operational patterns: parking, wait times, hours, inventory, app issues, etc. — only if actually mentioned"
  ],
  "doThisNow": [
    "1-2 hyper-specific suggestions based on what customers actually said, relevant to a ${industry}. Example: 'Extend Friday hours to 11pm — 3 customers mentioned leaving because you were closed' or 'Train front-of-house staff on greeting — 4 reviews mention feeling ignored on arrival'"
  ],
  "competitorKeywordGap": [
    "2-3 things that ${competitorNames.length > 0 ? "competitors like " + competitorNames.slice(0, 2).join(" and ") + " are" : "top-rated competitors in this area are"} commonly praised for that ${businessName} is NOT mentioned for in these reviews"
  ]
}

Rules:
- staffSignals: only include if a real name or clear staff reference appears in reviews. Empty array if none.
- operationalIssues: only include if genuinely mentioned. Empty array if none.
- Every pain point and praise must be DIFFERENT — no overlap.
- Be specific to the ${industry} industry context.
- Keep each string under 80 characters.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a business intelligence analyst. Return only valid JSON, no markdown." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "audit_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              painPoints: { type: "array", items: { type: "string" } },
              topPraises: { type: "array", items: { type: "string" } },
              staffSignals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    sentiment: { type: "string" },
                    mentions: { type: "number" },
                    context: { type: "string" },
                  },
                  required: ["name", "sentiment", "mentions", "context"],
                  additionalProperties: false,
                },
              },
              operationalIssues: { type: "array", items: { type: "string" } },
              doThisNow: { type: "array", items: { type: "string" } },
              competitorKeywordGap: { type: "array", items: { type: "string" } },
            },
            required: ["painPoints", "topPraises", "staffSignals", "operationalIssues", "doThisNow", "competitorKeywordGap"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from LLM");

    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    const sentimentTrend = computeSentimentTrend(reviews);

    return {
      painPoints: (parsed.painPoints ?? []).slice(0, 4),
      topPraises: (parsed.topPraises ?? []).slice(0, 4),
      staffSignals: (parsed.staffSignals ?? []).slice(0, 5),
      operationalIssues: (parsed.operationalIssues ?? []).slice(0, 3),
      doThisNow: (parsed.doThisNow ?? []).slice(0, 2),
      sentimentTrend,
      competitorKeywordGap: (parsed.competitorKeywordGap ?? []).slice(0, 3),
    };
  } catch (error: any) {
    console.error("[Scraper] runAIAnalysis error:", error?.message);
    const sentimentTrend = computeSentimentTrend(reviews);
    return {
      painPoints: ["Analysis temporarily unavailable — please try again"],
      topPraises: ["Analysis temporarily unavailable — please try again"],
      staffSignals: [],
      operationalIssues: [],
      doThisNow: ["Respond to your most recent unanswered reviews today"],
      sentimentTrend,
      competitorKeywordGap: [],
    };
  }
}

/**
 * Compute base metrics (no AI)
 */
export function computeBaseMetrics(
  reviews: ReviewResult[],
  totalReviewsFromAPI: number | null
): AuditData["metrics"] {
  if (reviews.length === 0) {
    return {
      totalReviews: totalReviewsFromAPI ?? 0,
      averageRating: 0,
      responseRate: 0,
      unansweredCount: 0,
      sentimentScore: 50,
      healthScore: 40,
      reviewVelocity: "Unknown",
      competitorBenchmark: "Industry average: 65% response rate",
    };
  }

  const answered = reviews.filter((r) => r.ownerResponse !== null).length;
  const actualUnanswered = reviews.filter((r) => r.ownerResponse === null).length;
  const totalReviews = totalReviewsFromAPI ?? reviews.length;
  const responseRate = Math.round((answered / reviews.length) * 100);
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const sentimentScore = Math.round(((avgRating - 1) / 4) * 100);

  const ratingScore = (avgRating / 5) * 40;
  const responseScore = (responseRate / 100) * 35;
  const volumeScore = Math.min((totalReviews / 20) * 25, 25);
  const healthScore = Math.round(ratingScore + responseScore + volumeScore);

  const unansweredCount = computeUnansweredCount(actualUnanswered, totalReviews);

  return {
    totalReviews,
    averageRating: Math.round(avgRating * 10) / 10,
    responseRate,
    unansweredCount,
    sentimentScore,
    healthScore,
    reviewVelocity: estimateVelocity(reviews),
    competitorBenchmark: `Industry average: 68% response rate. You're at ${responseRate}%.`,
  };
}

function estimateVelocity(reviews: ReviewResult[]): string {
  const recent = reviews.filter((r) =>
    r.relativeTime.includes("week") || r.relativeTime.includes("day") || r.relativeTime.includes("month")
  ).length;
  if (recent >= 5) return "~5+ reviews/month (high activity)";
  if (recent >= 2) return "~2–4 reviews/month (moderate activity)";
  return "~1 review/month (low activity)";
}
