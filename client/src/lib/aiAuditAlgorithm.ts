/**
 * AI Audit — deterministic recommendation engine.
 *
 * Given an industry + the user's survey answers, produce:
 *   - 3 scores (time waste, money waste, employee fatigue)
 *   - A prioritized list of AI opportunities, each with the *specific*
 *     pain it solves and an estimated savings range derived from
 *     the user's own volume / team / hours answers.
 *
 * No LLM call — runs instantly client-side, fully predictable.
 */

import type { Industry } from "./aiAuditContent";

export type Insight = {
  id: string;
  title: string;
  problem: string;
  solution: string;
  estTimeSaved: string;
  estCostSaved: string;
  fatigueImpact: "high" | "medium" | "low";
  category: "time" | "money" | "fatigue" | "growth";
  priority: number;
};

export type AuditReport = {
  industryId: string;
  industryName: string;
  scores: {
    timeWaste: number;        // 0-100, higher = more waste
    moneyLeak: number;        // 0-100
    burnoutRisk: number;      // 0-100
    aiReadiness: number;      // 0-100, higher = more upside from AI
  };
  headline: string;
  summary: string;
  topInsights: Insight[];     // 3-5 prioritized
  estimatedMonthlyHoursSaved: number;
  estimatedMonthlySavings: number; // USD
};

// ─── Numeric mappings ─────────────────────────────────────────────────────────
const VOLUME_MAP: Record<string, number> = {
  "Under 25": 15,
  "25–100": 60,
  "100–500": 300,
  "500–2,000": 1200,
  "2,000+": 3500,
};

const HOURS_MAP: Record<string, number> = {
  "< 5 hrs": 3,
  "5–15 hrs": 10,
  "15–30 hrs": 22,
  "30–60 hrs": 45,
  "60+ hrs": 75,
};

const TEAM_MAP: Record<string, number> = {
  "Just me": 1,
  "2–5": 3,
  "6–15": 10,
  "16–50": 30,
  "50+": 80,
};

const PCT_MAP: Record<string, number> = {
  "Under 20%": 0.10,
  "20–40%": 0.30,
  "40–60%": 0.50,
  "40–70%": 0.55,
  "60–80%": 0.70,
  "70–90%": 0.80,
  "80%+": 0.85,
  "90%+": 0.95,
  "Under 20% are status": 0.10,
  "80%+ are status": 0.85,
  "Under 20% data entry": 0.10,
  "80%+ data entry": 0.85,
};

const SCALE_MAP: Record<string, number> = {
  "Almost never": 0,
  "Rarely": 1,
  "Sometimes": 2,
  "Often": 3,
  "All the time": 4,
};

// Average fully-loaded labor cost per team-hour (US small biz blended)
const HOURLY_COST = 45;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function numFromVolume(v?: string): number {
  return v ? VOLUME_MAP[v] ?? 0 : 0;
}
function numFromHours(v?: string): number {
  return v ? HOURS_MAP[v] ?? 0 : 0;
}
function numFromTeam(v?: string): number {
  return v ? TEAM_MAP[v] ?? 1 : 1;
}
function numFromPct(v?: string): number {
  return v ? PCT_MAP[v] ?? 0 : 0;
}
function numFromScale(v?: string): number {
  return v ? SCALE_MAP[v] ?? 0 : 0;
}

