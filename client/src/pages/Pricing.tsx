import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Star, Zap, Crown, ArrowLeft, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const plans = [
  {
    id: "entry",
    name: "Entry",
    price: 19.99,
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    badge: null,
    description: "Perfect for solo business owners getting started",
    features: [
      "10 AI-generated responses per month",
      "Client manager dashboard",
      "Phone approval via SMS alerts",
      "Review monitoring & alerts",
      "Basic analytics & response rate tracking",
      "Email approval workflow",
      "Standard AI response quality",
      "1 business location",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: 29.99,
    icon: Star,
    color: "text-violet-500",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-300",
    badge: "Most Popular",
    description: "For growing businesses that want deeper insights",
    features: [
      "Everything in Entry",
      "15 AI-generated responses per month",
      "Weekly business health checks",
      "Business optimization recommendations",
      "Competition review analysis",
      "AI business analyzer (sentiment trends, pain points)",
      "Customer sentiment dashboard",
      "Up to 3 business locations",
      "Priority response queue",
    ],
  },
  {
    id: "legendary",
    name: "Legendary",
    price: 89.99,
    icon: Crown,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
    badge: "Best Value",
    description: "Full-service automation for serious businesses",
    features: [
      "Everything in Basic",
      "Unlimited AI-generated responses",
      "CRM integration (HubSpot, Salesforce, Zoho)",
      "Automated review generation campaigns",
      "SMS outreach to past customers requesting reviews",
      "Boost Google search visibility via review velocity",
      "Advanced competitor benchmarking",
      "White-glove onboarding call",
      "Unlimited business locations",
      "Dedicated account manager",
      "Custom AI brand voice training",
    ],
  },
];

export default function PricingPage() {
  const [, setLocation] = useLocation();
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [exitIntentShown, setExitIntentShown] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      toast.error("Failed to start checkout: " + err.message);
    },
  });

  // Exit intent detection
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !exitIntentShown) {
        setShowExitIntent(true);
        setExitIntentShown(true);
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [exitIntentShown]);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
            checkoutMutation.mutate({ planId: planId as "entry" | "basic" | "legendary", trial: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <span className="font-semibold text-slate-900">
            Review<span className="text-blue-600">Pilot</span> Pricing
          </span>
          <div className="w-24" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <Badge className="mb-4 bg-blue-100 text-blue-700 border-blue-200">
            14-Day Free Trial — No Risk
          </Badge>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Start free for 14 days. Cancel anytime. Your card is only charged after the trial ends.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isPopular = plan.badge === "Most Popular";
            const isLoading = checkoutMutation.isPending && selectedPlan === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative border-2 transition-all hover:shadow-xl ${
                  isPopular
                    ? "border-violet-400 shadow-lg shadow-violet-100 scale-105"
                    : plan.borderColor
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge
                      className={
                        isPopular
                          ? "bg-violet-600 text-white border-0 px-4"
                          : "bg-amber-500 text-white border-0 px-4"
                      }
                    >
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className={`w-12 h-12 rounded-xl ${plan.bgColor} flex items-center justify-center mb-3`}>
                    <Icon className={`h-6 w-6 ${plan.color}`} />
                  </div>
                  <CardTitle className="text-xl text-slate-900">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-500 text-sm">
                    {plan.description}
                  </CardDescription>
                  <div className="pt-2">
                    <span className="text-4xl font-bold text-slate-900">
                      ${plan.price}
                    </span>
                    <span className="text-slate-400 text-sm ml-1">/month</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <Button
                    className={`w-full mb-6 ${
                      isPopular
                        ? "bg-violet-600 hover:bg-violet-700 text-white"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={checkoutMutation.isPending}
                  >
                    {isLoading ? "Starting trial..." : "Start 14-Day Free Trial"}
                  </Button>

                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-slate-400 text-sm mt-10">
          All plans include a 14-day free trial. Cancel before the trial ends and you won't be charged.
          Questions? Email us at <a href="mailto:hello@reviewpilot.ai" className="text-blue-500 hover:underline">hello@reviewpilot.ai</a>
        </p>
      </div>

      {/* Exit Intent Dialog */}
      <Dialog open={showExitIntent} onOpenChange={setShowExitIntent}>
        <DialogContent className="max-w-md">
          <button
            onClick={() => setShowExitIntent(false)}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogHeader>
            <div className="text-4xl mb-2">🎁</div>
            <DialogTitle className="text-xl">Wait — don't leave yet!</DialogTitle>
            <DialogDescription className="text-slate-600 mt-2">
              Start your <strong>14-day free trial</strong> today. No charge until the trial ends.
              Cancel anytime — no questions asked.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
              onClick={() => {
                setShowExitIntent(false);
                handleSelectPlan("basic");
              }}
            >
              Start Free Trial — Most Popular Plan ($29.99/mo)
            </Button>
            <Button
              variant="ghost"
              className="text-slate-400 text-sm w-full"
              onClick={() => setShowExitIntent(false)}
            >
              No thanks, I'll pass
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
