import { useEffect, useState } from "react";
import { useClerk, useSignIn, useSignUp, useUser } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search, Star, TrendingUp, AlertCircle, CheckCircle2, Zap,
  ChevronRight, Shield, Clock, BarChart3, MessageSquare,
  Phone, Mail, Calendar, Loader2, Lock, Eye
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

type BusinessResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  totalReviews: number | null;
  category: string | null;
};

type AuditMetrics = {
  totalReviews: number;
  averageRating: number;
  responseRate: number;
  unansweredCount: number;
  sentimentScore: number;
  healthScore: number;
  reviewVelocity: string;
  competitorBenchmark: string;
};

type StaffSignal = { name: string; sentiment: "positive" | "negative"; mentions: number; context: string };
type AuditAnalysis = {
  painPoints: string[];
  topPraises: string[];
  staffSignals: StaffSignal[];
  operationalIssues: string[];
  doThisNow: string[];
  sentimentTrend: { oldestFour: number; newestFour: number; direction: "improving" | "declining" | "stable"; summary: string };
  competitorKeywordGap: string[];
};

type ReviewSummary = {
  reviewId: string;
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
  hasOwnerResponse: boolean;
};

type Step = "search" | "results" | "loading" | "audit" | "demo";

/** Must match FreeTrial — persisted home free-audit payload for dashboard without re-running AI */
const FT_HOME_AUDIT_SNAPSHOT_KEY = "ft_home_audit_snapshot";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </div>
  );
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{score}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-500 text-center">{label}</span>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading, logout, user: authUser } = useAuth();
  const { user: clerkUser, isSignedIn } = useUser();
  const { setActive } = useClerk();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<BusinessResult[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessResult | null>(null);
  const [auditData, setAuditData] = useState<{ metrics: AuditMetrics; analysis: AuditAnalysis; reviews: ReviewSummary[]; competitorNames: string[] } | null>(null);
  const [email, setEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phone, setPhone] = useState("");
  const [selectedReview, setSelectedReview] = useState<ReviewSummary | null>(null);
  const [demoResponse, setDemoResponse] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);

  const searchMutation = trpc.audit.searchBusinesses.useMutation();
  const auditQuery = trpc.audit.getAuditData.useQuery(
    {
      placeId: selectedBusiness?.placeId ?? "",
      businessName: selectedBusiness?.name ?? "",
      totalReviews: selectedBusiness?.totalReviews ?? null,
      category: selectedBusiness?.category ?? null,
      address: selectedBusiness?.address ?? "",
    },
    { enabled: false }
  );
  const syncHomeAuditLeadMutation = trpc.audit.syncHomeAuditLead.useMutation();
  const capturePhoneMutation = trpc.audit.capturePhone.useMutation();
  const [otpCode, setOtpCode] = useState("");
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpFlow, setOtpFlow] = useState<"signIn" | "signUp" | null>(null);
  const [clerkSignInAttempt, setClerkSignInAttempt] = useState<ReturnType<typeof useSignIn>["signIn"] | null>(null);
  const [clerkSignUpAttempt, setClerkSignUpAttempt] = useState<ReturnType<typeof useSignUp>["signUp"] | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const generateDemoMutation = trpc.audit.generateDemoResponse.useMutation();

  const clerkReady = signInLoaded && signUpLoaded && !!signIn && !!signUp;

  /** Already signed in with Clerk — unlock report and sync email for downstream actions. */
  useEffect(() => {
    if (!isSignedIn || !clerkUser?.primaryEmailAddress?.emailAddress) return;
    setEmail(clerkUser.primaryEmailAddress.emailAddress);
    if (step === "audit" || step === "demo") {
      setEmailCaptured(true);
    }
  }, [isSignedIn, clerkUser?.primaryEmailAddress?.emailAddress, step]);

  const handleSearch = async () => {
    if (query.trim().length < 2) return;
    const result = await searchMutation.mutateAsync({ query });
    setBusinesses(result?.results ?? []);
    setStep("results");
  };

  const handleSelectBusiness = async (biz: BusinessResult) => {
    setSelectedBusiness(biz);
    setStep("loading");
    const result = await auditQuery.refetch();
    if (result.data) {
      const data = result.data as unknown as {
        metrics: AuditMetrics;
        analysis: AuditAnalysis;
        reviews: ReviewSummary[];
        competitorNames: string[];
      };
      setAuditData(data);
      try {
        sessionStorage.setItem(
          FT_HOME_AUDIT_SNAPSHOT_KEY,
          JSON.stringify({
            v: 1,
            placeId: biz.placeId,
            businessName: biz.name,
            totalReviews: biz.totalReviews,
            category: biz.category,
            address: biz.address,
            analysis: data.analysis,
            metrics: data.metrics,
          })
        );
      } catch {
        /* quota / private mode */
      }
    }
    setStep("audit");
    setTimeout(() => setShowEmailDialog(true), 2000);
  };

  const handleEmailSubmit = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    setOtpError(null);
    if (!import.meta.env.CLERK_PUBLISHABLE_KEY) {
      toast.error("Authentication is not configured.");
      return;
    }
    if (!clerkReady) {
      toast.error("Authentication is still loading — please try again in a moment.");
      return;
    }
    setOtpSending(true);
    try {
      const si = await signIn!.create({ identifier: email.trim(), strategy: "email_code" });
      setClerkSignInAttempt(si as ReturnType<typeof useSignIn>["signIn"]);
      setOtpFlow("signIn");
      setShowEmailDialog(false);
      setShowOtpDialog(true);
      toast.success("Check your email — we sent a 6-digit code!");
    } catch (err: unknown) {
      const code = (err as { errors?: Array<{ code?: string }> })?.errors?.[0]?.code;
      if (code === "form_identifier_not_found") {
        try {
          const su = await signUp!.create({ emailAddress: email.trim() });
          await su.prepareEmailAddressVerification({ strategy: "email_code" });
          setClerkSignUpAttempt(su as ReturnType<typeof useSignUp>["signUp"]);
          setOtpFlow("signUp");
          setShowEmailDialog(false);
          setShowOtpDialog(true);
          toast.success("Check your email — we sent a 6-digit code!");
        } catch (err2: unknown) {
          const msg = err2 instanceof Error ? err2.message : "Failed to send code";
          setOtpError(msg);
          toast.error(msg);
        }
      } else {
        const msg = err instanceof Error ? err.message : "Failed to send code";
        setOtpError(msg);
        toast.error(msg);
      }
    } finally {
      setOtpSending(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
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
      } else {
        setOtpError("Session expired — please request a new code.");
        return;
      }

      await new Promise((r) => setTimeout(r, 150));
      try {
        await syncHomeAuditLeadMutation.mutateAsync({
          businessName: selectedBusiness?.name ?? "",
          placeId: selectedBusiness?.placeId,
          healthScore: auditData?.metrics.healthScore,
          responseRate: auditData?.metrics.responseRate,
          totalReviews: auditData?.metrics.totalReviews,
          averageRating: String(auditData?.metrics.averageRating ?? ""),
        });
      } catch (syncErr) {
        console.warn("[Home] syncHomeAuditLead:", syncErr);
        toast.error("You're signed in, but we couldn't save your audit lead. Your report is still unlocked.");
      }

      setEmail(email.trim());
      setEmailCaptured(true);
      setShowOtpDialog(false);
      toast.success("You're signed in! Your full report is now unlocked.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      const friendly = msg.includes("incorrect") ? "Incorrect code — please check your email and try again." : msg;
      setOtpError(friendly);
      toast.error(friendly);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleAutoRespond = (review: ReviewSummary) => {
    setSelectedReview(review);
    setShowPhoneDialog(true);
  };

  const handlePhoneSubmit = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) { toast.error("Please enter a valid phone number"); return; }
    const contactEmail = authUser?.email ?? email;
    if (!contactEmail?.includes("@")) { toast.error("Please verify your email first"); return; }
    await capturePhoneMutation.mutateAsync({
      email: contactEmail,
      phone,
      businessName: selectedBusiness?.name ?? "",
      placeId: selectedBusiness?.placeId,
    });
    setShowPhoneDialog(false);
    setDemoLoading(true);
    setStep("demo");
    const result = await generateDemoMutation.mutateAsync({
      reviewText: selectedReview?.text ?? "", reviewerName: selectedReview?.authorName ?? "Customer",
      rating: selectedReview?.rating ?? 4, businessName: selectedBusiness?.name ?? "",
    });
    setDemoResponse(String(result.response ?? ""));
    setDemoLoading(false);
    toast.success("AI response generated! Check your phone for the SMS alert.");
  };

  const metrics = auditData?.metrics;
  const analysis = auditData?.analysis;
  const unansweredReviews = auditData?.reviews.filter((r) => !r.hasOwnerResponse) ?? [];
  const [sendingReport, setSendingReport] = useState(false);
  const sendDetailedReportMutation = trpc.audit.sendDetailedReport.useMutation();

  const handleSendDetailedReport = async () => {
    const reportEmail = authUser?.email ?? email;
    if (!reportEmail || !emailCaptured) { toast.error("Please verify your email first"); return; }
    setSendingReport(true);
    try {
      await sendDetailedReportMutation.mutateAsync({
        email: reportEmail,
        businessName: selectedBusiness?.name ?? "",
        placeId: selectedBusiness?.placeId ?? "",
      });
      toast.success("Detailed report sent! Check your inbox.");
    } catch {
      toast.error("Failed to send report. Please try again.");
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663492121254/dd2dpCppv6NJGLXJF3QZ3N/watchreviews-logo_022832b1.png" alt="WatchReviews" className="w-8 h-8 object-contain" />
              <span className="font-bold text-xl text-slate-900">Watch<span className="text-blue-600">Reviews</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {authLoading ? (
              <div className="w-16 h-8" /> /* placeholder while auth loads */
            ) : isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => setLocation("/dashboard")}>Dashboard</Button>
                <Button variant="ghost" size="sm" className="text-slate-600" onClick={logout}>Sign Out</Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => setLocation("/sign-in")}>Sign In</Button>
            )}
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => document.getElementById("audit-search")?.scrollIntoView({ behavior: "smooth" })}>
              Free Audit
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 text-center">
          <Badge className="mb-6 bg-blue-500/20 text-blue-300 border-blue-500/30 px-4 py-1.5">AI-Powered Google Reviews Automation</Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Your Reviews Are Costing You<br /><span className="text-blue-400">Customers Every Day</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            We scan your Google Business Profile, show you exactly what's broken, and automatically respond to every review — while you focus on running your business.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6"
              onClick={() => document.getElementById("audit-search")?.scrollIntoView({ behavior: "smooth" })}>
              Get Your Free Business Audit <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 bg-transparent"
              onClick={() => setLocation("/free-trial")}>
              Start Free Trial
            </Button>
          </div>
          <div className="flex items-center justify-center gap-8 mt-10 text-sm text-slate-400">
            {["No credit card now", "14-day free trial", "Real AI responses"].map((t) => (
              <div key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Audit Tool */}
      <section id="audit-search" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">

          {/* Search & Results */}
          {(step === "search" || step === "results") && (
            <div>
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-900 mb-3">Search Your Business</h2>
                <p className="text-slate-500">Type your business name and we'll run a live forensic audit of your Google presence</p>
              </div>
              <div className="flex gap-3 mb-6">
                <Input placeholder="e.g. Joe's Pizza New York" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="text-lg py-6 border-2 border-slate-200 focus:border-blue-500" />
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-6" onClick={handleSearch} disabled={searchMutation.isPending}>
                  {searchMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>
              {step === "results" && businesses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 font-medium">Select your business:</p>
                  {businesses.map((biz) => (
                    <button key={biz.placeId} onClick={() => handleSelectBusiness(biz)}
                      className="w-full text-left p-4 bg-white border-2 border-slate-200 hover:border-blue-500 rounded-xl transition-all group">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{biz.name}</div>
                          <div className="text-sm text-slate-500 mt-0.5">{biz.address}</div>
                          {biz.category && <Badge variant="secondary" className="mt-2 text-xs">{biz.category}</Badge>}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          {biz.rating && <StarRating rating={biz.rating} />}
                          {biz.totalReviews && <div className="text-xs text-slate-400 mt-1">{biz.totalReviews} reviews</div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {step === "results" && businesses.length === 0 && (
                <div className="text-center py-8 text-slate-500">No businesses found. Try a more specific search.</div>
              )}
            </div>
          )}

          {/* Audit in progress */}
          {step === "loading" && (
            <div className="text-center py-16">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Running Business Forensic Analysis</h2>
              <p className="text-slate-500">
                Analyzing <span className="font-semibold text-blue-600">{selectedBusiness?.name}</span>
              </p>
            </div>
          )}

          {/* Audit Results */}
          {(step === "audit" || step === "demo") && metrics && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Business Forensic Report</h2>
                <p className="text-slate-500 mt-1">{selectedBusiness?.name}</p>
              </div>

              <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 mb-6 shadow-sm">
                <div className="flex justify-around">
                  <ScoreRing score={metrics.healthScore} label="Business Health" color="#3b82f6" />
                  <ScoreRing score={metrics.sentimentScore} label="Customer Sentiment" color="#8b5cf6" />
                  <ScoreRing score={metrics.responseRate} label="Response Rate" color="#10b981" />
                </div>
              </div>

              <div className="relative mb-6">
                <div className={`grid grid-cols-2 gap-4 ${!emailCaptured ? "blur-sm pointer-events-none select-none" : ""}`}>
                  <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1"><MessageSquare className="h-4 w-4" /> Total Reviews</div>
                    <div className="text-2xl font-bold text-slate-900">{metrics.totalReviews}</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1"><Star className="h-4 w-4" /> Avg Rating</div>
                    <div className="text-2xl font-bold text-slate-900">{metrics.averageRating} ⭐</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-500 text-sm mb-1"><AlertCircle className="h-4 w-4" /> Unanswered</div>
                    <div className="text-2xl font-bold text-amber-600">{metrics.unansweredCount}</div>
                    <div className="text-xs text-slate-400">reviews need a response</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1"><TrendingUp className="h-4 w-4" /> Review Velocity</div>
                    <div className="text-sm font-semibold text-slate-900">{metrics.reviewVelocity}</div>
                  </div>
                </div>
                {!emailCaptured && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-xl border border-blue-100 text-center max-w-xs">
                      <Lock className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                      <h3 className="font-bold text-slate-900 mb-1">Unlock Your Full Report</h3>
                      <p className="text-sm text-slate-500 mb-4">Enter your email to see all metrics and pain points</p>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                        onClick={() => {
                          setOtpError(null);
                          setShowEmailDialog(true);
                        }}
                      >
                        Unlock Free Report
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {emailCaptured && analysis && (
                <div className="space-y-4 mb-6">
                  {/* Row 1: Pain Points + What Customers Love */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-50 rounded-xl border border-red-100 p-4">
                      <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Customer Pain Points</h3>
                      <ul className="space-y-2">{analysis.painPoints.map((p: string, i: number) => <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="mt-1 shrink-0">•</span>{p}</li>)}</ul>
                    </div>
                    <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
                      <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> What Customers Love</h3>
                      <ul className="space-y-2">{analysis.topPraises.map((p: string, i: number) => <li key={i} className="text-sm text-emerald-700 flex items-start gap-2"><span className="mt-1 shrink-0">•</span>{p}</li>)}</ul>
                    </div>
                  </div>

                  {/* Row 2: Staff Signals + Operational Issues */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-violet-50 rounded-xl border border-violet-100 p-4">
                      <h3 className="font-semibold text-violet-800 mb-3 flex items-center gap-2"><Shield className="h-4 w-4" /> Staff Performance Signals</h3>
                      {analysis.staffSignals.filter((s: StaffSignal) => s.sentiment === "positive").length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-emerald-600 mb-1">Praised</p>
                          <ul className="space-y-1">{analysis.staffSignals.filter((s: StaffSignal) => s.sentiment === "positive").map((s: StaffSignal, i: number) => <li key={i} className="text-sm text-violet-700 flex items-start gap-2"><span className="text-emerald-500">+</span>{s.name} — {s.context}</li>)}</ul>
                        </div>
                      )}
                      {analysis.staffSignals.filter((s: StaffSignal) => s.sentiment === "negative").length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-500 mb-1">Flagged</p>
                          <ul className="space-y-1">{analysis.staffSignals.filter((s: StaffSignal) => s.sentiment === "negative").map((s: StaffSignal, i: number) => <li key={i} className="text-sm text-violet-700 flex items-start gap-2"><span className="text-red-500">−</span>{s.name} — {s.context}</li>)}</ul>
                        </div>
                      )}
                      {analysis.staffSignals.length === 0 && (
                        <p className="text-sm text-violet-600">No specific staff mentions found in recent reviews.</p>
                      )}
                    </div>
                    <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                      <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Operational Issues</h3>
                      {analysis.operationalIssues.length > 0
                        ? <ul className="space-y-2">{analysis.operationalIssues.map((o: string, i: number) => <li key={i} className="text-sm text-amber-700 flex items-start gap-2"><span className="mt-1 shrink-0">⚠</span>{o}</li>)}</ul>
                        : <p className="text-sm text-amber-600">No major operational issues flagged in recent reviews.</p>}
                    </div>
                  </div>

                  {/* Row 3: Sentiment Trend + Competitor Gap */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                      <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" /> Sentiment Trend</h3>
                      <div className="flex items-end gap-2 h-20">
                        {[{ label: "Oldest", score: analysis.sentimentTrend.oldestFour }, { label: "Recent", score: analysis.sentimentTrend.newestFour }].map((point, i) => {
                          const pct = Math.max(10, Math.min(100, point.score));
                          const color = point.score >= 70 ? "bg-emerald-400" : point.score >= 45 ? "bg-amber-400" : "bg-red-400";
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div className={`w-full rounded-t-sm ${color} transition-all`} style={{ height: `${pct}%` }} />
                              <span className="text-xs text-slate-400 truncate w-full text-center">{point.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">{analysis.sentimentTrend.summary}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Happy (≥70)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Mixed (45–69)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Unhappy (&lt;45)</span>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                      <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Competitor Gap</h3>
                      {(analysis.competitorKeywordGap ?? []).length > 0
                        ? <ul className="space-y-2">{(analysis.competitorKeywordGap ?? []).map((g: string, i: number) => <li key={i} className="text-sm text-blue-700 flex items-start gap-2"><span className="mt-1 shrink-0">→</span>{g}</li>)}</ul>
                        : <p className="text-sm text-blue-600">{metrics?.competitorBenchmark}</p>}
                    </div>
                  </div>

                  {/* Row 4 (col-span-2): Do This Now */}
                  <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-xl p-5 text-white">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0 mt-0.5"><Zap className="h-5 w-5 text-white" /></div>
                      <div className="flex-1">
                        <h3 className="font-bold text-white mb-1">Do This Now</h3>
                        <ul className="space-y-1">{(analysis.doThisNow ?? []).map((item: string, i: number) => <li key={i} className="text-blue-100 text-sm flex items-start gap-2"><span className="mt-0.5 shrink-0">→</span>{item}</li>)}</ul>
                      </div>
                    </div>
                  </div>

                  {/* See More Details */}
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={handleSendDetailedReport} disabled={sendingReport}>
                      {sendingReport ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending report...</> : <><Mail className="h-4 w-4 mr-2" />See More Details — Send Full Report to My Email</>}
                    </Button>
                  </div>
                </div>
              )}

              {emailCaptured && unansweredReviews.length > 0 && step !== "demo" && (
                <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-sm mb-6">
                  <div className="flex items-center gap-2 mb-4"><Zap className="h-5 w-5 text-blue-600" /><h3 className="font-bold text-slate-900">Try It Live — Auto-Respond Now</h3></div>
                  <p className="text-sm text-slate-500 mb-4">Click "Auto Respond" on any unanswered review to see AI generate a real response in seconds.</p>
                  <div className="space-y-3">
                    {unansweredReviews.slice(0, 3).map((review) => (
                      <div key={review.reviewId} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm text-slate-900">{review.authorName}</span>
                              <StarRating rating={review.rating} />
                              <span className="text-xs text-slate-400">{review.relativeTime}</span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">{review.text}</p>
                          </div>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={() => handleAutoRespond(review)}>
                            <Zap className="h-3.5 w-3.5 mr-1" /> Auto Respond
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === "demo" && (
                <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-sm mb-6">
                  <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="font-bold text-slate-900">AI Response Generated!</h3></div>
                  {selectedReview && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{selectedReview.authorName}</span><StarRating rating={selectedReview.rating} /></div>
                      <p className="text-sm text-slate-600 italic">"{selectedReview.text}"</p>
                    </div>
                  )}
                  {demoLoading ? (
                    <div className="flex items-center gap-3 text-blue-600 py-4"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">AI is crafting your response...</span></div>
                  ) : (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2"><MessageSquare className="h-4 w-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-700">Owner Response (AI Draft)</span></div>
                      <p className="text-sm text-slate-700">{demoResponse}</p>
                    </div>
                  )}
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2 text-sm text-blue-700">
                    <Phone className="h-4 w-4 shrink-0" /> SMS alert sent to your phone. Check your email to approve or deny this response.
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-8 text-white text-center mt-6">
                <h3 className="text-2xl font-bold mb-2">Ready to Automate Your Reviews?</h3>
                <p className="text-blue-100 mb-6">Book a 15-minute demo call and we'll show you exactly how WatchReviews works for your business.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
                    onClick={() => window.open(import.meta.env.VITE_CALENDLY_URL || "https://calendly.com", "_blank")}>
                    <Calendar className="h-5 w-5 mr-2" /> Book Free Demo Call
                  </Button>
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => {
                    // Save audit context so FreeTrial can skip redundant steps
                    if (selectedBusiness && email) {
                      sessionStorage.setItem("ft_email", email);
                      sessionStorage.setItem("ft_business", JSON.stringify(selectedBusiness));
                      if (auditData?.reviews) {
                        sessionStorage.setItem("ft_reviews", JSON.stringify(auditData.reviews.map(r => ({
                          reviewId: r.reviewId,
                          authorName: r.authorName,
                          rating: r.rating,
                          text: r.text,
                          relativeTime: r.relativeTime,
                          hasOwnerResponse: r.hasOwnerResponse,
                        }))));
                      }
                    }
                    setLocation("/free-trial");
                  }}>
                    Start Free Trial
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything You Need to Win on Google</h2>
            <p className="text-slate-500 max-w-xl mx-auto">WatchReviews handles the entire review response lifecycle — from detection to posting — while you stay in control.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, color: "text-blue-600", bg: "bg-blue-50", title: "AI Responses in Seconds", desc: "GPT-4 class AI generates personalized, on-brand responses to every review — 1-star to 5-star." },
              { icon: Shield, color: "text-violet-600", bg: "bg-violet-50", title: "You Stay in Control", desc: "Every response goes to you via Telegram or email for approval before it's posted. One tap to approve." },
              { icon: BarChart3, color: "text-emerald-600", bg: "bg-emerald-50", title: "Business Intelligence", desc: "Weekly health checks, sentiment trends, competitor benchmarks, and customer pain point analysis." },
              { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", title: "24/7 Monitoring", desc: "New reviews are detected within 15 minutes and processed automatically — even while you sleep." },
              { icon: MessageSquare, color: "text-pink-600", bg: "bg-pink-50", title: "Brand Voice Training", desc: "Set your tone, avoid phrases, and define templates by star rating for perfectly on-brand responses." },
              { icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50", title: "Review Generation", desc: "Legendary plan includes automated SMS campaigns to past customers requesting Google reviews." },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4`}><f.icon className={`h-6 w-6 ${f.color}`} /></div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-14">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {[
              { step: "1", title: "Connect", desc: "Add us as a manager on your Google Business Profile — takes 2 minutes." },
              { step: "2", title: "Monitor", desc: "We watch your reviews 24/7 and detect new ones within 15 minutes." },
              { step: "3", title: "Generate", desc: "AI crafts a personalized, on-brand response to every review." },
              { step: "4", title: "Approve & Post", desc: "You approve via Telegram or email. We post it instantly to Google." },
              { step: "5", title: "Analytics Reports", desc: "Every 2 weeks we send a full business intelligence report: sentiment trends, competitor gaps, and smart suggestions." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">{s.step}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663492121254/dd2dpCppv6NJGLXJF3QZ3N/watchreviews-logo_022832b1.png" alt="WatchReviews" className="w-6 h-6 object-contain" />
            <span className="font-semibold text-white">WatchReviews</span>
          </div>
          <p className="text-sm">© {new Date().getFullYear()} WatchReviews by FourthWatch. All rights reserved.</p>
          {!authLoading && (
            isAuthenticated ? (
              <button onClick={logout} className="text-sm hover:text-white transition-colors">Sign Out</button>
            ) : (
              <button onClick={() => setLocation("/sign-in")} className="text-sm hover:text-white transition-colors">Sign In</button>
            )
          )}
        </div>
      </footer>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Unlock Your Full Business Report</DialogTitle>
            <DialogDescription className="text-slate-500">We'll send a verification code to confirm you're a real business owner. Your report includes pain points, competitor data, and revenue recovery opportunities.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Business Email Address</label>
              <Input type="email" placeholder="you@yourbusiness.com" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()} className="border-2" />
            </div>
            {otpError && showEmailDialog && (
              <p className="text-sm text-red-600 text-center">{otpError}</p>
            )}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleEmailSubmit} disabled={otpSending}>
              {otpSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending code...</> : <><Mail className="h-4 w-4 mr-2" />Send Verification Code</>}
            </Button>
            <p className="text-xs text-slate-400 text-center">We respect your privacy. No spam, ever.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* OTP Verification Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Enter Your Verification Code</DialogTitle>
            <DialogDescription className="text-slate-500">We sent a 6-digit code to <strong>{email}</strong>. Enter it below to unlock your full business report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">6-Digit Code</label>
              <Input type="text" inputMode="numeric" maxLength={6} placeholder="123456" value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleOtpSubmit()}
                className="border-2 text-center text-2xl tracking-widest font-mono" />
            </div>
            {otpError && (
              <p className="text-sm text-red-600 text-center">{otpError}</p>
            )}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleOtpSubmit} disabled={otpVerifying}>
              {otpVerifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Verify & Unlock Report</>}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowOtpDialog(false);
                setShowEmailDialog(true);
                setOtpCode("");
                setOtpError(null);
                setClerkSignInAttempt(null);
                setClerkSignUpAttempt(null);
                setOtpFlow(null);
              }}
              className="text-xs text-blue-600 hover:underline w-full text-center"
            >
              Didn&apos;t get the code? Resend
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phone Dialog */}
      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Get Your AI Response via SMS</DialogTitle>
            <DialogDescription className="text-slate-500">Add your phone number and we'll text you when your AI response is ready to approve. This is exactly how WatchReviews works for your business.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Mobile Phone Number</label>
              <Input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()} className="border-2" />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePhoneSubmit}
              disabled={capturePhoneMutation.isPending || generateDemoMutation.isPending}>
              {capturePhoneMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Setting up demo...</> : <><Phone className="h-4 w-4 mr-2" />Generate AI Response & Alert Me</>}
            </Button>
            <p className="text-xs text-slate-400 text-center">Standard SMS rates apply. Reply STOP to opt out.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
