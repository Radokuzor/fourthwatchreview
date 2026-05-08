/**
 * AI Audit Survey — industry definitions + discovery questions.
 *
 * Each industry has a tailored set of questions designed to surface
 * areas where AI can save time, reduce cost, and lower employee fatigue.
 * The answers feed an LLM prompt that produces a personalized report.
 */

export type QuestionType = "select" | "scale" | "number" | "text" | "multiselect";

export type Question = {
  id: string;
  prompt: string;
  helper?: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

export type Industry = {
  id: string;
  name: string;
  tagline: string;
  iconKey:
    | "home"
    | "stethoscope"
    | "scale"
    | "briefcase"
    | "shoppingBag"
    | "shield";
  accent: string; // tailwind text color
  bg: string; // tailwind bg
  border: string;
  questions: Question[];
};

const SCALE_OPTIONS = ["Almost never", "Rarely", "Sometimes", "Often", "All the time"];
const VOLUME_OPTIONS = ["Under 25", "25–100", "100–500", "500–2,000", "2,000+"];
const HOURS_OPTIONS = ["< 5 hrs", "5–15 hrs", "15–30 hrs", "30–60 hrs", "60+ hrs"];
const TEAM_OPTIONS = ["Just me", "2–5", "6–15", "16–50", "50+"];

export const INDUSTRIES: Industry[] = [
  {
    id: "real_estate",
    name: "Real Estate & Property Management",
    tagline: "Brokerages, property managers, and leasing teams",
    iconKey: "home",
    accent: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    questions: [
      {
        id: "lead_volume",
        prompt: "How many tenant or buyer inquiries does your team receive per week?",
        type: "select",
        options: VOLUME_OPTIONS,
        required: true,
      },
      {
        id: "response_time",
        prompt: "What % of those inquiries get a response within 1 hour?",
        type: "select",
        options: ["Under 20%", "20–40%", "40–70%", "70–90%", "90%+"],
        required: true,
      },
      {
        id: "showing_hours",
        prompt: "How many hours per week does your team spend scheduling viewings, screening tenants, or chasing paperwork?",
        type: "select",
        options: HOURS_OPTIONS,
        required: true,
      },
      {
        id: "maintenance_repeat",
        prompt: "How often are maintenance requests repetitive issues (lockouts, how-tos, simple fixes)?",
        type: "select",
        options: SCALE_OPTIONS,
        required: true,
      },
      {
        id: "follow_up",
        prompt: "How do you currently follow up with leads who didn't convert?",
        type: "select",
        options: ["Manually, when we remember", "Manually, on a schedule", "Email automation only", "Multi-channel automation", "We don't follow up"],
        required: true,
      },
      {
        id: "portfolio_size",
        prompt: "How many properties / units do you manage today?",
        type: "select",
        options: ["1–10", "11–50", "51–200", "201–1,000", "1,000+"],
        required: true,
      },
      {
        id: "team_size",
        prompt: "How big is the team handling resident or client communication?",
        type: "select",
        options: TEAM_OPTIONS,
        required: true,
      },
      {
        id: "biggest_drain",
        prompt: "In your own words — what's the single biggest task draining your team's time?",
        type: "text",
        placeholder: "e.g. Scheduling 30+ showings per week between 4 agents",
      },
    ],
  },

  {
    id: "healthcare",
    name: "Healthcare & Med Spas",
    tagline: "Clinics, dental offices, derm/aesthetics, wellness practices",
    iconKey: "stethoscope",
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    questions: [
      {
        id: "appt_volume",
        prompt: "How many patient appointments per week across your practice?",
        type: "select",
        options: VOLUME_OPTIONS,
        required: true,
      },
      {
        id: "no_show_rate",
        prompt: "Roughly what's your no-show / late-cancel rate?",
        type: "select",
        options: ["Under 5%", "5–10%", "10–20%", "20–30%", "30%+"],
        required: true,
      },
      {
        id: "front_desk_calls",
        prompt: "How many hours per week does your front desk spend on confirmations, reminders, and recall calls?",
        type: "select",
        options: HOURS_OPTIONS,
        required: true,
      },
      {
        id: "intake_time",
        prompt: "How long does new patient intake take from booking to first visit (forms, history, insurance)?",
        type: "select",
        options: ["Under 15 min", "15–30 min", "30–60 min", "1–2 hrs", "2+ hrs"],
        required: true,
      },
      {
        id: "repeat_questions",
        prompt: "What % of inbound patient questions are repetitive (hours, pricing, prep instructions)?",
        type: "select",
        options: ["Under 20%", "20–40%", "40–70%", "70–90%", "90%+"],
        required: true,
      },
      {
        id: "follow_up_care",
        prompt: "How do you currently handle post-visit follow-up & care instructions?",
        type: "select",
        options: ["Phone calls only", "Manual emails", "Templated emails", "Automated sequences", "We don't"],
        required: true,
      },
      {
        id: "team_size",
        prompt: "How many staff handle patient communication (front desk + medical assistants)?",
        type: "select",
        options: TEAM_OPTIONS,
        required: true,
      },
      {
        id: "burnout",
        prompt: "Where does staff burnout show up most? (in your words)",
        type: "text",
        placeholder: "e.g. Front desk overwhelmed by recall calls + new patient onboarding",
      },
    ],
  },

  {
    id: "accounting_law",
    name: "Accounting & Law",
    tagline: "CPA firms, bookkeepers, attorneys, tax practices",
    iconKey: "scale",
    accent: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    questions: [
      {
        id: "client_count",
        prompt: "How many active clients / matters do you serve?",
        type: "select",
        options: ["Under 25", "25–100", "100–300", "300–1,000", "1,000+"],
        required: true,
      },
      {
        id: "intake_hours",
        prompt: "How many billable hours per month does your team spend on document intake & client onboarding?",
        type: "select",
        options: HOURS_OPTIONS,
        required: true,
      },
      {
        id: "status_email_pct",
        prompt: "What % of inbound client emails are status checks vs. substantive questions?",
        type: "select",
        options: ["Under 20% are status", "20–40%", "40–60%", "60–80%", "80%+ are status"],
        required: true,
      },
      {
        id: "proposal_process",
        prompt: "How do you currently generate proposals or engagement letters?",
        type: "select",
        options: ["From scratch each time", "Word/PDF templates", "Document automation tool", "Mix of templates + custom", "We don't formalize"],
        required: true,
      },
      {
        id: "deadline_tracking",
        prompt: "How do you currently handle compliance reminders & deadline tracking?",
        type: "select",
        options: ["Spreadsheets / calendar only", "Practice management software", "Mix of tools", "Manual + reminders", "Nothing systematic"],
        required: true,
      },
      {
        id: "research_time",
        prompt: "How many hours per week does your team spend on research & summarizing documents?",
        type: "select",
        options: HOURS_OPTIONS,
        required: true,
      },
      {
        id: "team_size",
        prompt: "How big is your team?",
        type: "select",
        options: TEAM_OPTIONS,
        required: true,
      },
      {
        id: "fatigue_source",
        prompt: "Where does staff fatigue show up most — research, drafting, admin, or client comms?",
        type: "text",
        placeholder: "e.g. Senior associates spend evenings drafting routine motions",
      },
    ],
  },

  {
    id: "professional_services",
    name: "Professional Services & Agencies",
    tagline: "Marketing, consulting, design, dev shops, B2B agencies",
    iconKey: "briefcase",
    accent: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    questions: [
      {
        id: "client_count",
        prompt: "How many active client engagements do you currently run?",
        type: "select",
        options: ["1–5", "6–15", "16–40", "41–100", "100+"],
        required: true,
      },
      {
        id: "reporting_hours",
        prompt: "How many hours per week does your team spend on client reporting & weekly updates?",
        type: "select",
        options: HOURS_OPTIONS,
        required: true,
      },
      {
        id: "proposal_volume",
        prompt: "How many proposals or scopes of work do you produce in a typical month?",
        type: "select",
        options: ["Under 5", "5–15", "15–40", "40–100", "100+"],
        required: true,
      },
      {
        id: "repeat_comms",
        prompt: "What % of project communication is repetitive (status, scope clarifications, FAQs)?",
        type: "select",
        options: ["Under 20%", "20–40%", "40–60%", "60–80%", "80%+"],
        required: true,
      },
      {
        id: "tool_count",
        prompt: "How many tools does a typical team member switch between in a day?",
        type: "select",
        options: ["1–3", "4–6", "7–10", "11–15", "16+"],
        required: true,
      },
      {
        id: "onboarding_time",
        prompt: "How long does it take to onboard a new client end-to-end?",
        type: "select",
        options: ["Under 1 day", "1–3 days", "1 week", "2–4 weeks", "1 month+"],
        required: true,
      },
      {
        id: "team_size",
        prompt: "Team size?",
        type: "select",
        options: TEAM_OPTIONS,
        required: true,
      },
      {
        id: "bottleneck",
        prompt: "Where do projects most often fall behind — discovery, execution, QA, or delivery?",
        type: "text",
        placeholder: "e.g. QA reviews bottleneck on one senior — projects stall 3–5 days",
      },
    ],
  },

  {
    id: "ecommerce",
    name: "E-commerce & DTC Brands",
    tagline: "Shopify, Amazon sellers, multi-channel brands",
    iconKey: "shoppingBag",
    accent: "text-pink-600",
    bg: "bg-pink-50",
    border: "border-pink-200",
    questions: [
      {
        id: "ticket_volume",
        prompt: "How many customer service tickets per week across all channels?",
        type: "select",
        options: VOLUME_OPTIONS,
        required: true,
      },
      {
        id: "repeat_tickets",
        prompt: "What % of those tickets are repetitive (shipping, returns, sizing, order status)?",
        type: "select",
        options: ["Under 20%", "20–40%", "40–60%", "60–80%", "80%+"],
        required: true,
      },
      {
        id: "abandoned_cart",
        prompt: "How do you currently handle abandoned cart recovery?",
        type: "select",
        options: ["Nothing", "Single email", "Email sequence", "Email + SMS sequence", "Email + SMS + paid retargeting"],
        required: true,
      },
      {
        id: "content_process",
        prompt: "How do you currently produce product descriptions & SEO content?",
        type: "select",
        options: ["Founder writes everything", "In-house team", "Freelancers", "Mix of templates", "AI assisted"],
        required: true,
      },
      {
        id: "launch_speed",
        prompt: "From sourcing to live, how long does a new product launch take?",
        type: "select",
        options: ["Under 1 week", "1–2 weeks", "2–4 weeks", "1–3 months", "3+ months"],
        required: true,
      },
      {
        id: "review_process",
        prompt: "How do you currently track and respond to reviews across platforms?",
        type: "select",
        options: ["We don't", "Manually, when we notice", "Periodic check", "Single dashboard", "Automated alerts + responses"],
        required: true,
      },
      {
        id: "team_size",
        prompt: "How big is your operations team?",
        type: "select",
        options: TEAM_OPTIONS,
        required: true,
      },
      {
        id: "bottleneck",
        prompt: "What's the biggest unscalable bottleneck in your operation right now?",
        type: "text",
        placeholder: "e.g. CS volume doubles in Q4 and we can't hire fast enough",
      },
    ],
  },

  {
    id: "finance_insurance",
    name: "Financial Services & Insurance",
    tagline: "Advisors, agencies, brokers, planners",
    iconKey: "shield",
    accent: "text-cyan-600",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    questions: [
      {
        id: "client_count",
        prompt: "How many clients / policyholders do you currently serve?",
        type: "select",
        options: ["Under 100", "100–500", "500–2,000", "2,000–10,000", "10,000+"],
        required: true,
      },
      {
        id: "onboarding_time",
        prompt: "How long does new client / policyholder onboarding take?",
        type: "select",
        options: ["Under 1 day", "1–3 days", "1 week", "2–4 weeks", "1 month+"],
        required: true,
      },
      {
        id: "inbound_pct",
        prompt: "What % of weekly inbound questions are about policy details, claims status, or coverage?",
        type: "select",
        options: ["Under 20%", "20–40%", "40–60%", "60–80%", "80%+"],
        required: true,
      },
      {
        id: "data_entry",
        prompt: "What % of your team's time is spent on data entry vs. advisory work?",
        type: "select",
        options: ["Under 20% data entry", "20–40%", "40–60%", "60–80%", "80%+ data entry"],
        required: true,
      },
      {
        id: "compliance_tracking",
        prompt: "How do you currently track compliance & disclosure documentation?",
        type: "select",
        options: ["Spreadsheets", "CRM only", "Compliance platform", "Mix of systems", "Manual + paper"],
        required: true,
      },
      {
        id: "renewals",
        prompt: "How do you handle renewal reminders & cross-sell opportunities?",
        type: "select",
        options: ["Manually, ad hoc", "Calendar reminders", "CRM workflows", "Multi-channel automation", "We don't"],
        required: true,
      },
      {
        id: "team_size",
        prompt: "Team size?",
        type: "select",
        options: TEAM_OPTIONS,
        required: true,
      },
      {
        id: "burnout",
        prompt: "Where does most of the staff burnout originate — paperwork, calls, or compliance?",
        type: "text",
        placeholder: "e.g. Junior advisors spend 60% of week on KYC paperwork",
      },
    ],
  },
];

export function getIndustry(id: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.id === id);
}

