import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import {
  Star,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Edit3,
  RefreshCw,
  Plus,
  Settings,
  BarChart3,
  MessageSquare,
  AlertCircle,
  Loader2,
  Phone,
  Sparkles,
  Building2,
  TrendingUp,
  CheckCircle2,
  Shield,
  Zap,
  ArrowRight,
} from "lucide-react";
import { ResponseApprovalCard } from "@/components/ResponseApprovalCard";

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    new: { label: "New", className: "bg-blue-100 text-blue-700" },
    processing: { label: "Processing", className: "bg-amber-100 text-amber-700" },
    pending_approval: { label: "Pending Approval", className: "bg-orange-100 text-orange-700" },
    posted: { label: "Posted", className: "bg-green-100 text-green-700" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
    manual: { label: "Manual", className: "bg-purple-100 text-purple-700" },
  };
  const s = map[status] || { label: status, className: "bg-gray-100 text-gray-600" };
  return <Badge className={`${s.className} border-0 text-xs`}>{s.label}</Badge>;
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

// ─── Audit Results Panel ──────────────────────────────────────────────────────
function AuditResultsPanel({ businessName, analysis, metrics }: {
  businessName: string;
  analysis: AuditAnalysis;
  metrics: AuditMetrics;
}) {
  return (
    <div className="space-y-4 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Business Forensic Report</h2>
          <p className="text-sm text-gray-500">{businessName}</p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Latest Audit</Badge>
      </div>

      {/* Score rings */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex justify-around">
          <ScoreRing score={metrics.healthScore} label="Business Health" color="#3b82f6" />
          <ScoreRing score={metrics.sentimentScore} label="Customer Sentiment" color="#8b5cf6" />
          <ScoreRing score={metrics.responseRate} label="Response Rate" color="#10b981" />
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><MessageSquare className="h-4 w-4" /> Total Reviews</div>
          <div className="text-2xl font-bold text-gray-900">{metrics.totalReviews}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Star className="h-4 w-4" /> Avg Rating</div>
          <div className="text-2xl font-bold text-gray-900">{metrics.averageRating} ⭐</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-500 text-sm mb-1"><AlertCircle className="h-4 w-4" /> Unanswered</div>
          <div className="text-2xl font-bold text-amber-600">{metrics.unansweredCount}</div>
          <div className="text-xs text-gray-400">need a response</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><TrendingUp className="h-4 w-4" /> Velocity</div>
          <div className="text-sm font-semibold text-gray-900">{metrics.reviewVelocity}</div>
        </div>
      </div>

      {/* Row 1: Pain Points + Praises */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Customer Pain Points</h3>
          <ul className="space-y-2">
            {analysis.painPoints.map((p, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2"><span className="mt-1 shrink-0">•</span>{p}</li>
            ))}
          </ul>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> What Customers Love</h3>
          <ul className="space-y-2">
            {analysis.topPraises.map((p, i) => (
              <li key={i} className="text-sm text-emerald-700 flex items-start gap-2"><span className="mt-1 shrink-0">•</span>{p}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Row 2: Staff Signals + Operational Issues */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-violet-50 rounded-xl border border-violet-100 p-4">
          <h3 className="font-semibold text-violet-800 mb-3 flex items-center gap-2"><Shield className="h-4 w-4" /> Staff Performance Signals</h3>
          {analysis.staffSignals.filter((s) => s.sentiment === "positive").length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-emerald-600 mb-1">Praised</p>
              <ul className="space-y-1">
                {analysis.staffSignals.filter((s) => s.sentiment === "positive").map((s, i) => (
                  <li key={i} className="text-sm text-violet-700 flex items-start gap-2"><span className="text-emerald-500">+</span>{s.name} — {s.context}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.staffSignals.filter((s) => s.sentiment === "negative").length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1">Flagged</p>
              <ul className="space-y-1">
                {analysis.staffSignals.filter((s) => s.sentiment === "negative").map((s, i) => (
                  <li key={i} className="text-sm text-violet-700 flex items-start gap-2"><span className="text-red-500">−</span>{s.name} — {s.context}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.staffSignals.length === 0 && (
            <p className="text-sm text-violet-600">No specific staff mentions found in recent reviews.</p>
          )}
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Operational Issues</h3>
          {analysis.operationalIssues.length > 0
            ? <ul className="space-y-2">{analysis.operationalIssues.map((o, i) => <li key={i} className="text-sm text-amber-700 flex items-start gap-2"><span className="mt-1 shrink-0">⚠</span>{o}</li>)}</ul>
            : <p className="text-sm text-amber-600">No major operational issues flagged in recent reviews.</p>}
        </div>
      </div>

      {/* Row 3: Sentiment Trend + Competitor Gap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" /> Sentiment Trend</h3>
          <div className="flex items-end gap-2 h-20">
            {[{ label: "Oldest", score: analysis.sentimentTrend.oldestFour }, { label: "Recent", score: analysis.sentimentTrend.newestFour }].map((point, i) => {
              const pct = Math.max(10, Math.min(100, point.score));
              const color = point.score >= 70 ? "bg-emerald-400" : point.score >= 45 ? "bg-amber-400" : "bg-red-400";
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-t-sm ${color} transition-all`} style={{ height: `${pct}%` }} />
                  <span className="text-xs text-gray-400 truncate w-full text-center">{point.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">{analysis.sentimentTrend.summary}</p>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Happy (≥70)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Mixed (45–69)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Unhappy (&lt;45)</span>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Competitor Gap</h3>
          {(analysis.competitorKeywordGap ?? []).length > 0
            ? <ul className="space-y-2">{(analysis.competitorKeywordGap ?? []).map((g, i) => <li key={i} className="text-sm text-blue-700 flex items-start gap-2"><span className="mt-1 shrink-0">→</span>{g}</li>)}</ul>
            : <p className="text-sm text-blue-600">No competitor gap data available yet.</p>}
        </div>
      </div>

      {/* Do This Now */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-xl p-5 text-white">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white mb-1">Do This Now</h3>
            <ul className="space-y-1">
              {(analysis.doThisNow ?? []).map((item, i) => (
                <li key={i} className="text-blue-100 text-sm flex items-start gap-2"><span className="mt-0.5 shrink-0">→</span>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to check promo cookie
function hasPromoAccess() {
  return document.cookie.split(";").some((c) => c.trim().startsWith("wr_access=freecode"));
}

export default function Dashboard() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [pollingLocationId, setPollingLocationId] = useState<number | null>(null);
  const promoAccess = hasPromoAccess();

  const clientQuery = trpc.clients.me.useQuery();
  const locationsQuery = trpc.locations.list.useQuery(undefined, { enabled: !!clientQuery.data });
  const responsesQuery = trpc.responses.list.useQuery({ limit: 50 }, { enabled: !!clientQuery.data });
  const utils = trpc.useUtils();

  const [pollAuditSave, setPollAuditSave] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("ft_audit_saving") === "1"
  );

  // Fetch saved audit — by userId if authenticated, else by email from profile or sessionStorage fallback
  const sessionEmail = typeof window !== "undefined" ? (sessionStorage.getItem("ft_email") ?? undefined) : undefined;
  const auditInput = useMemo(() => ({
    // user.id can be 0 (falsy) while DB record is loading — only pass it when it's a real positive ID
    userId: (user?.id && user.id > 0) ? user.id : undefined,
    email: user?.email ?? sessionEmail ?? undefined,
  }), [user?.id, user?.email, sessionEmail]);
  const auditQuery = trpc.audit.getMyAudit.useQuery(auditInput, {
    // Always run if we have any identifier — real userId, account email, or sessionStorage email
    enabled: !!(auditInput.userId || auditInput.email),
    staleTime: 5 * 60 * 1000,
    refetchInterval: pollAuditSave ? 2800 : false,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setPollAuditSave(sessionStorage.getItem("ft_audit_saving") === "1");
    }, 1200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auditQuery.data) return;
    sessionStorage.removeItem("ft_audit_saving");
    setPollAuditSave(false);
  }, [auditQuery.data]);

  const pollNow = trpc.locations.pollNow.useMutation({
    onSuccess: () => {
      toast.success("Poll complete — new reviews fetched");
      utils.responses.list.invalidate();
      setPollingLocationId(null);
    },
    onError: () => {
      toast.error("Poll failed — check your Google connection");
      setPollingLocationId(null);
    },
  });

  const approveMutation = trpc.responses.approve.useMutation({
    onSuccess: () => {
      toast.success("Response approved and posted to Google!");
      utils.responses.list.invalidate();
    },
    onError: () => toast.error("Failed to post response"),
  });

  const rejectMutation = trpc.responses.reject.useMutation({
    onSuccess: () => {
      toast.success("Response rejected — client will respond manually");
      utils.responses.list.invalidate();
    },
    onError: () => toast.error("Failed to reject response"),
  });

  const regenerateMutation = trpc.responses.regenerate.useMutation({
    onSuccess: () => {
      toast.success("New AI draft generated");
      utils.responses.list.invalidate();
    },
    onError: () => toast.error("Failed to regenerate"),
  });

  // Wait for auth session + profile before routing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated && !promoAccess) {
    navigate("/");
    return null;
  }

  if (clientQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Sidebar component (shared between all branches)
  const SidebarContent = ({ businessName }: { businessName?: string }) => (
    <aside className="w-64 bg-[oklch(0.13_0.03_250)] text-white flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663492121254/dd2dpCppv6NJGLXJF3QZ3N/watchreviews-logo_022832b1.png" alt="WatchReviews" className="w-8 h-8 object-contain" />
          <span className="font-display font-700 text-base">WatchReviews</span>
        </div>
        {businessName && <p className="text-xs text-white/50 mt-1 truncate">{businessName}</p>}
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {[
          { icon: <BarChart3 className="w-4 h-4" />, label: "Dashboard", href: "/dashboard", active: true },
          { icon: <MessageSquare className="w-4 h-4" />, label: "Reviews", href: "/reviews" },
          { icon: <MapPin className="w-4 h-4" />, label: "Locations", href: "/locations" },
          { icon: <Settings className="w-4 h-4" />, label: "Brand Voice", href: "/brand-voice" },
          { icon: <Settings className="w-4 h-4" />, label: "Settings", href: "/settings" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              item.active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}>
              {item.icon}
              {item.label}
            </div>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        {promoAccess && (
          <div className="mb-3 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
            <span className="text-xs text-amber-300 font-medium">Demo Access</span>
          </div>
        )}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() || "D"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "Demo User"}</p>
            <p className="text-xs text-white/50 truncate">{user?.email || "demo access"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full text-white/60 hover:text-white hover:bg-white/10" onClick={logout}>
          Sign out
        </Button>
      </div>
    </aside>
  );

  // If no client record — show audit data if available, else setup prompt
  if (!clientQuery.data) {
    const savedAudit = auditQuery.data;
    const auditWait =
      auditQuery.isLoading || auditQuery.isFetching || pollAuditSave;
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen overflow-hidden">
          <SidebarContent businessName={savedAudit?.businessName} />
          <main className="flex-1 overflow-y-auto p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {savedAudit ? `Business audit for ${savedAudit.businessName}` : "Complete setup to start managing reviews"}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => {
                    if (import.meta.env.VITE_CALENDLY_URL) {
                      window.open(import.meta.env.VITE_CALENDLY_URL, "_blank");
                    } else {
                      toast("Our team will reach out to schedule your live replies setup call!");
                    }
                  }}
                >
                  <Phone className="w-4 h-4 mr-1" /> Start Live Replies
                </Button>
                <Link href="/free-trial">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Building2 className="w-4 h-4 mr-1" /> Complete Setup
                  </Button>
                </Link>
              </div>
            </div>

            {/* Audit loading / background save in progress */}
            {auditWait && !savedAudit && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    {pollAuditSave && !auditQuery.isLoading
                      ? "Saving your business report… this can take a minute."
                      : "Loading your business audit..."}
                  </p>
                </div>
              </div>
            )}

            {/* Audit results */}
            {savedAudit && (
              <AuditResultsPanel
                businessName={savedAudit.businessName}
                analysis={savedAudit.analysis as AuditAnalysis}
                metrics={savedAudit.metrics as AuditMetrics}
              />
            )}

            {/* No audit yet */}
            {!savedAudit && !auditWait && (
              <div className="max-w-lg mx-auto text-center pt-12">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  {promoAccess ? "Welcome to WatchReviews" : "Set Up Your Account"}
                </h2>
                <p className="text-gray-500 mb-8">
                  {promoAccess
                    ? "You're in demo mode. Complete the onboarding to connect your business and see your audit results here."
                    : "Complete the onboarding to connect your business and start managing reviews."}
                </p>
                <Link href="/free-trial">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                    Complete Setup <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // Full dashboard for users with a client record
  const client = clientQuery.data;
  const locations = locationsQuery.data || [];
  const responses = responsesQuery.data || [];
  const pendingResponses = responses.filter((r) => r.response.status === "pending_approval");
  const postedResponses = responses.filter((r) => r.response.status === "posted");
  const savedAudit = auditQuery.data;
  const auditWaitFull =
    !savedAudit && (auditQuery.isLoading || auditQuery.isFetching || pollAuditSave);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        <SidebarContent businessName={client.businessName} />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">Manage your review responses</p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => {
                    if (import.meta.env.VITE_CALENDLY_URL) {
                      window.open(import.meta.env.VITE_CALENDLY_URL, "_blank");
                    } else {
                      toast("Our team will reach out to schedule your live replies setup call!");
                    }
                  }}
                >
                  <Phone className="w-4 h-4 mr-1" /> Start Live Replies
                </Button>
                <Link href="/free-trial">
                  <Button variant="outline" size="sm">
                    <Building2 className="w-4 h-4 mr-1" /> Add Business
                  </Button>
                </Link>
                <Link href="/brand-voice">
                  <Button variant="outline" size="sm">
                    <Sparkles className="w-4 h-4 mr-1" /> Brand Voice
                  </Button>
                </Link>
              </div>
            </div>

            {auditWaitFull && (
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 mb-6 text-sm text-blue-900">
                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-600" />
                <span>
                  {pollAuditSave
                    ? "Saving your business report to your dashboard…"
                    : "Loading your saved business audit…"}
                </span>
              </div>
            )}

            {/* Audit Results (if available) */}
            {savedAudit && (
              <AuditResultsPanel
                businessName={savedAudit.businessName}
                analysis={savedAudit.analysis as AuditAnalysis}
                metrics={savedAudit.metrics as AuditMetrics}
              />
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Locations", value: locations.length, icon: <MapPin className="w-5 h-5 text-blue-500" />, color: "bg-blue-50" },
                { label: "Pending Approval", value: pendingResponses.length, icon: <Clock className="w-5 h-5 text-amber-500" />, color: "bg-amber-50" },
                { label: "Responses Posted", value: postedResponses.length, icon: <CheckCircle className="w-5 h-5 text-green-500" />, color: "bg-green-50" },
                { label: "Total Reviews", value: responses.length, icon: <MessageSquare className="w-5 h-5 text-purple-500" />, color: "bg-purple-50" },
              ].map((stat) => (
                <Card key={stat.label} className="border-gray-100">
                  <CardContent className="p-5">
                    <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                      {stat.icon}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Locations */}
            <Card className="border-gray-100 mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Connected Locations</CardTitle>
              </CardHeader>
              <CardContent>
                {locations.length === 0 ? (
                  <div className="text-center py-8">
                    <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm mb-4">No locations connected yet</p>
                    <Link href="/onboarding">
                      <Button size="sm">Add your first location</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locations.map((loc) => (
                      <div key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${loc.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{loc.locationName}</p>
                            {loc.address && <p className="text-xs text-gray-500">{loc.address}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs border-0 ${loc.onboardingPath === "manager" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                            {loc.onboardingPath === "manager" ? "Manager" : "OAuth"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPollingLocationId(loc.id);
                              pollNow.mutate({ locationId: loc.id });
                            }}
                            disabled={pollingLocationId === loc.id}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${pollingLocationId === loc.id ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending approvals */}
            <Tabs defaultValue="pending">
              <TabsList className="mb-4">
                <TabsTrigger value="pending">
                  Pending Approval
                  {pendingResponses.length > 0 && (
                    <span className="ml-2 bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {pendingResponses.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all">All Responses</TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {pendingResponses.length === 0 ? (
                  <Card className="border-gray-100">
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                      <p className="text-gray-500">No pending approvals — you're all caught up!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingResponses.map((response) => (
                      <ResponseApprovalCard
                        key={response.response.id}
                        response={response}
                        onApprove={(finalText) => approveMutation.mutate({ responseId: response.response.id, finalText })}
                        onReject={(reason) => rejectMutation.mutate({ responseId: response.response.id, reason })}
                        onRegenerate={(instructions) => regenerateMutation.mutate({ responseId: response.response.id, instructions })}
                        isApproving={approveMutation.isPending}
                        isRejecting={rejectMutation.isPending}
                        isRegenerating={regenerateMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="all">
                <Card className="border-gray-100">
                  <CardContent className="p-0">
                    {responses.length === 0 ? (
                      <div className="py-12 text-center">
                        <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No reviews yet — connect a location to get started</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {responses.map((r) => (
                          <div key={r.response.id} className="p-4 flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {r.review.reviewerName || "Anonymous"}
                                </p>
                                <StarRating rating={r.review.rating} />
                                <StatusBadge status={r.response.status} />
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {r.review.comment || "(No written comment)"}
                              </p>
                              {r.response.finalResponse && (
                                <p className="text-xs text-gray-400 mt-1 truncate">
                                  Reply: {r.response.finalResponse}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 flex-shrink-0">
                              {new Date(r.response.createdAt || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
