import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  Shield,
  ArrowRight,
  Calendar,
  CheckCircle2,
  MessageSquare,
  Workflow,
  Phone,
  ClipboardList,
} from "lucide-react";

type Service = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  whatItDoes: string[];
  perfectFor: string[];
  example: { businessType: string; outcome: string };
};

const SERVICES: Service[] = [
  {
    id: "voice_chat",
    name: "AI Voice & Chat Agents",
    tagline: "Inbound calls, SMS, and web chat — handled.",
    description:
      "Custom AI agents trained on your business that answer the phone, qualify leads, book appointments, and route real escalations to humans. Sounds natural, never sleeps, never gets snippy.",
    icon: Phone,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    whatItDoes: [
      "Answers inbound calls 24/7 in your brand voice",
      "Qualifies leads via 4-6 dynamic discovery questions",
      "Books appointments directly into your calendar",
      "Handles FAQs (hours, pricing, prep, location, services)",
      "Routes hot leads or true edge cases to humans instantly",
      "Captures every interaction into your CRM",
    ],
    perfectFor: [
      "Property managers fielding 100+ inquiries/week",
      "Med spas / clinics with overloaded front desks",
      "Service businesses with after-hours leads slipping away",
    ],
    example: {
      businessType: "Boutique med spa, 4 locations",
      outcome:
        "Replaced 1.5 FTE receptionists with an AI voice agent. Cut after-hours missed-call rate from 42% → 3%. ROI in 5 weeks.",
    },
  },
  {
    id: "workflow",
    name: "Workflow Automation",
    tagline: "End-to-end ops automation across your stack.",
    description:
      "We map your operational chokepoints — then build AI-driven workflows across your existing tools (CRM, email, calendar, ops platforms). AI handles the work; humans approve exceptions.",
    icon: Workflow,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    whatItDoes: [
      "Cross-tool orchestration (CRM ↔ email ↔ calendar ↔ ops)",
      "AI-powered decision branches based on your business rules",
      "Human-in-the-loop approvals where you want them",
      "Auto-detection of stuck items, anomalies, and SLA breaches",
      "Drop-in replacements for repetitive Zapier/Make rats' nests",
    ],
    perfectFor: [
      "Agencies juggling 30+ active engagements",
      "Operators glued together by spreadsheets and Slack",
      "Anyone who has ever said: 'we need to fix our process'",
    ],
    example: {
      businessType: "B2B marketing agency, 18 staff",
      outcome:
        "Automated client onboarding (intake → access provisioning → kickoff). Cut time-to-first-value from 9 days → 36 hours.",
    },
  },
  {
    id: "support",
    name: "AI Customer Support",
    tagline: "Resolve 70-85% of tickets without human touch.",
    description:
      "Trained AI support agents (Gorgias, Zendesk, Front, custom) that close repetitive tickets end-to-end — order status, returns, sizing, account questions — and escalate the real 15-30% to your team.",
    icon: MessageSquare,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    whatItDoes: [
      "Auto-resolves the common ticket patterns in your inbox",
      "Triggers refunds, order updates, and account changes",
      "Maintains your brand voice and tone guardrails",
      "Surfaces customer pain trends to product/ops",
      "Plugs into Shopify, Stripe, your DB, your knowledge base",
    ],
    perfectFor: [
      "DTC brands with 200+ tickets/week",
      "SaaS companies drowning in tier-1 support",
      "Marketplaces with seasonal volume spikes",
    ],
    example: {
      businessType: "DTC apparel brand, $20M revenue",
      outcome:
        "AI now closes 78% of incoming CS tickets. Saved $14k/mo in headcount, customer CSAT went up 4 points.",
    },
  },
  {
    id: "intake",
    name: "Document & Intake AI",
    tagline: "Onboarding, KYC, and forms — at machine speed.",
    description:
      "AI-powered client intake: forms, document collection, OCR & validation, and pre-filled CRM/EHR records. The drudgery goes away; the data quality goes up.",
    icon: ClipboardList,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    whatItDoes: [
      "Smart intake forms that adapt based on client answers",
      "AI follow-up to chase missing documents",
      "OCR + validation against business rules",
      "Direct write to your CRM, EHR, or core systems",
      "Compliance-ready audit trail of every step",
    ],
    perfectFor: [
      "Law firms, CPA firms, financial advisors",
      "Healthcare practices doing manual intake",
      "Insurance agencies handling onboarding paperwork",
    ],
    example: {
      businessType: "Mid-size CPA firm, 24 staff",
      outcome:
        "Cut new-client intake from 4 hours of admin → 12 minutes of partner review. Freed up 35 hrs/week of paralegal time.",
    },
  },
  {
    id: "reporting",
    name: "Reporting & Insights AI",
    tagline: "Ship the report. Don't write the report.",
    description:
      "AI pulls metrics across all your tools, drafts on-brand client/owner reports with insights and recommended next steps, and ships them on schedule. Your team reviews, doesn't author.",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    whatItDoes: [
      "Pulls data from analytics, ad platforms, CRM, finance",
      "Drafts narrative-style reports in your team's voice",
      "Highlights anomalies, trends, and opportunities",
      "Sends on schedule (weekly, monthly, on demand)",
      "White-labeled or internal — your choice",
    ],
    perfectFor: [
      "Agencies producing weekly client reports",
      "Multi-location operators needing rollups",
      "Leadership teams flying blind between board meetings",
    ],
    example: {
      businessType: "Performance marketing agency, 60 clients",
      outcome:
        "Replaced 22 hrs/week of manual reporting with AI. Account managers got 1 day/week back for actual strategy.",
    },
  },
  {
    id: "custom",
    name: "Custom AI Builds",
    tagline: "When the off-the-shelf tools don't fit.",
    description:
      "Custom-built AI systems for hard problems — RAG over your private data, LLM-powered ops layers, specialized agents that ship work humans can't keep up with. Built and owned by you.",
    icon: Shield,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    whatItDoes: [
      "RAG systems over your docs, contracts, knowledge base",
      "Custom AI agents for industry-specific workflows",
      "Internal copilots that know your business",
      "Embeddable AI for your own product or SaaS",
      "On-prem / private cloud / VPC deployment when required",
    ],
    perfectFor: [
      "Operators with proprietary data nobody else can use",
      "Teams that have outgrown SaaS AI tools",
      "Builders who want to own their AI stack, not rent it",
    ],
    example: {
      businessType: "Specialty insurance broker, 200+ staff",
      outcome:
        "Built a private RAG copilot over 12 years of policy docs. Brokers now answer coverage questions in 8 sec vs 25 min.",
    },
  },
];

