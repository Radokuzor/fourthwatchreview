import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Flame,
  Home,
  Stethoscope,
  Scale,
  Briefcase,
  ShoppingBag,
  Shield,
  Sparkles,
  Loader2,
  Zap,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { INDUSTRIES, getIndustry, type Industry, type Question } from "@/lib/aiAuditContent";
import { generateAuditReport, type AuditReport } from "@/lib/aiAuditAlgorithm";

const ICON_MAP = {
  home: Home,
  stethoscope: Stethoscope,
  scale: Scale,
  briefcase: Briefcase,
  shoppingBag: ShoppingBag,
  shield: Shield,
} as const;

type Step = "industry" | "questions" | "contact" | "loading" | "results";

type ContactInfo = {
  contactName: string;
  businessName: string;
  location: string;
  email: string;
  phone: string;
  websiteUrl: string;
};

export default function AiAuditSurvey() {
  const [step, setStep] = useState<Step>("industry");
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIdx, setQuestionIdx] = useState(0);
  const [contact, setContact] = useState<ContactInfo>({
    contactName: "",
    businessName: "",
    location: "",
    email: "",
    phone: "",
    websiteUrl: "",
  });
  const [contactErrors, setContactErrors] = useState<Partial<Record<keyof ContactInfo, string>>>({});
  const [report, setReport] = useState<AuditReport | null>(null);
  const calendlyRef = useRef<HTMLDivElement | null>(null);

  const submitMutation = trpc.aiAudit.submit.useMutation();

  const industry: Industry | undefined = useMemo(
    () => (industryId ? getIndustry(industryId) : undefined),
    [industryId]
  );
  const questions: Question[] = industry?.questions ?? [];
  const currentQuestion: Question | undefined = questions[questionIdx];

  const totalSteps = questions.length + 1;
  const completedSteps =
    step === "questions" ? questionIdx : step === "contact" ? questions.length : 0;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // Inject Calendly script once when results render
  useEffect(() => {
    if (step !== "results") return;
    const id = "calendly-widget-script";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, [step]);

  function handleSelectIndustry(id: string) {
    setIndustryId(id);
    setAnswers({});
    setQuestionIdx(0);
    setStep("questions");
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
  }

  function handleAnswer(value: string) {
    if (!currentQuestion) return;
    const next = { ...answers, [currentQuestion.id]: value };
    setAnswers(next);
    if (currentQuestion.type === "select") {
      setTimeout(() => goToNextQuestion(next), 180);
    }
  }

  function goToNextQuestion(currentAnswers: Record<string, string> = answers) {
    if (questionIdx + 1 < questions.length) {
      setQuestionIdx(questionIdx + 1);
    } else {
      setStep("contact");
    }
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" })
    );
  }

  function goBackQuestion() {
    if (questionIdx === 0) {
      setStep("industry");
      setIndustryId(null);
    } else {
      setQuestionIdx(questionIdx - 1);
    }
  }

  function validateContact(): boolean {
    const errors: Partial<Record<keyof ContactInfo, string>> = {};
    if (!contact.contactName.trim()) errors.contactName = "Required";
    if (!contact.businessName.trim()) errors.businessName = "Required";
    if (!contact.location.trim()) errors.location = "Required";
    if (!/^\S+@\S+\.\S+$/.test(contact.email)) errors.email = "Enter a valid email";
    const digits = contact.phone.replace(/\D/g, "");
    if (digits.length < 7) errors.phone = "Enter a valid phone number";
    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!industry) return;
    if (!validateContact()) return;

    setStep("loading");

    const generatedReport = generateAuditReport(industry, answers);

    // Persist + notify
    try {
      await submitMutation.mutateAsync({
        industryId: industry.id,
        industryName: industry.name,
        contactName: contact.contactName.trim(),
        businessName: contact.businessName.trim(),
        location: contact.location.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        websiteUrl: contact.websiteUrl.trim() || undefined,
        answers,
        summary: {
          hoursPerWeekSaved: Math.round(generatedReport.estimatedMonthlyHoursSaved / 4),
          monthlyDollarsSaved: generatedReport.estimatedMonthlySavings,
          executiveSummary: generatedReport.summary,
          topOpportunities: generatedReport.topInsights.map((i) => i.title),
        },
      });
    } catch (err) {
      console.warn("[AiAudit] submit failed:", err);
      // Still show results even if save fails — they answered the questions
    }

    // Brief delay so the loading state feels intentional and the algorithm
    // result lands as the page resolves.
    setTimeout(() => {
      setReport(generatedReport);
      setStep("results");
      requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
    }, 1100);
  }

  function restart() {
    setStep("industry");
    setIndustryId(null);
    setAnswers({});
    setQuestionIdx(0);
    setReport(null);
    setContact({
      contactName: "",
      businessName: "",
      location: "",
      email: "",
      phone: "",
      websiteUrl: "",
    });
    setContactErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ────────────────────────── RENDER ──────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      {/* Header */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <div className="font-bold text-slate-900 text-base">FourthWatch</div>
              <div className="text-xs text-slate-500">AI Audit</div>
            </div>
          </a>
          {step !== "industry" && step !== "results" && (
            <div className="hidden sm:flex items-center gap-3 text-sm text-slate-500">
              <span>Step {step === "contact" ? questions.length + 1 : questionIdx + 1} of {totalSteps}</span>
            </div>
          )}
          {step === "results" && (
            <Button variant="ghost" size="sm" onClick={restart}>
              Take it again
            </Button>
          )}
        </div>
        {(step === "questions" || step === "contact") && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3">
            <Progress value={progressPct} className="h-1.5 bg-slate-200" />
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {step === "industry" && <IndustryPicker onSelect={handleSelectIndustry} />}

        {step === "questions" && industry && currentQuestion && (
          <QuestionStep
            industry={industry}
            question={currentQuestion}
            answer={answers[currentQuestion.id] ?? ""}
            onAnswer={handleAnswer}
            onNext={() => goToNextQuestion()}
            onBack={goBackQuestion}
            stepIndex={questionIdx}
            totalSteps={questions.length}
          />
        )}

        {step === "contact" && industry && (
          <ContactStep
            industry={industry}
            contact={contact}
            errors={contactErrors}
            setContact={setContact}
            onBack={() => {
              setStep("questions");
              setQuestionIdx(questions.length - 1);
            }}
            onSubmit={handleSubmit}
            submitting={submitMutation.isPending}
          />
        )}

        {step === "loading" && <LoadingStep industry={industry ?? null} />}

        {step === "results" && industry && report && (
          <ResultsStep
            industry={industry}
            report={report}
            contact={contact}
            calendlyRef={calendlyRef}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/60 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} FourthWatch. AI audit for ambitious operators.
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRY PICKER
// ═══════════════════════════════════════════════════════════════════════════════
function IndustryPicker({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div>
      <div className="text-center max-w-3xl mx-auto mb-12">
        <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Free 3-minute AI audit
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
          Where is AI hiding{" "}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            time and money
          </span>{" "}
          inside your business?
        </h1>
        <p className="text-lg text-slate-600">
          Answer a few quick discovery questions. We'll show you exactly where AI
          can save your team hours, recover revenue, and reduce burnout — built
          specifically for your industry.
        </p>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
          Choose your industry to start
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {INDUSTRIES.map((ind) => {
          const Icon = ICON_MAP[ind.iconKey];
          return (
            <button
              key={ind.id}
              onClick={() => onSelect(ind.id)}
              className={`group text-left bg-white rounded-2xl border-2 ${ind.border} hover:border-slate-900 p-6 transition-all hover:shadow-xl hover:-translate-y-0.5`}
            >
              <div className={`w-12 h-12 ${ind.bg} rounded-xl flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${ind.accent}`} />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1.5 leading-snug">
                {ind.name}
              </h3>
              <p className="text-sm text-slate-500 mb-4">{ind.tagline}</p>
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 group-hover:text-blue-600">
                Start audit
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-center mt-12 text-sm text-slate-500">
        No sign-in required · Takes 2-3 minutes · Personalized report at the end
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUESTION STEP
// ═══════════════════════════════════════════════════════════════════════════════
function QuestionStep({
  industry,
  question,
  answer,
  onAnswer,
  onNext,
  onBack,
  stepIndex,
  totalSteps,
}: {
  industry: Industry;
  question: Question;
  answer: string;
  onAnswer: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  stepIndex: number;
  totalSteps: number;
}) {
  const Icon = ICON_MAP[industry.iconKey];
  const canContinue = !!answer || !question.required;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-9 h-9 rounded-lg ${industry.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${industry.accent}`} />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {industry.name}
          </div>
          <div className="text-xs text-slate-400">
            Question {stepIndex + 1} of {totalSteps}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-2">
          {question.prompt}
        </h2>
        {question.helper && (
          <p className="text-slate-500 mb-6">{question.helper}</p>
        )}
        <div className="mt-6">
          {question.type === "select" && question.options && (
            <div className="grid gap-3">
              {question.options.map((opt) => {
                const selected = answer === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => onAnswer(opt)}
                    className={`text-left rounded-xl border-2 px-5 py-4 transition-all ${
                      selected
                        ? "border-blue-600 bg-blue-50/60 shadow-sm"
                        : "border-slate-200 hover:border-slate-400 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className={`text-base font-medium ${selected ? "text-blue-900" : "text-slate-900"}`}>
                        {opt}
                      </span>
                      {selected && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {question.type === "text" && (
            <Textarea
              value={answer}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder={question.placeholder ?? "Type your answer…"}
              rows={4}
              className="text-base resize-none"
              autoFocus
            />
          )}

          {question.type === "number" && (
            <Input
              type="number"
              value={answer}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder={question.placeholder ?? "0"}
              className="text-base h-12"
              autoFocus
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
        {(question.type === "text" || question.type === "number") && (
          <Button onClick={onNext} disabled={!canContinue} className="bg-slate-900 hover:bg-slate-800 text-white">
            Continue <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT STEP
// ═══════════════════════════════════════════════════════════════════════════════
function ContactStep({
  industry,
  contact,
  errors,
  setContact,
  onBack,
  onSubmit,
  submitting,
}: {
  industry: Industry;
  contact: ContactInfo;
  errors: Partial<Record<keyof ContactInfo, string>>;
  setContact: React.Dispatch<React.SetStateAction<ContactInfo>>;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const Icon = ICON_MAP[industry.iconKey];
  function setField<K extends keyof ContactInfo>(key: K, value: string) {
    setContact((c) => ({ ...c, [key]: value }));
  }
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-9 h-9 rounded-lg ${industry.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${industry.accent}`} />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Last step
          </div>
          <div className="text-xs text-slate-400">Where should we send your results?</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-start gap-3 mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <div className="font-semibold">Your audit is ready.</div>
            <div className="text-emerald-700">
              Tell us where to send it — and you'll see your personalized AI opportunity
              report on the next screen.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Your name" error={errors.contactName}>
            <Input
              value={contact.contactName}
              onChange={(e) => setField("contactName", e.target.value)}
              placeholder="Jane Doe"
              className="h-11"
            />
          </Field>
          <Field label="Business name" error={errors.businessName}>
            <Input
              value={contact.businessName}
              onChange={(e) => setField("businessName", e.target.value)}
              placeholder="Acme Property Management"
              className="h-11"
            />
          </Field>
          <Field label="Location" error={errors.location}>
            <Input
              value={contact.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="Austin, TX"
              className="h-11"
            />
          </Field>
          <Field label="Website (optional)" error={errors.websiteUrl}>
            <Input
              value={contact.websiteUrl}
              onChange={(e) => setField("websiteUrl", e.target.value)}
              placeholder="acmepm.com"
              className="h-11"
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              value={contact.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="jane@acmepm.com"
              className="h-11"
            />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input
              type="tel"
              value={contact.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="(555) 123-4567"
              className="h-11"
            />
          </Field>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          We'll only use this to send your report and follow up on your audit. No spam, no list-selling.
        </p>
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-600/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating report…
            </>
          ) : (
            <>
              See my AI opportunity report <ArrowRight className="w-4 h-4 ml-1.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {children}
      {error && (
        <span className="block text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </span>
      )}
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING STEP
// ═══════════════════════════════════════════════════════════════════════════════
function LoadingStep({ industry }: { industry: Industry | null }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phases = [
    "Reviewing your responses…",
    "Mapping AI opportunities…",
    "Calculating estimated savings…",
    "Building your custom report…",
  ];
  useEffect(() => {
    const t = setInterval(() => {
      setPhaseIdx((i) => (i + 1) % phases.length);
    }, 320);
    return () => clearInterval(t);
  }, []);

  const Icon = industry ? ICON_MAP[industry.iconKey] : Sparkles;

  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <div className="relative inline-flex">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
          <Icon className="w-10 h-10 text-white" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 animate-ping" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-2">
        Building your custom report
      </h2>
      <p className="text-slate-500 mb-2">{phases[phaseIdx]}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Usually takes 2-4 seconds
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS STEP
// ═══════════════════════════════════════════════════════════════════════════════
function ResultsStep({
  industry,
  report,
  contact,
  calendlyRef,
}: {
  industry: Industry;
  report: AuditReport;
  contact: ContactInfo;
  calendlyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const Icon = ICON_MAP[industry.iconKey];
  const calendlyUrl =
    "https://calendly.com/radianceokuzor/30min?hide_gdpr_banner=1";

  function scrollToCalendly() {
    calendlyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-violet-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl ${industry.bg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${industry.accent}`} />
          </div>
          <Badge className="bg-white/10 text-white hover:bg-white/10 border-white/20">
            Your custom AI audit · {industry.name}
          </Badge>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
          {report.headline}
        </h1>
        <p className="text-blue-100 text-lg max-w-3xl">{report.summary}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          <ScoreTile
            label="Time waste"
            value={report.scores.timeWaste}
            icon={Clock}
            tone="amber"
          />
          <ScoreTile
            label="Money leak"
            value={report.scores.moneyLeak}
            icon={DollarSign}
            tone="rose"
          />
          <ScoreTile
            label="Burnout risk"
            value={report.scores.burnoutRisk}
            icon={Flame}
            tone="orange"
          />
          <ScoreTile
            label="AI upside"
            value={report.scores.aiReadiness}
            icon={TrendingUp}
            tone="emerald"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="text-xs uppercase tracking-wide text-blue-200 mb-1">
              Estimated time recoverable
            </div>
            <div className="text-3xl font-bold">
              {report.estimatedMonthlyHoursSaved} hrs<span className="text-base font-normal text-blue-200">/mo</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="text-xs uppercase tracking-wide text-blue-200 mb-1">
              Estimated monthly savings
            </div>
            <div className="text-3xl font-bold">
              ${report.estimatedMonthlySavings.toLocaleString()}<span className="text-base font-normal text-blue-200">/mo</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            className="bg-white text-slate-900 hover:bg-slate-100 font-semibold"
            onClick={scrollToCalendly}
          >
            <Calendar className="w-5 h-5 mr-2" /> Book a 30-min call
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            Share your audit link
          </Button>
        </div>
      </section>

      {/* Top opportunities */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Your top AI opportunities
            </h2>
            <p className="text-slate-500 mt-1">
              Ranked by impact — based on what you told us about {contact.businessName || "your business"}.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {report.topInsights.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              You're already running tight! Let's talk about higher-leverage moves on
              the call below.
            </div>
          ) : (
            report.topInsights.map((insight, i) => (
              <InsightCard key={insight.id} insight={insight} rank={i + 1} />
            ))
          )}
        </div>
      </section>

      {/* AI services overview */}
      <section className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <Badge className="mb-3 bg-violet-100 text-violet-700 hover:bg-violet-100 border-0">
            Our AI services
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            How we'd actually deliver this
          </h2>
          <p className="text-slate-500">
            FourthWatch builds and deploys custom AI systems for operators —
            no off-the-shelf SaaS, no half-baked GPT wrappers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-slate-200 p-5 hover:border-slate-400 transition-colors"
            >
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{s.title}</h3>
              <p className="text-sm text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <a
            href="/ai-services"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            See all our AI services in detail
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Calendly */}
      <section ref={calendlyRef} className="scroll-mt-20">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm">
          <div className="text-center mb-6 max-w-2xl mx-auto">
            <Badge className="mb-3 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
              <Calendar className="w-3.5 h-3.5 mr-1" /> Book a working session
            </Badge>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              30 minutes. We'll show you exactly how to deploy these.
            </h2>
            <p className="text-slate-500">
              No slide deck. We'll walk through your top 1-2 opportunities and
              sketch the implementation on a whiteboard.
            </p>
          </div>

          <div
            className="calendly-inline-widget"
            data-url={calendlyUrl}
            style={{ minWidth: 320, height: 700 }}
          />
        </div>
      </section>

      {/* CTA fallback */}
      <section className="text-center pb-10">
        <p className="text-sm text-slate-500 mb-3">
          Prefer email first?{" "}
          <a
            href={`mailto:hello@fourthwatchtech.com?subject=AI Audit follow-up — ${encodeURIComponent(
              contact.businessName || "my business"
            )}&body=${encodeURIComponent(
              `Hi FourthWatch team,\n\nI just took the AI audit (${report.industryName}). Top opportunity flagged: "${report.topInsights[0]?.title ?? ""}". I'd like to talk about implementing this.`
            )}`}
            className="text-blue-600 underline"
          >
            Send us a note
          </a>
        </p>
      </section>
    </div>
  );
}

// ─── Sub-components for results ──────────────────────────────────────────────

function ScoreTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "amber" | "rose" | "orange" | "emerald";
}) {
  const toneMap = {
    amber: "from-amber-400 to-orange-500",
    rose: "from-rose-400 to-pink-600",
    orange: "from-orange-400 to-red-500",
    emerald: "from-emerald-400 to-teal-500",
  };
  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-white/70" />
        <span className="text-xs uppercase tracking-wide text-blue-100">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-blue-200">/100</span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${toneMap[tone]} rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  rank,
}: {
  insight: ReturnType<typeof generateAuditReport>["topInsights"][number];
  rank: number;
}) {
  const categoryStyle = {
    time: "bg-amber-100 text-amber-700",
    money: "bg-emerald-100 text-emerald-700",
    fatigue: "bg-rose-100 text-rose-700",
    growth: "bg-violet-100 text-violet-700",
  }[insight.category];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-slate-900 text-lg">{insight.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryStyle}`}>
              {insight.category}
            </span>
          </div>
          <p className="text-slate-700 mb-3">
            <span className="font-semibold text-slate-900">What's happening: </span>
            {insight.problem}
          </p>
          <p className="text-slate-700 mb-4">
            <span className="font-semibold text-slate-900">What we'd build: </span>
            {insight.solution}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm">
                <span className="font-semibold text-slate-900">{insight.estTimeSaved}</span>
                <span className="text-slate-500"> recovered</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-sm">
                <span className="font-semibold text-slate-900">{insight.estCostSaved}</span>
                <span className="text-slate-500"> /mo</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Services library shown on results page ──────────────────────────────────
const SERVICES = [
  {
    title: "AI Voice & Chat Agents",
    desc: "Inbound calls, SMS, and web chat handled by AI agents trained on your business — answering FAQs, booking, qualifying, and routing.",
    icon: Sparkles,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    title: "Workflow Automation",
    desc: "End-to-end automations across your tools (CRM, email, calendar, ops). AI handles the work; humans approve the exceptions.",
    icon: Zap,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    title: "AI Customer Support",
    desc: "Trained AI agents answer 70-85% of repetitive support tickets across email, chat, and SMS — escalating only true edge cases.",
    icon: Briefcase,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    title: "Document & Intake AI",
    desc: "AI-powered intake, document collection, OCR/extraction, and pre-filled CRM/EHR records.",
    icon: Scale,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
  },
  {
    title: "Reporting & Insights AI",
    desc: "Pulls metrics across all your tools, drafts on-brand client/owner reports, and surfaces trends — automatically.",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    title: "Custom AI Builds",
    desc: "When the off-the-shelf tools don't fit, we build a custom solution that does — from RAG systems to LLM-powered ops layers.",
    icon: Shield,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
];
