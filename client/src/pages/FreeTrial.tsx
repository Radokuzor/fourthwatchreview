import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ChevronRight, Search, Loader2, Star, CheckCircle2, Eye,
  MessageSquare, TrendingUp, Zap, BarChart3, Shield, Phone,
  Mail, CreditCard, Check, Crown, ArrowRight, ThumbsUp, ThumbsDown,
  Sparkles, Volume2, Target, Heart
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useClerk, useSignIn, useSignUp, useUser } from "@clerk/clerk-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type OnboardingStep =
  | "welcome"
  | "otp"
  | "business"
  | "showcase"
  | "brand-voice"
  | "demo-review"
  | "phone"
  | "waiting"
  | "plan"
  | "payment";

type BusinessResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  totalReviews: number | null;
  category: string | null;
};

type ReviewResult = {
  reviewId: string;
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  hasOwnerResponse: boolean;
};

type Plan = {
  id: "entry" | "basic" | "legendary";
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  badge?: string;
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "entry",
    name: "Entry",
    monthlyPrice: 19.99,
    yearlyPrice: 15.99,
    features: [
      "10 AI responses per month",
      "Client manager dashboard",
      "Phone & email approvals",
      "Review monitoring (15-min)",
      "Basic analytics",
      "1 business location",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    monthlyPrice: 29.99,
    yearlyPrice: 23.99,
    badge: "Most Popular",
    highlight: true,
    features: [
      "Everything in Entry",
      "15 AI responses per month",
      "Bi-weekly intelligence reports",
      "Competitor gap analysis",
      "Sentiment trend tracking",
      "Up to 3 locations",
    ],
  },
  {
    id: "legendary",
    name: "Legendary",
    monthlyPrice: 89.99,
    yearlyPrice: 71.99,
    features: [
      "Everything in Basic",
      "Unlimited AI responses",
      "CRM integration",
      "Review generation campaigns",
      "Priority support",
      "Unlimited locations",
    ],
  },
];

/** Must match Home.tsx — JSON snapshot from getAuditData for same business */
const FT_HOME_AUDIT_SNAPSHOT_KEY = "ft_home_audit_snapshot";

const SERVICES = [
  { icon: BarChart3, color: "bg-blue-500", title: "Business Audit", desc: "Deep forensic scan of your Google presence — health score, response rate, and revenue gaps." },
  { icon: TrendingUp, color: "bg-violet-500", title: "Sentiment Analysis", desc: "Track how customer feelings shift over time. Spot problems before they become crises." },
  { icon: Zap, color: "bg-amber-500", title: "Smart Suggestions", desc: "AI-powered \"Do This Now\" actions specific to your industry and real customer feedback." },
  { icon: MessageSquare, color: "bg-emerald-500", title: "Automated Responses", desc: "Every review gets a personalized, on-brand reply — you approve in one tap before it posts." },
];

// ─── Brand voice questionnaire ────────────────────────────────────────────────
type BrandQ = {
  id: string;
  question: string;
  icon: React.ElementType;
  options: string[];
};

const BRAND_QUESTIONS: BrandQ[] = [
  {
    id: "tone",
    question: "How would you describe your brand's voice?",
    icon: Volume2,
    options: ["Warm & Friendly", "Professional & Formal", "Bold & Confident", "Playful & Fun"],
  },
  {
    id: "priority",
    question: "What matters most in your responses?",
    icon: Target,
    options: ["Personal touch", "Speed & efficiency", "Empathy first", "Showcase expertise"],
  },
  {
    id: "avoid",
    question: "What should we NEVER say in a response?",
    icon: Shield,
    options: ["Generic apologies", "Corporate jargon", "Defensive language", "Discount offers"],
  },
  {
    id: "include",
    question: "What should we always include?",
    icon: Heart,
    options: ["Reviewer's first name", "Invite them back", "Mention specific details", "Team appreciation"],
  },
];

// ─── Stripe publishable key ───────────────────────────────────────────────────
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// ─── Star display ─────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
const STEP_ORDER: OnboardingStep[] = ["welcome", "otp", "business", "showcase", "brand-voice", "demo-review", "phone", "waiting", "plan", "payment"];