export default function AiServices() {
  const calendlyUrl =
    "https://calendly.com/radianceokuzor/30min?hide_gdpr_banner=1";

  useEffect(() => {
    const id = "calendly-widget-script";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      {/* Header */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <div className="font-bold text-slate-900 text-base">FourthWatch</div>
              <div className="text-xs text-slate-500">AI Services</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ai-audit">
              <Button variant="ghost" size="sm">
                Take the AI audit
              </Button>
            </Link>
            <Button
              size="sm"
              className="bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" })}
            >
              Book a call
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto mb-20">
          <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> AI for ambitious operators
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold text-slate-900 tracking-tight mb-6 leading-[1.1]">
            We build the AI systems your team{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              wishes they had
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 mb-8">
            FourthWatch designs and ships custom AI deployments for service
            businesses, operators, and owners who are tired of being the
            bottleneck — or watching their team be one.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/ai-audit">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-600/20"
              >
                Take the free AI audit
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Calendar className="w-4 h-4 mr-1.5" /> Book a 30-min call
            </Button>
          </div>
          <div className="mt-6 text-sm text-slate-500">
            Trusted by operators across real estate, healthcare, legal, agencies, e-commerce, and finance.
          </div>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
          {[
            { value: "70-85%", label: "Repetitive tasks AI can absorb" },
            { value: "20-50 hrs", label: "Avg team time saved /month" },
            { value: "30 days", label: "Typical first deployment" },
            { value: "5 weeks", label: "Median ROI period" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-slate-200 p-5 text-center"
            >
              <div className="text-2xl sm:text-3xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs sm:text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </section>

        {/* Services */}
        <section className="mb-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
              What we build
            </h2>
            <p className="text-slate-500 text-lg">
              Six core service categories. Every engagement starts with mapping
              your top 1-2 leverage points and shipping fast.
            </p>
          </div>

          <div className="space-y-6">
            {SERVICES.map((s, i) => (
              <ServiceCard key={s.id} service={s} reversed={i % 2 === 1} />
            ))}
          </div>
        </section>

        {/* How we work */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 mb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge className="mb-3 bg-violet-100 text-violet-700 hover:bg-violet-100 border-0">
              How it works
            </Badge>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              From discovery to deployed in weeks, not quarters
            </h2>
            <p className="text-slate-500">
              No 6-month consulting decks. We build, ship, measure.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Audit & opportunity map",
                desc: "We run a deep discovery on your operation, surface every place AI can move the needle, and rank by impact and feasibility.",
              },
              {
                step: "02",
                title: "Build & integrate",
                desc: "We build the chosen AI systems and integrate with your existing tools (CRM, support, EHR, ops). You see weekly demos.",
              },
              {
                step: "03",
                title: "Deploy & iterate",
                desc: "Live deployment with monitoring, guardrails, and human-in-the-loop where it matters. We measure ROI from day one.",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-slate-200 p-6">
                <div className="text-blue-600 font-bold text-sm mb-2">{s.step}</div>
                <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Calendly */}
        <section id="book" className="scroll-mt-20 mb-12">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm">
            <div className="text-center mb-6 max-w-2xl mx-auto">
              <Badge className="mb-3 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
                <Calendar className="w-3.5 h-3.5 mr-1" /> Book a working session
              </Badge>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                30 minutes. We'll map your top AI leverage points live.
              </h2>
              <p className="text-slate-500">
                No slides. No upsell. Just a real working conversation about
                where AI fits in your business.
              </p>
            </div>
            <div
              className="calendly-inline-widget"
              data-url={calendlyUrl}
              style={{ minWidth: 320, height: 700 }}
            />
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center pb-8">
          <p className="text-sm text-slate-500 mb-3">
            Not ready for a call yet?{" "}
            <Link href="/ai-audit" className="text-blue-600 underline">
              Take the free AI audit
            </Link>{" "}
            and get a personalized opportunity report in under 3 minutes.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <div>© {new Date().getFullYear()} FourthWatch.</div>
          <div className="flex gap-4">
            <Link href="/ai-audit" className="hover:text-slate-900">AI Audit</Link>
            <a href="/gmb/" className="hover:text-slate-900">GBP Recovery</a>
            <a href="/merchant/" className="hover:text-slate-900">Merchant Center</a>
            <a href="/amazon/" className="hover:text-slate-900">Amazon Recovery</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ServiceCard({ service, reversed }: { service: Service; reversed: boolean }) {
  const Icon = service.icon;
  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className={`grid grid-cols-1 lg:grid-cols-5 gap-0 ${reversed ? "lg:[direction:rtl]" : ""}`}>
        <div className={`lg:col-span-2 p-8 ${service.bg} flex flex-col justify-center [direction:ltr]`}>
          <div className={`w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm mb-5`}>
            <Icon className={`w-7 h-7 ${service.color}`} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">{service.name}</h3>
          <p className={`text-sm font-semibold ${service.color} mb-4`}>{service.tagline}</p>
          <p className="text-slate-700 text-sm leading-relaxed">{service.description}</p>
        </div>
        <div className="lg:col-span-3 p-8 [direction:ltr]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                What it does
              </h4>
              <ul className="space-y-2">
                {service.whatItDoes.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className={`w-4 h-4 ${service.color} shrink-0 mt-0.5`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Perfect for
              </h4>
              <ul className="space-y-2">
                {service.perfectFor.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <ArrowRight className={`w-4 h-4 ${service.color} shrink-0 mt-0.5`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Real example
            </div>
            <div className="text-sm font-semibold text-slate-900 mb-1">
              {service.example.businessType}
            </div>
            <div className="text-sm text-slate-700">{service.example.outcome}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