// ─── Scoring algorithm ────────────────────────────────────────────────────────
// Each industry maps option indices to weights. The algorithm produces a
// time-saved estimate, money saved, burnout reduction, and a ranked list of
// AI opportunities — all deterministic, no LLM required.

export type AiOpportunity = {
  title: string;
  category: "Customer Comms" | "Operations" | "Sales & Marketing" | "Compliance & Docs" | "Reviews & Reputation" | "Onboarding";
  impact: "High" | "Medium" | "Low";
  description: string;
  estHoursSavedPerWeek: number;
  implementationTime: string;
};

export type AuditResult = {
  hoursPerWeekSaved: number;
  monthlyDollarsSaved: number;
  burnoutReductionPct: number;
  efficiencyScore: number; // 0–100 current state
  potentialScore: number; // 0–100 with AI
  executiveSummary: string;
  topPainPoints: string[];
  opportunities: AiOpportunity[];
  estimatedRoi: string;
};

// Average loaded labor cost per industry (fully loaded $/hour)
const HOURLY_RATE: Record<string, number> = {
  real_estate: 35,
  healthcare: 45,
  accounting_law: 85,
  professional_services: 55,
  ecommerce: 30,
  finance_insurance: 70,
};

// Helper: convert "5–15 hrs" / "20–40%" / "100–500" / scale strings to a midpoint number.
function midpointFromOption(option: string | undefined): number {
  if (!option) return 0;
  const cleaned = option.replace(/,/g, "").replace(/[<>]/g, "").trim();

  // "Under X" / "X+" patterns
  const under = cleaned.match(/^under\s+(\d+(?:\.\d+)?)/i);
  if (under) return parseFloat(under[1]) / 2;
  const plus = cleaned.match(/^(\d+(?:\.\d+)?)\+/);
  if (plus) return parseFloat(plus[1]) * 1.4;

  // Range "A–B" or "A-B"
  const range = cleaned.match(/(\d+(?:\.\d+)?)[\s\-–]+(\d+(?:\.\d+)?)/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;

  // Single number anywhere
  const single = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (single) return parseFloat(single[1]);

  return 0;
}

// Scale options ("Almost never" … "All the time") → 0–1
function scaleToFraction(option: string | undefined): number {
  if (!option) return 0;
  const idx = SCALE_OPTIONS.indexOf(option);
  if (idx === -1) return 0;
  return [0.05, 0.2, 0.45, 0.7, 0.9][idx];
}

type ScoreInput = {
  industryId: string;
  answers: Record<string, string>;
};

// Build the AI opportunities list per industry based on answers.
function getOpportunitiesForIndustry(input: ScoreInput): AiOpportunity[] {
  const a = input.answers;
  const ops: AiOpportunity[] = [];

  switch (input.industryId) {
    case "real_estate": {
      const leadVol = midpointFromOption(a.lead_volume);
      const respPct = midpointFromOption(a.response_time) / 100;
      const showHrs = midpointFromOption(a.showing_hours);
      const maintRepeat = scaleToFraction(a.maintenance_repeat);

      if (respPct < 0.7 && leadVol >= 25) {
        ops.push({
          title: "AI Lead Qualifier & Instant Responder",
          category: "Sales & Marketing",
          impact: "High",
          description:
            "AI replies to every inbound inquiry within seconds, qualifies the lead with 4–6 questions, and routes hot leads to your team. Cold leads enter automated nurture.",
          estHoursSavedPerWeek: Math.min(20, Math.round(leadVol * 0.05 + 4)),
          implementationTime: "1–2 weeks",
        });
      }
      if (showHrs >= 5) {
        ops.push({
          title: "AI Scheduling Agent",
          category: "Operations",
          impact: showHrs >= 15 ? "High" : "Medium",
          description:
            "Books viewings via SMS/email/web in real time against your team's calendars. Handles reschedules and confirmations automatically.",
          estHoursSavedPerWeek: Math.round(showHrs * 0.6),
          implementationTime: "2–3 weeks",
        });
      }
      if (maintRepeat >= 0.4) {
        ops.push({
          title: "Tenant Concierge AI",
          category: "Customer Comms",
          impact: "Medium",
          description:
            "First-line tenant support handling lockouts, how-to questions, and triaging real maintenance issues to your dispatch system.",
          estHoursSavedPerWeek: Math.round(maintRepeat * 14),
          implementationTime: "2–4 weeks",
        });
      }
      if (a.follow_up && /Manually|don't/.test(a.follow_up)) {
        ops.push({
          title: "AI Lead Nurture Sequences",
          category: "Sales & Marketing",
          impact: "High",
          description:
            "Multi-touch follow-up across email + SMS that re-engages cold leads with property-relevant content. Recovers 8–15% of dead leads.",
          estHoursSavedPerWeek: 6,
          implementationTime: "1–2 weeks",
        });
      }
      ops.push({
        title: "Review Response Automation",
        category: "Reviews & Reputation",
        impact: "Medium",
        description:
          "AI drafts on-brand responses to every Google review with your approval — protect ratings and rank higher in local search.",
        estHoursSavedPerWeek: 3,
        implementationTime: "< 1 week",
      });
      break;
    }

    case "healthcare": {
      const apptVol = midpointFromOption(a.appt_volume);
      const noShow = midpointFromOption(a.no_show_rate) / 100;
      const frontDeskHrs = midpointFromOption(a.front_desk_calls);
      const intake = midpointFromOption(a.intake_time);
      const repeatPct = midpointFromOption(a.repeat_questions) / 100;

      if (noShow >= 0.1 || frontDeskHrs >= 5) {
        ops.push({
          title: "AI Appointment Reminder & Recall Agent",
          category: "Operations",
          impact: "High",
          description:
            "Multi-touch reminders via SMS/voice/email that recover no-shows, run waitlists, and rebook cancellations automatically. Practices typically cut no-show rates by 35–60%.",
          estHoursSavedPerWeek: Math.round(frontDeskHrs * 0.65 + 4),
          implementationTime: "1–2 weeks",
        });
      }
      if (repeatPct >= 0.4) {
        ops.push({
          title: "Patient Front-Door AI",
          category: "Customer Comms",
          impact: "High",
          description:
            "24/7 AI receptionist that answers FAQs (hours, pricing, prep), books appointments, and escalates clinical questions to staff. HIPAA-safe deployment.",
          estHoursSavedPerWeek: Math.round(repeatPct * 18),
          implementationTime: "2–4 weeks",
        });
      }
      if (intake >= 30) {
        ops.push({
          title: "AI-Driven Intake & Pre-Visit Workflow",
          category: "Onboarding",
          impact: "Medium",
          description:
            "Patients complete intake on their phone before arriving. AI summarizes history into a clean pre-visit brief for the provider.",
          estHoursSavedPerWeek: Math.round((apptVol / 7) * (intake / 60) * 0.5),
          implementationTime: "3–4 weeks",
        });
      }
      if (!a.follow_up_care || /We don't|Phone calls/.test(a.follow_up_care)) {
        ops.push({
          title: "Automated Post-Visit Follow-Up",
          category: "Customer Comms",
          impact: "Medium",
          description:
            "Personalized aftercare instructions, satisfaction check-in, and review request — sequenced across SMS + email.",
          estHoursSavedPerWeek: 5,
          implementationTime: "1 week",
        });
      }
      ops.push({
        title: "Review Reputation Engine",
        category: "Reviews & Reputation",
        impact: "Medium",
        description:
          "Auto-request reviews from happy patients, draft responses to negative reviews with your approval, monitor across Google + Yelp + Healthgrades.",
        estHoursSavedPerWeek: 3,
        implementationTime: "< 1 week",
      });
      break;
    }

    case "accounting_law": {
      const intakeHrs = midpointFromOption(a.intake_hours);
      const statusPct = midpointFromOption(a.status_email_pct) / 100;
      const researchHrs = midpointFromOption(a.research_time);

      if (intakeHrs >= 5) {
        ops.push({
          title: "AI Document Intake & Classification",
          category: "Compliance & Docs",
          impact: "High",
          description:
            "Clients upload docs through a secure portal — AI extracts data, flags missing items, and pushes structured records into your practice software.",
          estHoursSavedPerWeek: Math.round(intakeHrs * 0.55),
          implementationTime: "3–4 weeks",
        });
      }
      if (statusPct >= 0.4) {
        ops.push({
          title: "Client Status Concierge AI",
          category: "Customer Comms",
          impact: "High",
          description:
            "Clients get instant, accurate status updates via web/SMS pulled from your case or return management system. Frees attorneys/CPAs from interruption.",
          estHoursSavedPerWeek: Math.round(statusPct * 16),
          implementationTime: "2–3 weeks",
        });
      }
      if (researchHrs >= 5) {
        ops.push({
          title: "AI Research & Drafting Assistant",
          category: "Operations",
          impact: "High",
          description:
            "Drafts memos, summarizes case law, generates first-pass returns or filings — reviewed and finalized by your team. Cuts drafting time 40–60%.",
          estHoursSavedPerWeek: Math.round(researchHrs * 0.45),
          implementationTime: "2–4 weeks",
        });
      }
      if (a.proposal_process && /scratch|don't formalize/.test(a.proposal_process)) {
        ops.push({
          title: "Engagement Letter Auto-Generation",
          category: "Sales & Marketing",
          impact: "Medium",
          description:
            "AI generates engagement letters and proposals from a short intake conversation — branded, compliant, e-sign ready.",
          estHoursSavedPerWeek: 4,
          implementationTime: "2 weeks",
        });
      }
      if (a.deadline_tracking && /Spreadsheets|Nothing/.test(a.deadline_tracking)) {
        ops.push({
          title: "Compliance & Deadline Watchdog",
          category: "Compliance & Docs",
          impact: "High",
          description:
            "AI agent watches your matter list and proactively reminds clients (and your team) of upcoming deadlines and required documents.",
          estHoursSavedPerWeek: 3,
          implementationTime: "1–2 weeks",
        });
      }
      break;
    }

    case "professional_services": {
      const reportingHrs = midpointFromOption(a.reporting_hours);
      const proposalVol = midpointFromOption(a.proposal_volume);
      const repeatComms = midpointFromOption(a.repeat_comms) / 100;
      const tools = midpointFromOption(a.tool_count);

      if (reportingHrs >= 5) {
        ops.push({
          title: "Automated Client Reporting",
          category: "Operations",
          impact: "High",
          description:
            "Pulls metrics across the tools you already use (analytics, ads, CRM) and generates branded weekly reports with AI commentary.",
          estHoursSavedPerWeek: Math.round(reportingHrs * 0.7),
          implementationTime: "2–3 weeks",
        });
      }
      if (proposalVol >= 5) {
        ops.push({
          title: "Proposal & SOW Generator",
          category: "Sales & Marketing",
          impact: "High",
          description:
            "AI drafts SOWs from a discovery transcript or short brief — reusing your wins, pricing logic, and case studies.",
          estHoursSavedPerWeek: Math.round(proposalVol * 0.4),
          implementationTime: "2 weeks",
        });
      }
      if (repeatComms >= 0.4) {
        ops.push({
          title: "Client Comms AI Assistant",
          category: "Customer Comms",
          impact: "Medium",
          description:
            "Drafts replies to common client emails, status updates, and scope clarifications using your project context. Your team approves and sends.",
          estHoursSavedPerWeek: Math.round(repeatComms * 12),
          implementationTime: "2–3 weeks",
        });
      }
      if (tools >= 7) {
        ops.push({
          title: "Workflow Automation Layer",
          category: "Operations",
          impact: "Medium",
          description:
            "Connects your tools so updates flow automatically — no more copy-pasting between Slack, Notion, ClickUp, HubSpot. AI handles routing and summarization.",
          estHoursSavedPerWeek: Math.round((tools - 4) * 1.2),
          implementationTime: "3–5 weeks",
        });
      }
      ops.push({
        title: "Lead Nurture & Reactivation AI",
        category: "Sales & Marketing",
        impact: "Medium",
        description:
          "Re-engages cold leads and past clients with relevant case studies + insights based on their industry. Books meetings into your calendar.",
        estHoursSavedPerWeek: 4,
        implementationTime: "2 weeks",
      });
      break;
    }

    case "ecommerce": {
      const ticketVol = midpointFromOption(a.ticket_volume);
      const repeatTickets = midpointFromOption(a.repeat_tickets) / 100;

      if (ticketVol >= 25 && repeatTickets >= 0.4) {
        ops.push({
          title: "AI Customer Support Concierge",
          category: "Customer Comms",
          impact: "High",
          description:
            "Resolves shipping, returns, sizing, and order-status tickets end-to-end (with order lookup + return label generation). Escalates only edge cases.",
          estHoursSavedPerWeek: Math.round((ticketVol * repeatTickets) * 0.06 + 6),
          implementationTime: "2–3 weeks",
        });
      }
      if (a.abandoned_cart && /Nothing|Single email/.test(a.abandoned_cart)) {
        ops.push({
          title: "AI Cart Recovery Sequences",
          category: "Sales & Marketing",
          impact: "High",
          description:
            "Personalized email + SMS recovery flows with dynamic offers, social proof, and bundle suggestions. Typical lift: 8–18% additional revenue.",
          estHoursSavedPerWeek: 2,
          implementationTime: "1 week",
        });
      }
      if (a.content_process && /Founder|In-house|Freelancers/.test(a.content_process)) {
        ops.push({
          title: "AI Product Content Engine",
          category: "Operations",
          impact: "Medium",
          description:
            "Generates SEO-optimized product descriptions, A+ content, ad copy, and category pages — at brand voice, in minutes.",
          estHoursSavedPerWeek: 6,
          implementationTime: "1–2 weeks",
        });
      }
      if (a.review_process && /We don't|Manually|Periodic/.test(a.review_process)) {
        ops.push({
          title: "Cross-Channel Review Automation",
          category: "Reviews & Reputation",
          impact: "High",
          description:
            "Monitors Amazon, Shopify, Google, Trustpilot — drafts on-brand responses, requests reviews from happy customers, alerts on threats.",
          estHoursSavedPerWeek: 5,
          implementationTime: "< 1 week",
        });
      }
      ops.push({
        title: "Returns & Sizing Co-Pilot",
        category: "Customer Comms",
        impact: "Medium",
        description:
          "Pre-purchase fit/sizing assistant that reduces returns by 15–25% and lifts conversion by giving shoppers confidence at checkout.",
        estHoursSavedPerWeek: 3,
        implementationTime: "3–4 weeks",
      });
      break;
    }

    case "finance_insurance": {
      const onboardOption = a.onboarding_time ?? "";
      const inboundPct = midpointFromOption(a.inbound_pct) / 100;
      const dataEntryPct = midpointFromOption(a.data_entry) / 100;

      if (/week|month/i.test(onboardOption)) {
        ops.push({
          title: "Digital Onboarding & KYC Automation",
          category: "Onboarding",
          impact: "High",
          description:
            "AI walks new clients through onboarding, captures KYC docs, validates IDs, and pre-fills CRM. Cuts time-to-active by 50–70%.",
          estHoursSavedPerWeek: 8,
          implementationTime: "3–5 weeks",
        });
      }
      if (inboundPct >= 0.4) {
        ops.push({
          title: "Policy & Claims Status AI",
          category: "Customer Comms",
          impact: "High",
          description:
            "Self-serve AI that answers policy, coverage, and claims-status questions accurately — pulling from your PMS/AMS in real time.",
          estHoursSavedPerWeek: Math.round(inboundPct * 16),
          implementationTime: "2–4 weeks",
        });
      }
      if (dataEntryPct >= 0.4) {
        ops.push({
          title: "AI Data Entry Eliminator",
          category: "Operations",
          impact: "High",
          description:
            "Extracts structured data from emails, PDFs, and applications into your CRM — frees advisors to spend their time on advisory work.",
          estHoursSavedPerWeek: Math.round(dataEntryPct * 22),
          implementationTime: "3–4 weeks",
        });
      }
      if (a.compliance_tracking && /Spreadsheets|Manual/.test(a.compliance_tracking)) {
        ops.push({
          title: "Compliance & Disclosure Watchdog",
          category: "Compliance & Docs",
          impact: "High",
          description:
            "AI tracks disclosure requirements, renewals, and audit prep — proactively flags gaps before they become violations.",
          estHoursSavedPerWeek: 5,
          implementationTime: "2–3 weeks",
        });
      }
      if (a.renewals && /Manually|don't/.test(a.renewals)) {
        ops.push({
          title: "Renewal & Cross-Sell AI",
          category: "Sales & Marketing",
          impact: "Medium",
          description:
            "Identifies renewal & cross-sell opportunities from your book, generates personalized outreach, and schedules review calls.",
          estHoursSavedPerWeek: 4,
          implementationTime: "2–3 weeks",
        });
      }
      break;
    }
  }

  // Sort by impact then estimated hours saved
  const impactRank = { High: 3, Medium: 2, Low: 1 };
  ops.sort((a, b) => impactRank[b.impact] - impactRank[a.impact] || b.estHoursSavedPerWeek - a.estHoursSavedPerWeek);
  return ops.slice(0, 6);
}

function getTopPainPoints(input: ScoreInput): string[] {
  const a = input.answers;
  const points: string[] = [];

  // Industry-specific signals
  switch (input.industryId) {
    case "real_estate":
      if (midpointFromOption(a.response_time) < 40)
        points.push("Slow lead response — most prospects choose whoever replies first within an hour");
      if (midpointFromOption(a.showing_hours) >= 15)
        points.push("Heavy manual scheduling overhead — high-value time spent on calendar logistics");
      if (scaleToFraction(a.maintenance_repeat) >= 0.4)
        points.push("Repetitive maintenance triage burning out your dispatch team");
      break;
    case "healthcare":
      if (midpointFromOption(a.no_show_rate) >= 10)
        points.push("No-show rate is directly killing revenue — every missed slot is unrecoverable");
      if (midpointFromOption(a.repeat_questions) >= 40)
        points.push("Front desk drowning in repeat questions instead of supporting patients");
      if (midpointFromOption(a.intake_time) >= 30)
        points.push("Slow intake friction — patients abandon before first visit");
      break;
    case "accounting_law":
      if (midpointFromOption(a.status_email_pct) >= 40)
        points.push("Senior staff spending hours per week on status-update emails (non-billable)");
      if (midpointFromOption(a.intake_hours) >= 15)
        points.push("Document intake & onboarding is non-billable time bleeding margin");
      if (midpointFromOption(a.research_time) >= 15)
        points.push("Research & drafting cycles slowing matter velocity");
      break;
    case "professional_services":
      if (midpointFromOption(a.reporting_hours) >= 5)
        points.push("Weekly reporting eats senior time that should be on strategy");
      if (midpointFromOption(a.repeat_comms) >= 40)
        points.push("Repetitive client comms creating context-switching tax across the team");
      if (midpointFromOption(a.tool_count) >= 7)
        points.push("Tool sprawl — your team is the integration layer (and it's not scalable)");
      break;
    case "ecommerce":
      if (midpointFromOption(a.repeat_tickets) >= 40)
        points.push("CS volume scales linearly with revenue — current model has no leverage");
      if (a.abandoned_cart && /Nothing|Single/.test(a.abandoned_cart))
        points.push("Significant cart abandonment recovery left on the table");
      break;
    case "finance_insurance":
      if (midpointFromOption(a.data_entry) >= 40)
        points.push("Advisors stuck on data entry instead of advisory revenue");
      if (midpointFromOption(a.inbound_pct) >= 40)
        points.push("Most inbound volume is repetitive policy/claims questions");
      if (a.compliance_tracking && /Spreadsheet|Manual/.test(a.compliance_tracking))
        points.push("Compliance tracked outside of system of record — audit risk + manual overhead");
      break;
  }

  // Pull free-text answer if present (last question is always a "what hurts most" prompt)
  const freeTextKeys = ["biggest_drain", "burnout", "fatigue_source", "bottleneck"];
  for (const key of freeTextKeys) {
    if (a[key] && a[key].trim().length > 8) {
      points.push(`In your words: "${a[key].trim()}"`);
      break;
    }
  }
  return points.slice(0, 4);
}

export function scoreAudit(input: ScoreInput): AuditResult {
  const opportunities = getOpportunitiesForIndustry(input);
  const painPoints = getTopPainPoints(input);

  const hoursPerWeekSaved = opportunities.reduce((sum, o) => sum + o.estHoursSavedPerWeek, 0);
  const hourlyRate = HOURLY_RATE[input.industryId] ?? 50;
  // Conservative monthly $ saved = (weekly hours × hourly rate × 4.3 weeks) - 30% safety margin
  const monthlyDollarsSaved = Math.round(hoursPerWeekSaved * hourlyRate * 4.3 * 0.7);

  // Burnout reduction: based on number of high-impact ops + reduction in repetitive load
  const highImpactCount = opportunities.filter((o) => o.impact === "High").length;
  const burnoutReductionPct = Math.min(75, 25 + highImpactCount * 12);

  // Efficiency score: reverse of how many pain points are present + tool sprawl + automation gaps
  const baseEfficiency = 80 - painPoints.length * 12 - opportunities.length * 4;
  const efficiencyScore = Math.max(20, Math.min(95, baseEfficiency));
  const potentialScore = Math.min(98, efficiencyScore + Math.min(40, hoursPerWeekSaved * 1.2));

  // ROI estimate: assume average AI investment $1.5k–4k/mo depending on industry
  const monthlyInvestment = input.industryId === "ecommerce" || input.industryId === "real_estate" ? 1800 : 3200;
  const roiMultiple = monthlyDollarsSaved > 0 ? (monthlyDollarsSaved * 12) / (monthlyInvestment * 12) : 0;
  const estimatedRoi =
    roiMultiple >= 8
      ? `${Math.round(roiMultiple)}x return in year one`
      : roiMultiple >= 3
        ? `${roiMultiple.toFixed(1)}x return in year one`
        : "Strong qualitative ROI — talk to us about a custom estimate";

  const industry = getIndustry(input.industryId);
  const industryName = industry?.name ?? "your business";
  const summaryPieces: string[] = [];
  if (hoursPerWeekSaved > 0) {
    summaryPieces.push(
      `Based on your answers, AI can realistically save your team about ${hoursPerWeekSaved} hours per week — roughly $${monthlyDollarsSaved.toLocaleString()} per month in recovered capacity.`
    );
  } else {
    summaryPieces.push(
      `Your operation is already running lean. The opportunities below focus on revenue protection and customer experience rather than pure cost-out.`
    );
  }
  summaryPieces.push(
    `For ${industryName.toLowerCase()}, the highest-leverage AI plays are concentrated in ${
      opportunities[0]?.category ?? "customer comms"
    } and ${opportunities[1]?.category ?? "operations"}.`
  );

  return {
    hoursPerWeekSaved,
    monthlyDollarsSaved,
    burnoutReductionPct,
    efficiencyScore,
    potentialScore,
    executiveSummary: summaryPieces.join(" "),
    topPainPoints: painPoints,
    opportunities,
    estimatedRoi,
  };
}