function ProgressBar({ step }: { step: OnboardingStep }) {
  const idx = STEP_ORDER.indexOf(step);
  const pct = Math.round(((idx + 1) / STEP_ORDER.length) * 100);
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-8">
      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Stripe card form ─────────────────────────────────────────────────────────
function StripeCardForm({
  email, planId, yearly, onSuccess
}: {
  email: string; planId: "entry" | "basic" | "legendary"; yearly: boolean; onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const createSetupIntent = trpc.billing.createSetupIntent.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setCardError(null);
    try {
      const { clientSecret } = await createSetupIntent.mutateAsync({ email, planId, yearly });
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error("Card element not found");
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl, billing_details: { email } },
      });
      if (result.error) {
        setCardError(result.error.message ?? "Card error");
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setCardError(msg);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 focus-within:border-blue-500 transition-colors">
        <CardElement
          options={{
            style: {
              base: { fontSize: "16px", color: "#0f172a", fontFamily: "'Inter', sans-serif", "::placeholder": { color: "#94a3b8" } },
              invalid: { color: "#ef4444" },
            },
            hidePostalCode: false,
          }}
          onChange={(e) => { if (e.error) setCardError(e.error.message); else setCardError(null); }}
        />
      </div>
      {cardError && <p className="text-sm text-red-500">{cardError}</p>}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
        <Shield className="h-4 w-4 text-slate-400 shrink-0" />
        <span>Your card is secured by Stripe. You will <strong>not be charged</strong> for 14 days. Cancel anytime before your trial ends.</span>
      </div>
      <Button type="submit" disabled={loading || !stripe} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6">
        {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting your trial...</> : <><CreditCard className="h-4 w-4 mr-2" />Start 14-Day Free Trial</>}
      </Button>
    </form>
  );
}