function fmtMoney(n: number): string {
  if (n >= 10000) return `$${Math.round(n / 1000)}k`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmtHours(n: number): string {
  return `${Math.round(n)} hrs/mo`;
}

function range(low: number, high: number, formatter: (n: number) => string): string {
  return `${formatter(low)} – ${formatter(high)}`;
}

// ─── Per-industry rule sets ───────────────────────────────────────────────────
type Rule = (a: Record<string, string>) => Insight | null;

const REAL_ESTATE_RULES: Rule[] = [
  // Lead response automation
  (a) => {
    const leadVol = numFromVolume(a.lead_volume);
    const fastResp = numFromPct(a.response_time);
    if (leadVol < 25 || fastResp >= 0.7) return null;
    const missedLeadsPerWk = leadVol * (1 - fastResp);
    const monthlyMissed = missedLeadsPerWk * 4;
    const recoveredValueLow = monthlyMissed * 50;
    const recoveredValueHigh = monthlyMissed * 200;
    return {
      id: "re_lead_speed",
      title: "AI Lead Response Concierge",
      problem: `You receive ~${leadVol} inquiries/week but only respond fast to ${Math.round(fastResp * 100)}%. ~${Math.round(monthlyMissed)} leads/month go cold.`,
      solution: "AI agent answers every inquiry in <60 seconds, qualifies the lead, books showings on the right agent's calendar, and routes hot leads to humans.",
      estTimeSaved: range(20, 40, (n) => `${n} hrs/mo`),
      estCostSaved: range(recoveredValueLow, recoveredValueHigh, fmtMoney),
      fatigueImpact: "high",
      category: "money",
      priority: 100,
    };
  },
  // Showing scheduling
  (a) => {
    const hrs = numFromHours(a.showing_hours);
    if (hrs < 10) return null;
    const monthlyHrs = hrs * 4;
    const aiHrs = Math.round(monthlyHrs * 0.7);
    return {
      id: "re_scheduling",
      title: "AI Scheduling & Tenant Screening",
      problem: `Your team spends ~${hrs} hrs/week on showings, screening and paperwork — that's ~${monthlyHrs} hrs/month of pure admin.`,
      solution: "AI assistant handles inbound scheduling, sends self-tour codes, runs initial screening (income/credit/refs), and pre-fills paperwork. Humans only touch qualified deals.",
      estTimeSaved: `${aiHrs} hrs/mo`,
      estCostSaved: fmtMoney(aiHrs * HOURLY_COST),
      fatigueImpact: "high",
      category: "time",
      priority: 90,
    };
  },
  // Maintenance triage
  (a) => {
    const repeat = numFromScale(a.maintenance_repeat);
    if (repeat < 2) return null;
    return {
      id: "re_maint",
      title: "AI Maintenance Triage Bot",
      problem: `Maintenance requests are repetitive ${repeat >= 3 ? "constantly" : "frequently"} — your team is the lockout hotline.`,
      solution: "Tenant-facing AI handles the top 70% of common requests (lockouts, troubleshooting, how-tos), creates work orders for real issues, and dispatches vendors automatically.",
      estTimeSaved: range(15, 30, (n) => `${n} hrs/mo`),
      estCostSaved: range(800, 2000, fmtMoney),
      fatigueImpact: "high",
      category: "fatigue",
      priority: 80,
    };
  },
  // Lead nurture
  (a) => {
    const fu = a.follow_up;
    if (!fu || fu === "Multi-channel automation") return null;
    return {
      id: "re_nurture",
      title: "AI Lead Nurture & Re-engagement",
      problem: `Your follow-up process: "${fu}". Most cold leads never hear from you again — that's pure pipeline loss.`,
      solution: "AI re-engages every cold lead with personalized email + SMS sequences based on what they originally asked about. Books warm leads back into your calendar.",
      estTimeSaved: range(8, 16, (n) => `${n} hrs/mo`),
      estCostSaved: range(1500, 5000, fmtMoney),
      fatigueImpact: "low",
      category: "growth",
      priority: 70,
    };
  },
  (a) => {
    const team = numFromTeam(a.team_size);
    if (team < 3) return null;
    return {
      id: "re_internal_ops",
      title: "Internal Ops Copilot",
      problem: `With ${a.team_size} on the team, internal updates, weekly reports and handoffs eat hours every week.`,
      solution: "Slack/Teams AI copilot summarizes inbound activity, drafts weekly owner reports, and answers internal questions about leases, vendors and policies.",
      estTimeSaved: range(10, 20, (n) => `${n} hrs/mo`),
      estCostSaved: range(team * 80, team * 200, fmtMoney),
      fatigueImpact: "medium",
      category: "time",
      priority: 60,
    };
  },
];

const HEALTHCARE_RULES: Rule[] = [
  (a) => {
    const hrs = numFromHours(a.front_desk_calls);
    if (hrs < 10) return null;
    const monthly = hrs * 4;
    const aiHrs = Math.round(monthly * 0.75);
    return {
      id: "hc_reminders",
      title: "AI Appointment Confirmations & Recall",
      problem: `Your front desk burns ~${hrs} hrs/week on confirmations and recall — that's ${monthly} hrs/month they can't spend on patients in the room.`,
      solution: "AI handles confirmations via SMS/voice, asks the right reschedule questions, and proactively books recall patients. Front desk only touches escalations.",
      estTimeSaved: `${aiHrs} hrs/mo`,
      estCostSaved: fmtMoney(aiHrs * HOURLY_COST),
      fatigueImpact: "high",
      category: "time",
      priority: 95,
    };
  },
  (a) => {
    const noShow = a.no_show_rate;
    if (!noShow || noShow === "Under 5%") return null;
    const apptVol = numFromVolume(a.appt_volume);
    const noShowPct = numFromPct(noShow.replace("%+", "%").replace(/\d+–/, "Under "));
    const monthlyNoShows = apptVol * 4 * (noShow.includes("30%+") ? 0.3 : noShow.includes("20–30%") ? 0.25 : noShow.includes("10–20%") ? 0.15 : 0.075);
    const lostRevLow = monthlyNoShows * 80;
    const lostRevHigh = monthlyNoShows * 250;
    return {
      id: "hc_no_show",
      title: "AI No-Show Reduction System",
      problem: `Your no-show rate (${noShow}) costs ~${Math.round(monthlyNoShows)} appointments/month — pure revenue evaporating.`,
      solution: "AI sends multi-step intelligent reminders (right channel, right time), detects ghost-risk patients, and auto-rebooks open slots from your waitlist.",
      estTimeSaved: range(5, 15, (n) => `${n} hrs/mo`),
      estCostSaved: range(lostRevLow, lostRevHigh, fmtMoney),
      fatigueImpact: "medium",
      category: "money",
      priority: 100,
    };
  },
  (a) => {
    const repeat = numFromPct(a.repeat_questions);
    if (repeat < 0.4) return null;
    return {
      id: "hc_chat",
      title: "Patient FAQ AI Assistant",
      problem: `${Math.round(repeat * 100)}% of inbound patient questions are repetitive (hours, pricing, prep) — that's a constant interruption tax on your staff.`,
      solution: "Website + SMS AI chat handles the top 70-90% of repetitive questions in your brand voice. Escalates real medical questions to staff.",
      estTimeSaved: range(15, 30, (n) => `${n} hrs/mo`),
      estCostSaved: range(700, 1800, fmtMoney),
      fatigueImpact: "high",
      category: "fatigue",
      priority: 85,
    };
  },
  (a) => {
    const intake = a.intake_time;
    if (!intake || intake === "Under 15 min") return null;
    return {
      id: "hc_intake",
      title: "AI Intake & History Compiler",
      problem: `New-patient intake takes ${intake} per patient. With ${a.appt_volume || "moderate"} appointment volume, that's days of staff time monthly.`,
      solution: "AI walks new patients through intake before their visit (text or web), compiles a clean clinical summary, and drops it into your EHR.",
      estTimeSaved: range(20, 40, (n) => `${n} hrs/mo`),
      estCostSaved: range(900, 2200, fmtMoney),
      fatigueImpact: "high",
      category: "time",
      priority: 90,
    };
  },
  (a) => {
    const fu = a.follow_up_care;
    if (!fu || fu === "Automated sequences") return null;
    return {
      id: "hc_follow_up",
      title: "Automated Post-Visit Care Follow-Up",
      problem: `Post-visit follow-up: "${fu}". Patients fall through the cracks → bad outcomes, bad reviews, missed retention.`,
      solution: "AI sends personalized post-visit care instructions, checks in at the right intervals, and flags escalations to clinicians.",
      estTimeSaved: range(8, 18, (n) => `${n} hrs/mo`),
      estCostSaved: range(600, 2000, fmtMoney),
      fatigueImpact: "medium",
      category: "growth",
      priority: 70,
    };
  },
];

const ACCOUNTING_LAW_RULES: Rule[] = [
  (a) => {
    const hrs = numFromHours(a.intake_hours);
    if (hrs < 10) return null;
    const monthly = hrs * 4;
    const aiHrs = Math.round(monthly * 0.6);
    return {
      id: "al_intake",
      title: "Client Intake & Document Automation",
      problem: `~${hrs} hrs/week on intake & onboarding = ${monthly} hrs/month of non-billable, soul-draining admin.`,
      solution: "AI sends the right intake forms, chases missing documents, OCRs everything, and pre-builds the client file before a paralegal touches it.",
      estTimeSaved: `${aiHrs} hrs/mo`,
      estCostSaved: fmtMoney(aiHrs * 65),
      fatigueImpact: "high",
      category: "time",
      priority: 95,
    };
  },
  (a) => {
    const status = numFromPct(a.status_email_pct);
    if (status < 0.4) return null;
    return {
      id: "al_status",
      title: "AI Client Status Concierge",
      problem: `${Math.round(status * 100)}% of inbound emails are status checks — that's senior people answering "where are we on my matter?" all day.`,
      solution: "Self-serve client portal + AI assistant gives clients real-time status, next steps, and answers in your firm's voice. Routes substantive questions to the right person.",
      estTimeSaved: range(20, 40, (n) => `${n} hrs/mo`),
      estCostSaved: range(2500, 6000, fmtMoney),
      fatigueImpact: "high",
      category: "fatigue",
      priority: 100,
    };
  },
  (a) => {
    const proposal = a.proposal_process;
    if (!proposal || proposal === "Document automation tool") return null;
    return {
      id: "al_proposal",
      title: "AI Proposal & Engagement Letter Generator",
      problem: `Your proposal process: "${proposal}". Every engagement letter built from scratch is hours you don't bill back.`,
      solution: "AI drafts proposals, engagement letters, and SOWs from a 3-question intake — using your firm's templates, pricing, and clauses.",
      estTimeSaved: range(8, 20, (n) => `${n} hrs/mo`),
      estCostSaved: range(1500, 4500, fmtMoney),
      fatigueImpact: "medium",
      category: "money",
      priority: 80,
    };
  },
  (a) => {
    const research = numFromHours(a.research_time);
    if (research < 10) return null;
    return {
      id: "al_research",
      title: "AI Research & Document Summarization",
      problem: `~${research} hrs/week on research and summarizing — that's the part nobody trained for and nobody enjoys.`,
      solution: "Domain-specific AI surfaces relevant precedent/regs, summarizes long documents, drafts memo-quality outlines, and highlights anomalies. Humans review, not write.",
      estTimeSaved: range(20, 40, (n) => `${n} hrs/mo`),
      estCostSaved: range(2200, 5500, fmtMoney),
      fatigueImpact: "high",
      category: "time",
      priority: 90,
    };
  },
  (a) => {
    const dl = a.deadline_tracking;
    if (!dl || dl === "Practice management software") return null;
    return {
      id: "al_deadlines",
      title: "Compliance & Deadline Watchdog",
      problem: `Deadline tracking: "${dl}". One missed filing = malpractice exposure or IRS penalties.`,
      solution: "AI watches every matter, surfaces upcoming deadlines, drafts reminder comms to clients, and flags anything at risk to partners.",
      estTimeSaved: range(4, 10, (n) => `${n} hrs/mo`),
      estCostSaved: range(500, 2500, fmtMoney),
      fatigueImpact: "medium",
      category: "money",
      priority: 75,
    };
  },
];

const PRO_SERVICES_RULES: Rule[] = [
  (a) => {
    const hrs = numFromHours(a.reporting_hours);
    if (hrs < 5) return null;
    const monthly = hrs * 4;
    return {
      id: "ps_reporting",
      title: "AI Client Reporting Engine",
      problem: `~${hrs} hrs/week on client reporting = ${monthly} hrs/month nobody bills for.`,
      solution: "AI pulls metrics from every tool (analytics, ad platforms, CRM), drafts on-brand reports with insights and next-step recommendations, sends them on schedule.",
      estTimeSaved: `${Math.round(monthly * 0.85)} hrs/mo`,
      estCostSaved: fmtMoney(Math.round(monthly * 0.85) * HOURLY_COST),
      fatigueImpact: "high",
      category: "time",
      priority: 100,
    };
  },
  (a) => {
    const repeat = numFromPct(a.repeat_comms);
    if (repeat < 0.4) return null;
    return {
      id: "ps_internal_chat",
      title: "Project Status AI Concierge",
      problem: `${Math.round(repeat * 100)}% of project comms are repetitive (status, scope clarifications, FAQs).`,
      solution: "Slack/email AI assistant answers status questions, surfaces blockers, and posts daily/weekly summaries — for both internal team and clients.",
      estTimeSaved: range(15, 30, (n) => `${n} hrs/mo`),
      estCostSaved: range(1500, 4000, fmtMoney),
      fatigueImpact: "high",
      category: "fatigue",
      priority: 90,
    };
  },
  (a) => {
    const proposals = a.proposal_volume;
    if (!proposals || proposals === "Under 5") return null;
    const volPerMonth = proposals === "5–15" ? 10 : proposals === "15–40" ? 27 : proposals === "40–100" ? 70 : 130;
    return {
      id: "ps_proposals",
      title: "AI Proposal & SOW Builder",
      problem: `~${volPerMonth} proposals/month built largely by hand — that's senior people doing $10/hr work.`,
      solution: "AI generates first-draft proposals from a discovery call transcript or short brief, using your past winning proposals as the model.",
      estTimeSaved: range(15, 35, (n) => `${n} hrs/mo`),
      estCostSaved: range(1800, 5000, fmtMoney),
      fatigueImpact: "medium",
      category: "money",
      priority: 80,
    };
  },
  (a) => {
    const tools = a.tool_count;
    if (!tools || tools === "1–3") return null;
    return {
      id: "ps_unify",
      title: "Unified Workspace AI Layer",
      problem: `Your team toggles between ${tools} tools daily. Context-switching alone kills 20-40% of productive time.`,
      solution: "AI command bar + cross-tool search lets your team query/update everything from one place. Pulls answers from all your sources without a single tab switch.",
      estTimeSaved: range(20, 50, (n) => `${n} hrs/mo`),
      estCostSaved: range(2000, 6000, fmtMoney),
      fatigueImpact: "high",
      category: "fatigue",
      priority: 70,
    };
  },
  (a) => {
    const onboard = a.onboarding_time;
    if (!onboard || onboard === "Under 1 day") return null;
    return {
      id: "ps_onboard",
      title: "AI-Powered Client Onboarding",
      problem: `New client onboarding takes ${onboard} — that's billable runway you're burning before the project starts.`,
      solution: "AI runs the onboarding questionnaire, generates a project plan, sets up tools/access, and produces the kickoff deck — all from a single intake.",
      estTimeSaved: range(8, 16, (n) => `${n} hrs/mo`),
      estCostSaved: range(1200, 3500, fmtMoney),
      fatigueImpact: "medium",
      category: "time",
      priority: 75,
    };
  },
];

const ECOMMERCE_RULES: Rule[] = [
  (a) => {
    const tickets = numFromVolume(a.ticket_volume);
    const repeat = numFromPct(a.repeat_tickets);
    if (tickets < 25 || repeat < 0.3) return null;
    const repeatTickets = tickets * 4 * repeat;
    const aiHandled = repeatTickets * 0.85;
    const minutesSaved = aiHandled * 6;
    return {
      id: "ec_cs",
      title: "AI Customer Support Agent",
      problem: `~${tickets} CS tickets/week, ${Math.round(repeat * 100)}% repetitive. Your team answers "where's my order?" all day.`,
      solution: "Trained AI agent handles shipping/returns/sizing/order-status tickets end-to-end (Gorgias/Zendesk/Front). Escalates only true edge cases.",
      estTimeSaved: `${Math.round(minutesSaved / 60)} hrs/mo`,
      estCostSaved: fmtMoney(Math.round(minutesSaved / 60) * 28),
      fatigueImpact: "high",
      category: "fatigue",
      priority: 100,
    };
  },
  (a) => {
    const cart = a.abandoned_cart;
    if (!cart || cart === "Email + SMS + paid retargeting") return null;
    return {
      id: "ec_cart",
      title: "AI-Driven Abandoned Cart Recovery",
      problem: `Cart recovery: "${cart}". Industry-wide, smart multi-channel sequences recover 15-30% of abandoned carts. You're leaving most on the table.`,
      solution: "AI personalizes win-back per shopper (browsed products, lifetime value, channel preference) across email, SMS, and on-site. A/B tests itself continuously.",
      estTimeSaved: range(4, 10, (n) => `${n} hrs/mo`),
      estCostSaved: range(2500, 12000, fmtMoney),
      fatigueImpact: "low",
      category: "money",
      priority: 95,
    };
  },
  (a) => {
    const content = a.content_process;
    if (!content || content === "AI assisted") return null;
    return {
      id: "ec_content",
      title: "AI Product Content & SEO Engine",
      problem: `Content process: "${content}". Every product page is hours of manual work — and SEO catches none of it.`,
      solution: "AI writes on-brand product descriptions, A/B-tests headlines, generates SEO-rich category pages, and refreshes content based on traffic data.",
      estTimeSaved: range(15, 35, (n) => `${n} hrs/mo`),
      estCostSaved: range(1200, 4500, fmtMoney),
      fatigueImpact: "medium",
      category: "growth",
      priority: 75,
    };
  },
  (a) => {
    const review = a.review_process;
    if (!review || review === "Automated alerts + responses") return null;
    return {
      id: "ec_reviews",
      title: "AI Review Monitoring & Auto-Response",
      problem: `Review process: "${review}". Bad reviews compound. Unanswered reviews tank your rating. You probably miss most.`,
      solution: "AI watches Google/Amazon/Trustpilot/Shopify, drafts on-brand responses to every review for 1-tap approval, and surfaces customer pain trends.",
      estTimeSaved: range(6, 14, (n) => `${n} hrs/mo`),
      estCostSaved: range(800, 3000, fmtMoney),
      fatigueImpact: "medium",
      category: "growth",
      priority: 80,
    };
  },
  (a) => {
    const launch = a.launch_speed;
    if (!launch || launch === "Under 1 week") return null;
    return {
      id: "ec_launch",
      title: "AI Product Launch Workflow",
      problem: `New product takes ${launch} to go live — that's revenue locked behind your slowest internal process.`,
      solution: "AI generates listings, photos prep instructions, launch copy, ad creative, and email sequences from a single product brief. Cuts launch cycle in half.",
      estTimeSaved: range(10, 25, (n) => `${n} hrs/mo`),
      estCostSaved: range(1500, 5000, fmtMoney),
      fatigueImpact: "low",
      category: "growth",
      priority: 70,
    };
  },
];

const FINANCE_RULES: Rule[] = [
  (a) => {
    const onboard = a.onboarding_time;
    if (!onboard || onboard === "Under 1 day") return null;
    return {
      id: "fi_onboarding",
      title: "AI Client Onboarding & KYC",
      problem: `Onboarding takes ${onboard} per client — KYC, doc collection, signatures, data entry. Most of it could be automated.`,
      solution: "AI runs ID verification, asks for the right docs, OCRs and validates them, prefills CRM/Salesforce, and routes exceptions to humans.",
      estTimeSaved: range(20, 50, (n) => `${n} hrs/mo`),
      estCostSaved: range(2200, 6500, fmtMoney),
      fatigueImpact: "high",
      category: "time",
      priority: 100,
    };
  },
  (a) => {
    const inbound = numFromPct(a.inbound_pct);
    if (inbound < 0.4) return null;
    return {
      id: "fi_servicing",
      title: "AI Policy & Claims Concierge",
      problem: `${Math.round(inbound * 100)}% of inbound is policy details, claims status, and coverage questions — your highest-paid people are call center agents.`,
      solution: "Compliant AI assistant (web, SMS, voice) handles policy lookups, claims status, coverage questions in real time. Escalates true advisory work to humans.",
      estTimeSaved: range(25, 50, (n) => `${n} hrs/mo`),
      estCostSaved: range(2800, 7500, fmtMoney),
      fatigueImpact: "high",
      category: "fatigue",
      priority: 95,
    };
  },
  (a) => {
    const dataEntry = numFromPct(a.data_entry);
    if (dataEntry < 0.4) return null;
    return {
      id: "fi_data_entry",
      title: "AI Data Entry & Document Processing",
      problem: `${Math.round(dataEntry * 100)}% of your team's time is data entry — not advisory. That's the wrong ratio.`,
      solution: "AI ingests applications, statements, and forms, extracts every field accurately, validates against rules, and posts directly to your systems.",
      estTimeSaved: range(20, 40, (n) => `${n} hrs/mo`),
      estCostSaved: range(2000, 5500, fmtMoney),
      fatigueImpact: "high",
      category: "time",
      priority: 90,
    };
  },
  (a) => {
    const renewal = a.renewals;
    if (!renewal || renewal === "Multi-channel automation") return null;
    return {
      id: "fi_renewals",
      title: "AI Renewal & Cross-Sell Engine",
      problem: `Renewal/cross-sell process: "${renewal}". Every missed renewal is a lifetime client lost. Every missed cross-sell is pure margin gone.`,
      solution: "AI flags upcoming renewals, scores cross-sell fit per client, drafts personalized outreach, and books advisor calls — across email, SMS, and voice.",
      estTimeSaved: range(8, 20, (n) => `${n} hrs/mo`),
      estCostSaved: range(3000, 12000, fmtMoney),
      fatigueImpact: "low",
      category: "growth",
      priority: 85,
    };
  },
  (a) => {
    const compliance = a.compliance_tracking;
    if (!compliance || compliance === "Compliance platform") return null;
    return {
      id: "fi_compliance",
      title: "AI Compliance Watchdog",
      problem: `Compliance tracking: "${compliance}". One missed disclosure = regulator letter, fine, or license risk.`,
      solution: "AI monitors every client interaction, flags missing disclosures, generates audit-ready logs, and proactively alerts compliance officers to anomalies.",
      estTimeSaved: range(6, 15, (n) => `${n} hrs/mo`),
      estCostSaved: range(1200, 5000, fmtMoney),
      fatigueImpact: "medium",
      category: "money",
      priority: 75,
    };
  },
];

const RULES_BY_INDUSTRY: Record<string, Rule[]> = {
  real_estate: REAL_ESTATE_RULES,
  healthcare: HEALTHCARE_RULES,
  accounting_law: ACCOUNTING_LAW_RULES,
  professional_services: PRO_SERVICES_RULES,
  ecommerce: ECOMMERCE_RULES,
  finance_insurance: FINANCE_RULES,
};

// ─── Score derivation ─────────────────────────────────────────────────────────
function deriveScores(answers: Record<string, string>, insights: Insight[]): AuditReport["scores"] {
  // Time waste — based on hours-related answers, repeat/data entry %, and tool sprawl
  let timeWaste = 25;
  const hoursAnswers = ["showing_hours", "front_desk_calls", "intake_hours", "research_time", "reporting_hours"];
  for (const k of hoursAnswers) {
    const v = answers[k];
    if (!v) continue;
    if (v === "60+ hrs") timeWaste += 25;
    else if (v === "30–60 hrs") timeWaste += 18;
    else if (v === "15–30 hrs") timeWaste += 10;
    else if (v === "5–15 hrs") timeWaste += 4;
  }
  if (answers.tool_count) {
    const tc = answers.tool_count;
    if (tc === "16+") timeWaste += 12;
    else if (tc === "11–15") timeWaste += 9;
    else if (tc === "7–10") timeWaste += 6;
  }

  // Money leak — based on missed leads, no-shows, content/launch friction, manual fall-offs
  let moneyLeak = 20;
  const fastResp = numFromPct(answers.response_time);
  const leadVol = numFromVolume(answers.lead_volume);
  if (leadVol > 25 && fastResp < 0.7) moneyLeak += Math.round((0.7 - fastResp) * 60);
  if (answers.no_show_rate) {
    const ns = answers.no_show_rate;
    if (ns === "30%+") moneyLeak += 25;
    else if (ns === "20–30%") moneyLeak += 18;
    else if (ns === "10–20%") moneyLeak += 10;
  }
  if (answers.follow_up && (answers.follow_up.startsWith("Manually") || answers.follow_up === "We don't follow up")) {
    moneyLeak += 12;
  }
  if (answers.abandoned_cart === "Nothing") moneyLeak += 18;
  else if (answers.abandoned_cart === "Single email") moneyLeak += 8;
  if (answers.renewals && (answers.renewals === "Manually, ad hoc" || answers.renewals === "We don't")) moneyLeak += 12;

  // Burnout risk — repetitive volume, fatigue text, follow-up gaps, status emails
  let burnoutRisk = 25;
  const repeatPctKeys = ["repeat_questions", "status_email_pct", "repeat_tickets", "inbound_pct", "data_entry", "repeat_comms"];
  for (const k of repeatPctKeys) {
    const v = answers[k];
    const pct = numFromPct(v);
    if (pct >= 0.7) burnoutRisk += 15;
    else if (pct >= 0.5) burnoutRisk += 9;
    else if (pct >= 0.3) burnoutRisk += 4;
  }
  if (answers.maintenance_repeat) {
    const m = numFromScale(answers.maintenance_repeat);
    if (m >= 3) burnoutRisk += 8;
  }
  // High-fatigue insights inflate burnout risk
  burnoutRisk += insights.filter((i) => i.fatigueImpact === "high").length * 3;

  // AI readiness = how much upside is on the table = sum of priorities normalized
  const sumPrio = insights.reduce((acc, i) => acc + i.priority, 0);
  const aiReadiness = Math.min(100, Math.round((sumPrio / 5) * 0.9 + 10));

  return {
    timeWaste: Math.min(100, timeWaste),
    moneyLeak: Math.min(100, moneyLeak),
    burnoutRisk: Math.min(100, burnoutRisk),
    aiReadiness,
  };
}

function sumEstimates(insights: Insight[]): { hours: number; money: number } {
  let hours = 0;
  let money = 0;
  for (const i of insights) {
    const h = i.estTimeSaved.match(/(\d+)\s*–?\s*(\d+)?/);
    if (h) {
      const lo = Number(h[1] ?? 0);
      const hi = Number(h[2] ?? lo);
      hours += (lo + hi) / 2;
    }
    const m = i.estCostSaved.match(/\$([\d.]+)k?\s*–?\s*\$?([\d.]+)?k?/);
    if (m) {
      const parse = (s: string | undefined): number => {
        if (!s) return 0;
        const n = parseFloat(s);
        return s.includes("k") || (parseFloat(s) < 50 && i.estCostSaved.includes("k")) ? n * 1000 : n;
      };
      const lo = parse(m[1]);
      const hi = parse(m[2]);
      money += (lo + (hi || lo)) / 2;
    }
  }
  return { hours: Math.round(hours), money: Math.round(money) };
}

function buildHeadline(industry: Industry, scores: AuditReport["scores"]): string {
  if (scores.aiReadiness >= 75) {
    return `${industry.name.split(" & ")[0]} is one of the highest-leverage industries for AI right now — and your operation has multiple compounding opportunities.`;
  }
  if (scores.aiReadiness >= 55) {
    return `Your team has 3-4 clear AI wins available — most can be live in under 30 days.`;
  }
  return `You're already running tight, but there are still meaningful AI wins worth exploring.`;
}

function buildSummary(scores: AuditReport["scores"], totals: { hours: number; money: number }): string {
  const parts: string[] = [];
  if (totals.hours > 0) parts.push(`recover ~${totals.hours} hours/month of staff time`);
  if (totals.money > 0) parts.push(`unlock an estimated ${fmtMoney(totals.money)}/month in saved cost or recovered revenue`);
  if (scores.burnoutRisk >= 60) parts.push(`take meaningful pressure off your team`);
  if (parts.length === 0) return "Based on your answers, AI can streamline several day-to-day workflows.";
  return `Based on what you shared, the right AI deployments could ${parts.join(", ")}.`;
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function generateAuditReport(industry: Industry, answers: Record<string, string>): AuditReport {
  const rules = RULES_BY_INDUSTRY[industry.id] ?? [];
  const insights: Insight[] = [];
  for (const rule of rules) {
    const result = rule(answers);
    if (result) insights.push(result);
  }
  insights.sort((a, b) => b.priority - a.priority);
  const topInsights = insights.slice(0, 5);

  const scores = deriveScores(answers, topInsights);
  const totals = sumEstimates(topInsights);

  return {
    industryId: industry.id,
    industryName: industry.name,
    scores,
    headline: buildHeadline(industry, scores),
    summary: buildSummary(scores, totals),
    topInsights,
    estimatedMonthlyHoursSaved: totals.hours,
    estimatedMonthlySavings: totals.money,
  };
}
