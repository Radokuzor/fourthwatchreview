// WatchReviews Pricing Tiers
// These are the 3 subscription plans. Stripe Price IDs are created dynamically
// via the checkout session — no pre-created products needed for MVP.

export const PLANS = {
  entry: {
    id: "entry",
    name: "Entry",
    price: 1999, // $19.99/month in cents
    interval: "month" as const,
    description: "Perfect for single-location businesses getting started with review automation.",
    features: [
      "10 AI-powered review responses/month",
      "Client manager dashboard",
      "Phone SMS approval alerts (Textbelt)",
      "Email approval workflow",
      "Google Business Profile monitoring",
      "Response history & audit log",
      "Brand voice customization",
      "14-day free trial included",
    ],
    badge: null,
  },
  basic: {
    id: "basic",
    name: "Basic",
    price: 2999, // $29.99/month in cents
    interval: "month" as const,
    description: "For growing businesses that want deeper insights and more responses.",
    features: [
      "Everything in Entry",
      "15 AI responses/month",
      "Weekly business health check reports",
      "Business optimization recommendations",
      "Competitor review analysis",
      "Customer sentiment trend tracking",
      "AI business analyzer (pain points, praises)",
      "Priority email support",
    ],
    badge: "Most Popular",
  },
  legendary: {
    id: "legendary",
    name: "Legendary",
    price: 8999, // $89.99/month in cents
    interval: "month" as const,
    description: "Full-stack reputation management for serious businesses.",
    features: [
      "Everything in Basic",
      "Unlimited AI responses/month",
      "CRM integration (Zapier/webhook)",
      "Automated review generation campaigns",
      "SMS outreach to past customers for reviews",
      "Dedicated account manager",
      "White-glove onboarding",
      "Monthly strategy call",
    ],
    badge: "Best Value",
  },
} as const;

export type PlanId = keyof typeof PLANS;
