import { describe, expect, it } from "vitest";
import { computeBaseMetrics, reviewHasOwnerResponse, type ReviewResult } from "./scraper";

function row(ownerResponse: string | null): ReviewResult {
  return {
    reviewId: "1",
    authorName: "a",
    rating: 5,
    text: "t",
    relativeTime: "1 day ago",
    ownerResponse,
  };
}

describe("reviewHasOwnerResponse", () => {
  it("rejects null, empty, and whitespace-only", () => {
    expect(reviewHasOwnerResponse({ ownerResponse: null })).toBe(false);
    expect(reviewHasOwnerResponse({ ownerResponse: "" })).toBe(false);
    expect(reviewHasOwnerResponse({ ownerResponse: "   " })).toBe(false);
    expect(reviewHasOwnerResponse({ ownerResponse: "Thanks!" })).toBe(true);
  });
});

describe("computeBaseMetrics responseRate", () => {
  it("counts only non-empty owner replies", () => {
    const reviews = [row(""), row(null), row("Thanks for visiting!")];
    const m = computeBaseMetrics(reviews, 3);
    expect(m.responseRate).toBe(33);
  });

  it("extrapolates to listing total when totalReviews > sample size", () => {
    const reviews = Array.from({ length: 10 }, (_, i) => row(i < 3 ? "Thanks" : null));
    const m = computeBaseMetrics(reviews, 100);
    expect(m.responseRate).toBe(30);
  });
});