// ─── Promo Code Bypass ───────────────────────────────────────────────────────
function PromoCodeBypass({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const handleApply = () => {
    const trimmed = code.trim().toLowerCase();
    if (trimmed === "freecode") {
      // Set a 30-day cookie granting demo access
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      document.cookie = `wr_access=freecode; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
      onSuccess();
    } else {
      setError("Invalid promo code. Please try again.");
    }
  };

  return (
    <div className="border-t border-slate-200 pt-5">
      <p className="text-xs text-slate-400 text-center mb-3">Have a promo code? Enter it below to skip payment.</p>
      <div className="flex gap-2">
        <Input
          placeholder="Promo code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          className="text-sm border-2 border-slate-200 focus:border-blue-400"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600"
          onClick={handleApply}
        >
          Apply
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

// ─── Brand voice question card ────────────────────────────────────────────────
function BrandQuestionCard({
  q, value, onChange
}: {
  q: BrandQ; value: string; onChange: (v: string) => void;
}) {
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const Icon = q.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
          <Icon className="h-4 w-4 text-blue-600" />
        </div>
        <p className="font-semibold text-slate-900 text-sm">{q.question}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => { onChange(opt); setUseCustom(false); }}
            className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
              value === opt && !useCustom
                ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                : "border-slate-200 hover:border-slate-300 text-slate-700"
            }`}
          >
            {value === opt && !useCustom && <Check className="inline h-3.5 w-3.5 mr-1 text-blue-600" />}
            {opt}
          </button>
        ))}
      </div>
      {!useCustom ? (
        <button
          onClick={() => setUseCustom(true)}
          className="text-xs text-slate-400 hover:text-blue-600 transition-colors underline underline-offset-2"
        >
          None of these fit — let me type my own
        </button>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Type your own answer..."
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="text-sm border-2 border-blue-300"
            autoFocus
          />
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            onClick={() => { if (custom.trim()) onChange(custom.trim()); }}
            disabled={!custom.trim()}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FreeTrial() {
  const [, setLocation] = useLocation();

  // Read audit context from sessionStorage (set by Home.tsx when user clicks Start Free Trial after audit)
  const auditEmail = sessionStorage.getItem("ft_email") ?? "";
  const auditBusiness: BusinessResult | null = (() => {
    try { return JSON.parse(sessionStorage.getItem("ft_business") ?? "null"); } catch { return null; }
  })();
  const auditReviews: ReviewResult[] = (() => {
    try { return JSON.parse(sessionStorage.getItem("ft_reviews") ?? "null") ?? []; } catch { return []; }
  })();
  const hasAuditContext = !!auditBusiness && !!auditEmail;

  // Always start at welcome; signed-in users (e.g. already verified on Home) jump to showcase/business via effect — never show showcase while logged out.
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [email, setEmail] = useState(auditEmail);
  const [phone, setPhone] = useState("");
  const [businessQuery, setBusinessQuery] = useState("");
  const [businesses, setBusinesses] = useState<BusinessResult[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessResult | null>(auditBusiness);
  const [reviews, setReviews] = useState<ReviewResult[]>(auditReviews);
  const [selectedReview, setSelectedReview] = useState<ReviewResult | null>(null);
  const [demoResponse, setDemoResponse] = useState("");
  const [demoDecision, setDemoDecision] = useState<"approved" | "denied" | null>(null);
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [serviceIdx, setServiceIdx] = useState(0);
  const [yearly, setYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"entry" | "basic" | "legendary">("basic");
  const [trialComplete, setTrialComplete] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpFlow, setOtpFlow] = useState<"signIn" | "signUp" | null>(null);
  const [clerkSignInAttempt, setClerkSignInAttempt] = useState<ReturnType<typeof useSignIn>["signIn"] | null>(null);
  const [clerkSignUpAttempt, setClerkSignUpAttempt] = useState<ReturnType<typeof useSignUp>["signUp"] | null>(null);

  // Brand voice state
  const [brandAnswers, setBrandAnswers] = useState<Record<string, string>>({});

  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { isSignedIn, user: clerkUser } = useUser();
  const { setActive } = useClerk();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const linkAuditToUserMutation = trpc.onboarding.linkAuditToUser.useMutation();

  // Audit state (background generation)
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditSavedId, setAuditSavedId] = useState<number | null>(null);

  // tRPC mutations
  const searchMutation = trpc.audit.searchBusinesses.useMutation();
  const getReviewsMutation = trpc.onboarding.getReviewsOnly.useMutation();
  const genResponseMutation = trpc.onboarding.generateDemoResponse.useMutation();
  const sendDemoMutation = trpc.onboarding.sendDemoApproval.useMutation();
  const saveBrandVoiceMutation = trpc.onboarding.saveBrandVoice.useMutation();
  const runAndSaveAuditMutation = trpc.onboarding.runAndSaveAudit.useMutation();
  const saveHomeAuditSnapshotMutation = trpc.onboarding.saveHomeAuditSnapshot.useMutation();
  const promoActivateMutation = trpc.onboarding.promoActivate.useMutation();
  const persistAuditFromHomeRef = useRef(false);
  const pollStatusQuery = trpc.onboarding.pollDemoStatus.useQuery(
    { token: demoToken ?? "" },
    { enabled: !!demoToken && step === "waiting", refetchInterval: 3000 }
  );

  // Service showcase auto-cycle
  useEffect(() => {
    if (step !== "showcase") return;
    const t = setInterval(() => setServiceIdx((i) => (i + 1) % SERVICES.length), 2500);
    return () => clearInterval(t);
  }, [step]);

  // Poll demo status
  useEffect(() => {
    if (!pollStatusQuery.data) return;
    const { decision } = pollStatusQuery.data;
    if (decision === "approved" || decision === "denied") {
      setDemoDecision(decision);
    }
  }, [pollStatusQuery.data]);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  useEffect(() => {
    if (!isSignedIn) persistAuditFromHomeRef.current = false;
  }, [isSignedIn]);

  // If already signed in, skip OTP and welcome (no second account flow after Home audit + OTP)
  useEffect(() => {
    if (!isSignedIn) return;
    if (step === "otp") {
      setStep(hasAuditContext ? "showcase" : "business");
    } else if (step === "welcome") {
      setStep(hasAuditContext ? "showcase" : "business");
    }
  }, [isSignedIn, step, hasAuditContext]);

  // Persist full audit to user_audits when user arrived from Home with business context (skips business step)
  useEffect(() => {
    if (!isSignedIn || !hasAuditContext || !auditBusiness) return;
    if (persistAuditFromHomeRef.current) return;

    const em =
      (meQuery.data?.email || clerkUser?.primaryEmailAddress?.emailAddress || email || auditEmail).trim();
    if (!em.includes("@")) return;

    persistAuditFromHomeRef.current = true;
    sessionStorage.setItem("ft_audit_saving", "1");

    const uid = meQuery.data?.id && meQuery.data.id > 0 ? meQuery.data.id : undefined;

    type HomeSnap = {
      v: number;
      placeId: string;
      businessName: string;
      analysis: unknown;
      metrics: unknown;
    };
    let homeSnap: HomeSnap | null = null;
    try {
      const raw = sessionStorage.getItem(FT_HOME_AUDIT_SNAPSHOT_KEY);
      if (raw) {
        const o = JSON.parse(raw) as HomeSnap;
        if (
          o?.v === 1 &&
          o.placeId === auditBusiness.placeId &&
          o.businessName === auditBusiness.name &&
          o.analysis &&
          o.metrics
        ) {
          homeSnap = o;
        }
      }
    } catch {
      homeSnap = null;
    }

    const savePromise = homeSnap
      ? saveHomeAuditSnapshotMutation.mutateAsync({
          placeId: auditBusiness.placeId,
          businessName: auditBusiness.name,
          analysis: homeSnap.analysis,
          metrics: homeSnap.metrics,
          email: em,
          userId: uid,
        })
      : runAndSaveAuditMutation.mutateAsync({
          placeId: auditBusiness.placeId,
          businessName: auditBusiness.name,
          businessCategory: auditBusiness.category ?? undefined,
          businessAddress: auditBusiness.address ?? undefined,
          totalReviews: auditBusiness.totalReviews ?? null,
          email: em,
          userId: uid,
        });

    void savePromise
      .then((result) => {
        sessionStorage.setItem("ft_audit_id", String(result.auditId));
        setAuditSavedId(result.auditId);
        sessionStorage.removeItem(FT_HOME_AUDIT_SNAPSHOT_KEY);
      })
      .catch(() => {
        persistAuditFromHomeRef.current = false;
      })
      .finally(() => {
        sessionStorage.removeItem("ft_audit_saving");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per signed-in + audit context; avoid mutation dep churn
  }, [
    isSignedIn,
    hasAuditContext,
    auditBusiness?.placeId,
    auditBusiness?.name,
    auditBusiness?.category,
    auditBusiness?.address,
    auditEmail,
    email,
    clerkUser?.primaryEmailAddress?.emailAddress,
    meQuery.data?.email,
    meQuery.data?.id,
  ]);

  // Attach email-keyed audit rows to DB user id when available (idempotent UPDATE; safe if row not inserted yet)
  useEffect(() => {
    if (!isSignedIn || !hasAuditContext) return;
    const uid = meQuery.data?.id;
    const em =
      (meQuery.data?.email || clerkUser?.primaryEmailAddress?.emailAddress || email || auditEmail).trim();
    if (!uid || uid <= 0 || !em.includes("@")) return;
    linkAuditToUserMutation.mutate({ email: em, userId: uid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSignedIn,
    hasAuditContext,
    meQuery.data?.id,
    meQuery.data?.email,
    clerkUser?.primaryEmailAddress?.emailAddress,
    email,
    auditEmail,
  ]);

  const clerkReady = signInLoaded && signUpLoaded && !!signIn && !!signUp;

  // OTP: Send code (Clerk email code) ───────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.includes("@")) return;
    setOtpSending(true);
    setOtpError(null);

    if (!import.meta.env.CLERK_PUBLISHABLE_KEY) {
      setOtpSending(false);
      setStep(hasAuditContext ? "showcase" : "business");
      return;
    }

    if (!clerkReady) {
      setOtpSending(false);
      setOtpError("Authentication is still loading — please try again in a moment.");
      return;
    }

    try {
      const si = await signIn!.create({ identifier: email.trim(), strategy: "email_code" });
      setClerkSignInAttempt(si as ReturnType<typeof useSignIn>["signIn"]);
      setOtpFlow("signIn");
      setOtpSending(false);
      setStep("otp");
      toast.success("Check your email — we sent a 6-digit code!");
    } catch (err: unknown) {
      const code = (err as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code;
      if (code === "form_identifier_not_found") {
        try {
          const su = await signUp!.create({ emailAddress: email.trim() });
          await su.prepareEmailAddressVerification({ strategy: "email_code" });
          setClerkSignUpAttempt(su as ReturnType<typeof useSignUp>["signUp"]);
          setOtpFlow("signUp");
          setOtpSending(false);
          setStep("otp");
          toast.success("Check your email — we sent a 6-digit code!");
        } catch (err2: unknown) {
          const msg = err2 instanceof Error ? err2.message : "Failed to send code";
          setOtpError(msg);
          setOtpSending(false);
        }
      } else {
        const msg = err instanceof Error ? err.message : "Failed to send code";
        setOtpError(msg);
        setOtpSending(false);
      }
    }
  };

  // ─── OTP: Verify code ────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) return;
    setOtpVerifying(true);
    setOtpError(null);
    try {
      if (otpFlow === "signIn" && clerkSignInAttempt) {
        const si = clerkSignInAttempt as {
          attemptFirstFactor: (a: unknown) => Promise<{ status: string }>;
          createdSessionId: string | null;
        };
        const result = await si.attemptFirstFactor({
          strategy: "email_code",
          code: otpCode,
        });
        if (result.status !== "complete") {
          setOtpError("Verification incomplete — please try again.");
          return;
        }
        if (si.createdSessionId) {
          await setActive({ session: si.createdSessionId });
        }
        await new Promise((r) => setTimeout(r, 150));
        toast.success("Welcome back! You're signed in.");
        setStep(auditBusiness ? "showcase" : "business");
      } else if (otpFlow === "signUp" && clerkSignUpAttempt) {
        const su = clerkSignUpAttempt as {
          attemptEmailAddressVerification: (a: { code: string }) => Promise<{ status: string }>;
          createdSessionId: string | null;
        };
        const result = await su.attemptEmailAddressVerification({ code: otpCode });
        if (result.status !== "complete") {
          setOtpError("Verification incomplete — please try again.");
          return;
        }
        if (su.createdSessionId) {
          await setActive({ session: su.createdSessionId });
        }
        await new Promise((r) => setTimeout(r, 150));
        toast.success("Account created! Welcome to WatchReviews.");
        setStep(auditBusiness ? "showcase" : "business");
      } else {
        setOtpError("Session expired — go back and request a new code.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      setOtpError(msg.includes("incorrect") ? "Incorrect code — please check your email and try again." : msg);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSearch = async () => {
    if (!businessQuery.trim()) return;
    try {
      const { results } = await searchMutation.mutateAsync({ query: businessQuery });
      setBusinesses(results);
    } catch {
      toast.error("Search failed — please try again");
    }
  };

  const handleSelectBusiness = async (biz: BusinessResult) => {
    setSelectedBusiness(biz);
    try {
      const data = await getReviewsMutation.mutateAsync({ placeId: biz.placeId });
      const unanswered = data.reviews.filter((r: ReviewResult) => !r.hasOwnerResponse);
      setReviews(unanswered.length > 0 ? unanswered : data.reviews);
      const pick = unanswered[0] ?? data.reviews[0];
      setSelectedReview(pick ?? null);
      if (pick) {
        genResponseMutation.mutateAsync({
          reviewText: pick.text,
          reviewerName: pick.authorName,
          rating: pick.rating,
          businessName: biz.name,
        }).then((res) => {
          setDemoResponse(typeof res.response === "string" ? res.response : String(res.response));
        }).catch(() => {});
      }
      // Background: run full AI audit and save to DB
      setAuditRunning(true);
      sessionStorage.setItem("ft_audit_saving", "1");
      const uid =
        meQuery.data?.id && meQuery.data.id > 0 ? meQuery.data.id : undefined;
      runAndSaveAuditMutation
        .mutateAsync({
          placeId: biz.placeId,
          businessName: biz.name,
          businessCategory: biz.category ?? undefined,
          businessAddress: biz.address ?? undefined,
          totalReviews: biz.totalReviews ?? null,
          email: email || undefined,
          userId: uid,
        })
        .then((result) => {
          setAuditSavedId(result.auditId);
          sessionStorage.setItem("ft_audit_id", String(result.auditId));
        })
        .catch(() => {})
        .finally(() => {
          setAuditRunning(false);
          sessionStorage.removeItem("ft_audit_saving");
        });
      setStep("showcase");
    } catch {
      toast.error("Could not load reviews — please try again");
    }
  };

  const handleSendDemo = async () => {
    if (!email || !selectedReview || !selectedBusiness) return;
    try {
      const { token } = await sendDemoMutation.mutateAsync({
        email,
        phone: phone || undefined,
        businessName: selectedBusiness.name,
        reviewText: selectedReview.text,
        reviewerName: selectedReview.authorName,
        rating: selectedReview.rating,
        demoResponse,
      });
      setDemoToken(token);
      setStep("waiting");
    } catch {
      toast.error("Failed to send demo — please try again");
    }
  };

  const handleSkipToPayment = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setStep("plan");
  };

  const handleBrandVoiceContinue = async () => {
    // Save brand voice in background (non-blocking)
    if (Object.keys(brandAnswers).length >= 2) {
      saveBrandVoiceMutation.mutateAsync({
        email,
        brandTone: brandAnswers["tone"] ?? "",
        topPriority: brandAnswers["priority"] ?? "",
        avoidPhrases: brandAnswers["avoid"],
        mustIncludePhrases: brandAnswers["include"],
        businessName: selectedBusiness?.name,
      }).catch(() => {});
    }
    setStep("demo-review");
  };

  // ─── Step renderers ──────────────────────────────────────────────────────────

  const renderWelcome = () => (
    <div className="text-center space-y-8">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg">
          <Eye className="h-10 w-10 text-white" />
        </div>
      </div>
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">Welcome to WatchReviews</h1>
        <p className="text-lg text-slate-500 max-w-md mx-auto">by FourthWatch — the platform that turns your Google reviews into your biggest competitive advantage.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        {SERVICES.map((s) => (
          <div key={s.title} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4 text-left">
            <div className={`w-8 h-8 ${s.color} rounded-lg flex items-center justify-center shrink-0`}>
              <s.icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">{s.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc.split("—")[0].trim()}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 max-w-sm mx-auto">
        <label className="text-sm font-medium text-slate-700 block text-left">Your email address</label>
        <Input
          type="email"
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && email.includes("@") && handleSendOtp()}
          className="border-2 text-base py-5"
        />
        <Button
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
          disabled={!email.includes("@") || otpSending}
          onClick={handleSendOtp}
        >
          {otpSending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending code...</>
            : <>Let's Get Started <ChevronRight className="ml-2 h-5 w-5" /></>}
        </Button>
        {otpError && <p className="text-sm text-red-500 text-center">{otpError}</p>}
        {hasAuditContext && (
          <p className="text-xs text-slate-500 text-center max-w-sm mx-auto leading-relaxed">
            If you already verified your email on the audit page, you stay signed in — we won&apos;t ask again.
            Otherwise use the same email for a one-time sign-in code.
          </p>
        )}
        <p className="text-xs text-slate-400 text-center">No credit card required to start. 14-day free trial.</p>
      </div>
    </div>
  );

  const renderOtp = () => (
    <div className="space-y-8 text-center max-w-sm mx-auto">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
      </div>
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Check your email</h2>
        <p className="text-slate-500">We sent a 6-digit code to <strong>{email}</strong>. Enter it below to {otpFlow === "signUp" ? "create your account" : "sign in"}.</p>
      </div>
      <div className="space-y-4">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && otpCode.length === 6 && handleVerifyOtp()}
          className="border-2 text-center text-3xl tracking-[0.5em] font-mono py-6"
          autoFocus
        />
        {otpError && <p className="text-sm text-red-500">{otpError}</p>}
        <Button
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
          disabled={otpCode.length < 6 || otpVerifying}
          onClick={handleVerifyOtp}
        >
          {otpVerifying
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
            : <><CheckCircle2 className="h-4 w-4 mr-2" />Verify & Continue</>}
        </Button>
        <button
          onClick={() => { setOtpCode(""); setOtpError(null); handleSendOtp(); }}
          className="text-sm text-slate-400 hover:text-blue-600 transition-colors underline underline-offset-2"
        >
          Resend code
        </button>
      </div>
    </div>
  );

  const renderBusiness = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Find Your Business</h2>
        <p className="text-slate-500">We'll pull your real Google reviews to show you exactly how the platform works.</p>
      </div>
      <div className="flex gap-3">
        <Input
          placeholder="e.g. Joe's Pizza New York"
          value={businessQuery}
          onChange={(e) => setBusinessQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="text-base py-5 border-2"
        />
        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-5" onClick={handleSearch} disabled={searchMutation.isPending}>
          {searchMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </Button>
      </div>
      {businesses.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-500">Select your business:</p>
          {businesses.map((biz) => (
            <button
              key={biz.placeId}
              onClick={() => handleSelectBusiness(biz)}
              disabled={getReviewsMutation.isPending}
              className="w-full text-left p-4 bg-white border-2 border-slate-200 hover:border-blue-500 rounded-xl transition-all group disabled:opacity-50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{biz.name}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{biz.address}</p>
                  {biz.category && <Badge variant="secondary" className="mt-2 text-xs">{biz.category}</Badge>}
                </div>
                <div className="text-right shrink-0 ml-4">
                  {biz.rating && (
                    <div className="flex gap-0.5 justify-end">
                      {[1,2,3,4,5].map((s) => <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.round(biz.rating!) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                    </div>
                  )}
                  {biz.totalReviews && <p className="text-xs text-slate-400 mt-1">{biz.totalReviews} reviews</p>}
                </div>
              </div>
            </button>
          ))}
          {getReviewsMutation.isPending && (
            <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm">Loading your reviews...</span>
            </div>
          )}
        </div>
      )}
      {businesses.length === 0 && !searchMutation.isPending && businessQuery && (
        <p className="text-sm text-slate-400 text-center">No results yet — try a more specific name or add your city.</p>
      )}
    </div>
  );

  const renderShowcase = () => {
    const svc = SERVICES[serviceIdx];
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Here's What You're Getting</h2>
          <p className="text-slate-500">Four powerful tools working together to protect and grow your reputation.</p>
        </div>
        <div className="relative h-48 flex items-center justify-center">
          <div className={`absolute inset-0 ${svc.color} opacity-5 rounded-2xl`} />
          <div className="text-center space-y-3 px-8">
            <div className={`w-16 h-16 ${svc.color} rounded-2xl flex items-center justify-center mx-auto shadow-lg`}>
              <svc.icon className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{svc.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{svc.desc}</p>
          </div>
        </div>
        <div className="flex justify-center gap-2">
          {SERVICES.map((_, i) => (
            <button key={i} onClick={() => setServiceIdx(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === serviceIdx ? "bg-blue-600 w-6" : "bg-slate-200"}`} />
          ))}
        </div>
        <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6" onClick={() => setStep("brand-voice")}>
          Customize Your Brand Voice <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    );
  };

  const renderBrandVoice = () => {
    const allAnswered = BRAND_QUESTIONS.every((q) => brandAnswers[q.id]);
    return (
      <div className="space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-violet-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Your Brand Voice</h2>
          <p className="text-slate-500 text-sm">Answer 4 quick questions so our AI writes responses that sound exactly like you.</p>
        </div>
        <div className="space-y-6">
          {BRAND_QUESTIONS.map((q) => (
            <BrandQuestionCard
              key={q.id}
              q={q}
              value={brandAnswers[q.id] ?? ""}
              onChange={(v) => setBrandAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          ))}
        </div>
        <Button
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
          disabled={!allAnswered}
          onClick={handleBrandVoiceContinue}
        >
          {allAnswered ? <>See Your Live Demo <ChevronRight className="ml-2 h-5 w-5" /></> : "Answer all questions to continue"}
        </Button>
        <button
          onClick={() => setStep("demo-review")}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Skip for now
        </button>
      </div>
    );
  };

  const renderDemoReview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Live Demo</h2>
        <p className="text-slate-500">Here's a real review from <strong>{selectedBusiness?.name}</strong>. We've already written a response — approve or deny it.</p>
      </div>

      {selectedReview ? (
        <>
          {/* Review card */}
          <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                {selectedReview.authorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{selectedReview.authorName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Stars rating={selectedReview.rating} />
                  <span className="text-xs text-slate-400">{selectedReview.relativeTime}</span>
                </div>
              </div>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">{selectedReview.text || "(No text — rating only)"}</p>
          </div>

          {/* AI Response */}
          {genResponseMutation.isPending ? (
            <div className="flex items-center gap-2 text-slate-500 justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm">Generating AI response...</span>
            </div>
          ) : demoResponse ? (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                  <Eye className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-blue-800">WatchReviews AI Response</span>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Draft</Badge>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{demoResponse}</p>
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-5"
              onClick={() => { setDemoDecision("approved"); setStep("phone"); }}
            >
              <ThumbsUp className="h-4 w-4 mr-2" /> Approve Response
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 py-5"
              onClick={() => { setDemoDecision("denied"); setStep("phone"); }}
            >
              <ThumbsDown className="h-4 w-4 mr-2" /> Deny
            </Button>
          </div>
          <p className="text-xs text-slate-400 text-center">In real use, you'd receive this via email or Telegram — approve with one tap.</p>
        </>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No reviews found — we'll skip the demo for now.</p>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setStep("phone")}>Continue</Button>
        </div>
      )}
    </div>
  );

  const renderPhone = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Get the Full Experience</h2>
        <p className="text-slate-500">Add your phone number and we'll send you the approval email + a text so you can see exactly how it works in real time.</p>
      </div>

      {demoDecision === "approved" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Response approved!</p>
            <p className="text-emerald-700 text-sm mt-0.5">In real use, this would now be posted to your Google Business Profile automatically.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Phone number (optional)</label>
          <Input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border-2 text-base py-5"
          />
          <p className="text-xs text-slate-400 mt-1.5">We'll send you a text with the review snippet and response. Reply STOP to opt out anytime.</p>
        </div>
        <Button
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
          onClick={handleSendDemo}
          disabled={sendDemoMutation.isPending}
        >
          {sendDemoMutation.isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
            : <><Mail className="h-4 w-4 mr-2" />Send to My Email & Phone</>}
        </Button>
        <Button variant="ghost" className="w-full text-slate-400 hover:text-slate-600" onClick={() => setStep("plan")}>
          Skip this step
        </Button>
      </div>
    </div>
  );

  const renderWaiting = () => (
    <div className="space-y-8 text-center">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Check Your Email & Phone</h2>
        <p className="text-slate-500">We've sent the approval email to <strong>{email}</strong>{phone ? ` and a text to ${phone}` : ""}.</p>
      </div>

      {demoDecision ? (
        <div className="space-y-4">
          {demoDecision === "approved" ? (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-emerald-800 text-lg mb-2">Response Approved!</p>
              <p className="text-emerald-700 text-sm mb-4">Here's what would appear on your Google Business Profile:</p>
              {/* Simulated review card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-left shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {selectedReview?.authorName.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{selectedReview?.authorName}</p>
                    <Stars rating={selectedReview?.rating ?? 5} />
                  </div>
                </div>
                <p className="text-slate-700 text-sm mb-4 leading-relaxed">{selectedReview?.text}</p>
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <Eye className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">Owner Response</span>
                    <span className="text-xs text-slate-400">· just now</span>
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed">{demoResponse}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
              <p className="font-bold text-amber-800 text-lg mb-2">Response Declined</p>
              <p className="text-amber-700 text-sm">No problem — in real use you can write your own response or ask WatchReviews to regenerate a new one.</p>
            </div>
          )}
          <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6" onClick={() => setStep("plan")}>
            Continue to Plans <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-700 font-medium">Waiting for your response...</p>
            <p className="text-slate-400 text-sm">Check your email and click Approve or Deny. This page will update automatically.</p>
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-600" onClick={handleSkipToPayment}>
            Finish Onboarding — Skip to Plans
          </Button>
        </div>
      )}
    </div>
  );

  const renderPlan = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Choose Your Plan</h2>
        <p className="text-slate-500">Start your 14-day free trial — no charge until day 15.</p>
      </div>

      {/* Monthly / Yearly toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!yearly ? "text-slate-900" : "text-slate-400"}`}>Monthly</span>
        <button
          onClick={() => setYearly(!yearly)}
          className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? "bg-blue-600" : "bg-slate-200"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${yearly ? "translate-x-6" : ""}`} />
        </button>
        <span className={`text-sm font-medium ${yearly ? "text-slate-900" : "text-slate-400"}`}>
          Yearly <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Save 20%</Badge>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          const isSelected = selectedPlan === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"} ${plan.highlight ? "ring-2 ring-blue-500/20" : ""}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-lg">{plan.name}</span>
                    {plan.badge && <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">{plan.badge}</Badge>}
                    {plan.id === "legendary" && <Crown className="h-4 w-4 text-amber-500" />}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-slate-900">${price}</span>
                    <span className="text-slate-400 text-sm">/mo{yearly ? " billed yearly" : ""}</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300"}`}>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
              </div>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6" onClick={() => setStep("payment")}>
        Continue with {PLANS.find((p) => p.id === selectedPlan)?.name} Plan <ChevronRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );

  const renderPayment = () => {
    const plan = PLANS.find((p) => p.id === selectedPlan)!
    const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Start Your Free Trial</h2>
          <p className="text-slate-500">You won't be charged anything today.</p>
        </div>

        {/* Plan summary */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{plan.name} Plan</p>
              <p className="text-sm text-slate-500">{yearly ? "Billed yearly" : "Billed monthly"} · 14-day free trial</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900 text-lg">${price}/mo</p>
              <p className="text-xs text-emerald-600 font-medium">First charge: Day 15</p>
            </div>
          </div>
        </div>

        {trialComplete ? (
          <div className="text-center space-y-4 py-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-xl">You're all set!</p>
              <p className="text-slate-500 text-sm mt-1">Your 14-day free trial has started. Let's go to your dashboard.</p>
            </div>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6" onClick={() => setLocation("/dashboard")}>
              Go to My Dashboard <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        ) : (
          <Elements stripe={stripePromise}>
            <StripeCardForm
              email={email}
              planId={selectedPlan}
              yearly={yearly}
              onSuccess={() => setTrialComplete(true)}
            />
          </Elements>
        )}

        {/* Promo code bypass */}
        {!trialComplete && (
          <PromoCodeBypass
            onSuccess={() => {
              setTrialComplete(true);
              // If user is signed in, create a client record so they get the full dashboard
              if (isSignedIn && selectedBusiness) {
                promoActivateMutation.mutate({
                  businessName: selectedBusiness.name,
                  email: email || undefined,
                });
              }
            }}
          />
        )}

        {/* Skip for now — greyed out, goes directly to dashboard */}
        {!trialComplete && (
          <div className="text-center pt-2">
            <button
              onClick={() => setLocation("/dashboard")}
              className="text-sm text-slate-400 hover:text-slate-500 transition-colors underline underline-offset-2"
            >
              Skip for now — go to dashboard without payment
            </button>
            <p className="text-xs text-slate-300 mt-1">Premium features will be locked until you subscribe.</p>
          </div>
        )}
      </div>
    );
  };

  const STEP_RENDERERS: Record<OnboardingStep, () => React.ReactElement> = {
    welcome: renderWelcome,
    otp: renderOtp,
    business: renderBusiness,
    showcase: renderShowcase,
    "brand-voice": renderBrandVoice,
    "demo-review": renderDemoReview,
    phone: renderPhone,
    waiting: renderWaiting,
    plan: renderPlan,
    payment: renderPayment,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Nav */}
      <nav className="border-b bg-white/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663492121254/dd2dpCppv6NJGLXJF3QZ3N/watchreviews-logo_022832b1.png" alt="WatchReviews" className="w-7 h-7 object-contain" />
            <span className="font-bold text-slate-900">Watch<span className="text-blue-600">Reviews</span></span>
          </button>
          <Badge variant="outline" className="text-xs text-slate-500">Free Trial Setup</Badge>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-xl mx-auto px-6 py-10">
        <ProgressBar step={step} />
        {STEP_RENDERERS[step]()}
      </div>
    </div>
  );
}
