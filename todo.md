# ReviewPilot TODO

## Database & Schema
- [x] clients table (id, userId, businessName, email, telegramChatId, notifyEmail, notifyTelegram, status, createdAt)
- [x] locations table (id, clientId, googleAccountId, googleLocationId, locationName, address, onboardingPath, accessToken, refreshToken, managerEmail, isActive, lastPolledAt)
- [x] reviews table (id, locationId, googleReviewId, reviewerName, rating, comment, publishedAt, status, fetchedAt)
- [x] review_responses table (id, reviewId, aiDraftResponse, finalResponse, status, approvedAt, postedAt, rejectedReason, editedBy)
- [x] brand_templates table (id, clientId, brandVoice, businessContext, responseTemplates JSON, toneGuidelines, createdAt, updatedAt)
- [x] approval_tokens table (id, reviewResponseId, token, action, expiresAt, usedAt)

## Backend — Core Routers
- [x] clients router: create, me, update
- [x] locations router: add location (manager path + OAuth path), list, update, delete, pollNow
- [x] reviews router: list by location
- [x] responses router: list, approve, reject, regenerate
- [x] templates router: get, upsert brand template per client
- [x] admin router: all clients, all reviews, client detail, update status, trigger poll
- [x] gbp router: oauthUrl, oauthCallback, listAccounts, listLocations

## Google Business Profile Integration
- [x] GBP OAuth flow (Path 2): authorize URL, callback, token storage
- [x] Manager invite path (Path 1): instructions + polling with platform service account
- [x] Review polling service: fetch new reviews for all active locations
- [x] Post reply to review via GBP API
- [x] Scheduled polling job (every 30 min via setInterval in server index)

## AI Response Generation
- [x] LLM prompt builder: uses rating, review text, brand voice, business context
- [x] invokeLLM integration for draft generation
- [x] Regenerate response endpoint with custom instructions

## Telegram Bot
- [x] Telegram bot webhook setup
- [x] Send approval message with review + draft response
- [x] Inline keyboard: Approve / Reject / Edit buttons
- [x] Handle callback queries: approve → post, reject → notify, edit → prompt

## Email Notifications
- [x] Email approval template (HTML) with approve/reject links
- [x] Approval token generation and validation
- [x] Email sending via Nodemailer SMTP
- [x] Token-based approve/reject webhook endpoint

## Approval Workflow
- [x] On new review: generate AI draft → send to Telegram + email
- [x] Approve action: post reply to GBP API, update DB status
- [x] Reject action: mark rejected, notify client to respond manually
- [x] Edit action: allow editing draft before posting

## Frontend — Landing Page
- [x] Hero section with value prop
- [x] How it works (3 steps)
- [x] Pricing section
- [x] CTA to sign up / get started

## Frontend — Onboarding
- [x] Path 1 UI: step-by-step instructions to add manager email
- [x] Path 2 UI: Google OAuth connect button (coming soon badge)
- [x] Location setup form
- [x] Brand voice template setup wizard

## Frontend — Client Dashboard
- [x] Connected locations list with poll-now button
- [x] Recent reviews feed with status badges
- [x] Response history (approved/rejected/pending)
- [x] Pending approval cards with approve/reject/edit/regenerate actions
- [x] Stats overview (locations, pending, posted, total)

## Frontend — Admin Dashboard
- [x] All clients table with stats and status management
- [x] Per-client location and review overview (expandable)
- [x] All reviews tab across all clients
- [x] Manual trigger review poll button per location

## Frontend — Brand Voice Editor
- [x] Business context, brand voice, tone guidelines
- [x] Response templates by rating tier (5★, 4★, 3★, 1-2★)
- [x] Avoid phrases and must-include elements
- [x] Language preference selector

## Scheduled Jobs
- [x] Review polling job (every 30 min)
- [x] Token expiry cleanup job (implemented — scheduled every 6 hours via setInterval in server startup, tested in credentials.test.ts)

## Tests
- [x] Schema migration applied
- [x] auth.me tests
- [x] clients.me and clients.create tests (including conflict guard)
- [x] admin access control tests (FORBIDDEN for non-admin)
- [x] responses.approve authorization tests (FORBIDDEN for wrong client)
- [x] templates.get tests
- [x] auth.logout tests

## Secrets Needed (post-delivery setup)
- [x] TELEGRAM_BOT_TOKEN — from @BotFather on Telegram
- [x] TELEGRAM_CHAT_ID — your personal Telegram chat ID
- [x] GOOGLE_CLIENT_ID — from Google Cloud Console
- [x] GOOGLE_CLIENT_SECRET — from Google Cloud Console
- [x] APPROVAL_EMAIL — email address to receive approval notifications
- [x] SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS — email SMTP credentials

## Marketing Strategy Document
- [x] Client acquisition tactics
- [x] Cold outreach scripts (email + DM)
- [x] Pricing model recommendations
- [x] Conversion funnel optimization
- [x] Apify-powered prospecting workflow
- [x] VA delegation playbook

## Phase 2 — Audit Page, Clerk Auth, Stripe Pricing

### Clerk Auth (replace Manus OAuth)
- [x] Install @clerk/clerk-sdk-node and @clerk/clerk-react
- [x] Add CLERK_SECRET_KEY and VITE_CLERK_PUBLISHABLE_KEY secrets
- [x] Replace server/_core/oauth.ts and context.ts with Clerk session verification
- [x] Replace useAuth() hook and getLoginUrl() with Clerk hooks (useUser, useClerk, SignIn)
- [x] Update all protectedProcedure logic to use Clerk session
- [x] Remove Manus OAuth env vars from usage (keep in env.ts for backward compat)
- [x] Update users table upsert to use Clerk userId as openId

### ScrapingDog + Audit Page Backend
- [x] Add SCRAPINGDOG_API_KEY secret
- [x] Build server/scraper.ts: searchBusinesses(query) via ScrapingDog Google Search API
- [x] Build server/scraper.ts: getBusinessReviews(placeId) via ScrapingDog Google Maps API
- [x] Build audit router: search, getAuditData, generateSampleResponse
- [x] Compute audit metrics: response rate, sentiment score, pain points, health score
- [x] Store audit lead (email, phone, businessName) in new audit_leads table

### Textbelt SMS
- [x] Add TEXTBELT_API_KEY secret (or use free tier key "textbelt")
- [x] Build server/sms.ts: sendSms(phone, message) via Textbelt API
- [x] Wire SMS into audit demo flow: send "Your AI response is ready — check your email to approve"

### New Homepage / Audit Page Frontend
- [x] Replace Home.tsx entirely with new audit-first homepage
- [x] Business name search bar as hero element
- [x] Business selector list when multiple results returned
- [x] "Business Forensic Analysis" loading popup (5 second animated loader)
- [x] Stats display: health score, sentiment, pain points, response rate, review velocity
- [x] Blur overlay on stats + email capture dialog ("verify you're a real person" OTP)
- [x] Live demo section: show one unanswered review, "Auto Respond" button
- [x] AI response generation on click, phone number capture for SMS alert
- [x] "Book a Live Demo" CTA with Calendly embed
- [x] Exit-intent popup for users who try to leave

### Calendly Integration
- [x] Add VITE_CALENDLY_URL secret (user's Calendly link)
- [x] Embed Calendly widget on homepage and in demo CTA section

### Hidden Stripe Pricing Page
- [x] Add Stripe via webdev_add_feature
- [x] Build /pricing route (hidden — not in main nav)
- [x] Add settings gear icon bottom-left of dashboard sidebar linking to /pricing
- [x] Entry plan: $19.99/month — 10 AI responses, client manager, phone approval, review alerts, basic analytics
- [x] Basic plan: $29.99/month — 15 responses, weekly health checks, business optimizer, competition review, AI business analyzer
- [x] Legendary plan: $89.99/month — everything + CRM integration, outreach campaigns for review generation, priority support
- [x] Exit-intent popup on pricing page: "Start free 14-day trial — card required, cancel anytime"
- [x] Stripe Checkout session creation for each plan with 14-day trial
- [x] Webhook handler: subscription activated → update client status in DB

### Updated Go-to-Market Strategy Doc
- [x] Rewrite strategy doc incorporating vetted advice from pasted document
- [x] Include cold caller playbook (Upwork/Fiverr scripts, objection handling)
- [x] SEO agency outreach as primary channel with email templates
- [x] Automated outreach stack recommendation (Apify → manual VA for now, upgrade path to Clay/Instantly)
- [x] Audit page as top-of-funnel engine
- [x] Pricing strategy rationale ($19.99 entry removes resistance)

## Bug Fixes
- [x] Business search returns no results on homepage — fixed: wrong ScrapingDog endpoint (/google/maps → /google_maps) and switched from useQuery to useMutation pattern

## Phase 3 — Audit Profile Saving & Competitive Analysis

### Audit Report → User Profile
- [ ] Expand audit_leads schema: add painPoints (JSON), topPraises (JSON), reviewVelocity, sentimentScore, competitorAnalysis (JSON), convertedAt timestamp
- [ ] On email capture: save full audit report (all metrics + pain points + praises) to audit_leads row
- [ ] Link audit lead to Clerk user: when user verifies email OTP and Clerk account is created, attach auditLeadId to users table
- [ ] Add auditLeadId column to users table (nullable FK → audit_leads.id)
- [ ] When user signs in after audit, auto-populate their dashboard with the business they audited
- [ ] Admin leads view: show full report data per lead (pain points, competitor analysis, health score)

### Competitive Analysis
- [ ] Add competitor search to scraper.ts: search "[business category] [city]" to find top 3 competitors
- [ ] Fetch competitor review metrics (rating, response rate, review count) via ScrapingDog
- [ ] Generate AI competitive analysis: what competitors do well, what the audited business is missing, specific action items
- [ ] Add competitorAnalysis section to audit report UI
- [ ] Save competitor analysis JSON to audit_leads.competitorAnalysis column

## Phase 4 — Rebrand to WatchReviews / FourthWatch
- [x] Generate eye logo mark (navy/blue palette, clean SVG-style)
- [x] Upload logo to CDN via manus-upload-file --webdev
- [x] Update VITE_APP_TITLE to "WatchReviews"
- [x] Update all navbar/header brand name text from ReviewPilot → WatchReviews
- [x] Update all page titles, meta descriptions, and hero copy
- [x] Update footer "Powered by FourthWatch" or "A FourthWatch product"
- [x] Replace star icon in navbar with eye logo
- [x] Update favicon to eye icon
- [x] Update DashboardLayout sidebar brand name
- [x] Update Pricing page brand references
- [x] Update onboarding and email templates brand name

## Phase 5 — Audit Analysis Overhaul

### Unanswered Reviews Fix
- [x] Fix unanswered count: use max(10 if total>20, 45% if total>100, actual count)
- [x] Fetch reviews sorted by most recent first

### AI Analysis Overhaul
- [x] Auto-detect industry/category from ScrapingDog category field
- [x] Rewrite AI prompt to be industry-specific and non-generic
- [x] Fix pain points vs top praises to be clearly distinct and specific
- [x] Add staff/operational signals card (staff names, recurring operational issues)
- [x] Add sentiment trend card (oldest 4 vs newest 4 reviews, green/red visual)
- [x] Add "Do This Now" suggestion card (1-2 specific actionable insights)
- [x] Add competitor keyword gap card (what competitors praised for that client isn't)
- [x] Cap total visible cards at 9 max (3x3 grid)

### See More Details Email
- [x] "See More Details" button sends branded HTML email with full deep-dive report
- [x] Show toast: "A detailed report has been sent to your email"
- [x] HTML email with WatchReviews branding (navy/blue, logo, structured sections)
- [x] Email includes: sentiment analysis, staff signals, operational patterns, competitor gap, timing patterns, Do This Now suggestions
- [x] Add sendDetailedReport procedure to audit router

## Phase 3 — Audit Profile Saving & Competitive Analysis (BACKLOG — revisit later)

### Audit Report → User Profile
- [ ] Expand audit_leads schema: add painPoints (JSON), topPraises (JSON), reviewVelocity, sentimentScore, competitorAnalysis (JSON), convertedAt timestamp
- [ ] On email capture: save full audit report (all metrics + pain points + praises) to audit_leads row
- [ ] Link audit lead to Clerk user: when user verifies email OTP and Clerk account is created, attach auditLeadId to users table
- [ ] Add auditLeadId column to users table (nullable FK → audit_leads.id)
- [ ] When user signs in after audit, auto-populate their dashboard with the business they audited
- [ ] Admin leads view: show full report data per lead (pain points, competitor analysis, health score)

### Competitive Analysis
- [ ] Add competitor search to scraper.ts: search "[business category] [city]" to find top 3 competitors
- [ ] Fetch competitor review metrics (rating, response rate, review count) via ScrapingDog
- [ ] Generate AI competitive analysis: what competitors do well, what the audited business is missing, specific action items
- [ ] Add competitorAnalysis section to audit report UI
- [ ] Save competitor analysis JSON to audit_leads.competitorAnalysis column

## Phase 6 — Free Trial Onboarding Flow

### Homepage Updates
- [x] Add "Start Free Trial" button to homepage hero (next to "Get Your Free Business Audit")
- [x] Update "How It Works" section: add bi-weekly business analytics reports step

### /onboarding Route — Multi-Step Flow
- [x] Create /free-trial route in App.tsx
- [x] Step 1 — Welcome: brand intro, value props (audit, sentiment, smart suggestions, automated responses), "Let's get started" CTA
- [x] Step 2 — Business: if user came from audit use their data; otherwise show business search (same ScrapingDog flow, fetch reviews only, no full analysis)
- [x] Step 3 — Service Showcase: animated cards cycling through 4 core services (Business Audit, Sentiment Analysis, Smart Suggestions, Automated Responses)
- [x] Step 4 — Live Demo Review: show one real unanswered review from their business, generate AI response, show approve/deny UI
- [x] Step 5 — Phone Capture: collect phone number, send SMS with review snippet + response snippet
- [x] Step 6 — Waiting Screen: animated "waiting for your response" screen, "Finish Onboarding" skip button
- [x] Step 7 — Plan Selection: all 3 tiers, monthly/yearly toggle (20% discount for yearly), highlight recommended plan
- [x] Step 8 — Stripe Card Capture: embedded Stripe Elements, custom styled, "You won't be charged for 14 days" messaging, submit → create Stripe subscription with trial

### Backend — Onboarding Support
- [x] Add onboarding.getReviewsOnly procedure: fetch reviews for a placeId (no AI analysis)
- [x] Add onboarding.generateDemoResponse procedure: generate AI response for a single review
- [x] Add onboarding.sendDemoApproval procedure: generate demo token, send email + SMS
- [x] Add onboarding.pollDemoStatus procedure: frontend polls this to check if user approved/denied via email
- [x] Add /api/demo/approve and /api/demo/deny HTTP endpoints
- [x] Stripe subscription with 14-day trial via Stripe Elements (SetupIntent + confirmCardSetup)
- [x] billing.createSetupIntent procedure added

### Simulated Response Display
- [x] After approval: show styled mock Google review card with original review + "Owner Response" section showing approved text
- [x] After denial: show "Response declined — you can customize and send your own" message

## Phase 6 — Hardening & Polish (follow-up)
- [ ] Avoid creating dynamic Stripe Price objects per request — cache or pre-create price IDs
- [ ] Add Stripe webhook handling for subscription lifecycle events (customer.subscription.created, invoice.paid) to activate client subscription status
- [ ] Harden Stripe Elements trial flow: attach payment method to subscription as default after confirmCardSetup
- [ ] Surface user-facing warning toast when SMS send fails during demo approval
- [ ] Add vitest tests for billing.createSetupIntent and onboarding procedures

## Phase 6 — Stripe Webhook Fix (urgent)
- [x] Handle customer.subscription.created webhook: activate client subscription status in DB
- [x] Handle customer.subscription.updated webhook: sync subscription status changes (active, trialing, canceled)
- [x] Handle setup_intent.succeeded webhook: attach payment method to subscription and activate
- [x] Create client record if one doesn't exist when subscription is activated (for onboarding users who haven't signed in yet)
- [x] Handle customer.subscription.deleted: mark client as cancelled

## Phase 7 — Onboarding Overhaul & Dashboard Integration (Complete)

### Clerk Email OTP Auth
- [x] Add Clerk email OTP to Step 1 of /free-trial: after email entered, send OTP via Clerk, show 6-digit code input
- [x] On OTP verify: if existing Clerk account → sign in; if new → sign up and create account
- [x] Update nav: show Sign Out button when user is authenticated (replace Sign In)
- [x] Sign Out button calls Clerk signOut and redirects to homepage

### Brand Voice Capture Step
- [x] Add Step 3b (after service showcase, before live demo): brand voice questionnaire
- [x] Q1: "How would you describe your brand tone?" — choices: Warm & Friendly / Professional & Formal / Bold & Confident / Playful & Fun + "None of these" free text
- [x] Q2: "What matters most in your responses?" — choices: Personal touch / Speed & efficiency / Empathy first / Showcase expertise + "None of these" free text
- [x] Q3: "What should we NEVER say?" — choices: Generic apologies / Corporate jargon / Defensive language / Discount offers + free text
- [x] Q4: "What should we always include?" — choices: Reviewer's first name / Invite them back / Mention specific details / Team appreciation + free text
- [x] Save brand voice answers to brandTemplates table on backend (onboarding.saveBrandVoice procedure)

### Background Audit During Onboarding
- [x] After business is selected in Step 2, trigger full AI audit in background (non-blocking)
- [x] Save audit results to user_audits table linked to user email / userId
- [x] On dashboard load, check if audit results exist and display them
- [x] Add Skip for now button on payment step — goes directly to /dashboard without payment
- [x] Dashboard shows full audit forensic report (score rings, pain points, praises, staff signals, sentiment trend, competitor gap, Do This Now) when audit data is available
- [x] Tests for audit.getMyAudit and onboarding.runAndSaveAudit added (audit.test.ts)

### Dashboard Integration
- [x] After payment step completes, redirect to /dashboard (existing client dashboard)
- [x] Dashboard shows list of recent reviews with AI-generated responses
- [x] "Start Live Replies" button → opens Calendly appointment booking
- [x] "Add Another Business" button on dashboard → links to /free-trial
- [x] Dashboard empty state redirects to /free-trial instead of /onboarding

### Nav & Auth Updates
- [x] Nav shows Sign In when logged out, Sign Out when logged in
- [x] Sign Out clears Clerk session and redirects to homepage

## Bug Fixes — Phase 7

- [x] Fix: "Let's Get Started" button disabled when Clerk fails to load (sandbox env) — removed Clerk isLoaded dependency from button disabled state; if Clerk unavailable, skip OTP and go straight to business step
- [x] Fix: "Start Free Trial" button on audit page produces blank page — was pointing to /sign-in instead of /free-trial; corrected
- [x] Fix: /dashboard (and all protected pages) redirect to homepage before Clerk finishes loading — added loading guard before isAuthenticated check on Dashboard, Onboarding, AdminDashboard, Settings, BrandVoice pages

## Bug Fixes — OTP Flow

- [x] Fix: OTP email must always be sent when user submits email on /free-trial — button now waits for Clerk to be ready before enabling; only skips OTP if no Clerk key is configured (sandbox/dev)
- [x] Fix: OTP verification screen always appears and blocks progression until code is verified
- [x] Fix: After OTP verified, user is signed in/up in Clerk session before advancing to business step

## Auth Overhaul — Pure Clerk

- [x] Fix: Clerk hooks stuck in loading — root cause was old Clerk key pointing to vendeezygroup.com; updated to clerk.fourthwatchtech.com
- [x] Fix: OTP button simplified — only disabled when no valid email or actively sending; shows friendly retry message if Clerk not ready
- [x] Fix: Backend context.ts already uses clerk.authenticateRequest() natively — session recognized after OTP sign-in
- [x] Fix: useAuth hook already purely Clerk-based (useUser/useClerk) — no Manus OAuth dependency
- [x] Updated VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to new fourthwatchtech Clerk app

## UX Improvements — Onboarding Flow

- [x] Fix: When user clicks "Start Free Trial" after completing the audit, carry over their email and business data — skip email and business steps entirely, start at showcase step
- [x] Fix: If user is already signed into Clerk when they reach /free-trial, skip OTP step and go straight to the next relevant step (showcase or business)
- [x] Fix: If user enters an email and they are already signed in as that user, skip OTP and advance

---

## Product Roadmap — Priority Ordered

### P1 — VA Operations Flow (Build Next)
> Enables revenue generation NOW without waiting for Google API approval. One VA can manage 25–30 accounts from a single sheet.

- [ ] Google Sheets integration: when a new review is detected, auto-add a row (Business Name, Date, Reviewer, Rating, Review Text, AI Draft Response, VA Notes, Status)
- [ ] AI pre-fills the "AI Draft Response" column automatically on row creation
- [ ] Status dropdown column: Pending / Approved / Posted / Skipped
- [ ] When VA marks row as "Approved", trigger email/SMS to business owner for final sign-off
- [ ] Admin dashboard view showing all accounts, pending reviews, and sheet links
- [ ] ScrapingDog polling: check each managed business for new reviews every 6–12 hours
- [ ] Notify VA (via email or Telegram) when new reviews are added to the sheet
- [ ] Apply for Google My Business API internal use scope (manual step — document the process)

---

### P2 — SEO / Discoverability Scoring (High Value Upsell)
> Adds a second strong reason to upgrade. Fits naturally into the existing audit flow as an additional score ring.

- [ ] Take business URL as input during audit (optional field)
- [ ] Crawl the page: check title tag, meta description, H1, schema markup, mobile-friendliness
- [ ] Check Google Business Profile completeness score (hours, photos, description, categories)
- [ ] Check NAP consistency: does the business name/address/phone match across directories
- [ ] AI discoverability score: query Perplexity/ChatGPT for "[business type] in [city]" and check if business appears
- [ ] Page speed score via Lighthouse API or PageSpeed Insights API (free)
- [ ] Backlink authority score via free Moz or DataForSEO API
- [ ] Show SEO score as a new ring/card in the audit results alongside the review health score
- [ ] Add SEO recommendations to the "Do This Now" card
- [ ] Include SEO section in the branded email report

---

### P3 — Yelp Reviews (Read-Only Sentiment Layer)
> Adds Yelp data to the audit. No posting (ToS risk) — draft responses for owner to manually copy-paste.

- [ ] ScrapingDog Yelp scraper: fetch business Yelp page by name + city
- [ ] Pull Yelp rating, total review count, and recent review text
- [ ] Add Yelp sentiment to the audit: combined Google + Yelp health score
- [ ] Show Yelp unanswered reviews separately in the audit results
- [ ] AI drafts Yelp responses — owner copies and pastes manually (clearly labeled "Copy to Yelp")
- [ ] Add Yelp response drafts to the VA Google Sheet flow
- [ ] Include Yelp section in the branded email report

---

### P4 — Social Media Reputation Management (Medium-Term)
> Transforms WatchReviews into a full public reputation manager. Requires OAuth connections from business owners.

#### Phase 4a — Social Listening (Pull + Analyze)
- [ ] Facebook/Instagram: OAuth connection flow — business owner connects their Meta Business account
- [ ] Pull last 10 posts from Instagram Business and Facebook Page
- [ ] Analyze post performance: likes, comments, shares, reach
- [ ] Sentiment analysis on comments: what is the audience saying?
- [ ] Show social sentiment score in dashboard alongside Google/Yelp scores
- [ ] Add social insights to the branded email report

#### Phase 4b — Comment Response
- [ ] AI drafts responses to Instagram/Facebook comments
- [ ] Owner approves via same email approval flow as Google reviews
- [ ] Post approved responses via Meta Graph API
- [ ] Add comment responses to VA Google Sheet flow

#### Phase 4c — Post Creation & Scheduling
- [ ] Analyze what post types perform best for the business
- [ ] AI suggests 3 post ideas per week based on review themes and audience sentiment
- [ ] Generate caption + image prompt for each suggested post
- [ ] Schedule posts via Meta Graph API
- [ ] Show content calendar in dashboard

---

### P5 — Google Review Posting Automation (Long-Term)
> Full end-to-end automation. Requires Google API approval or headless browser approach.

- [ ] Apply for Google My Business API external OAuth scope approval
- [ ] Build OAuth flow: business owner connects their GBP account directly (no manager invite needed)
- [ ] Post approved responses automatically via GBP API when owner approves
- [ ] Fallback: Chrome Extension that auto-fills and submits approved responses with one click
- [ ] Headless browser fallback (Puppeteer + residential proxy) for accounts pending API approval

---

### P6 — Phase 3 (Deferred — Audit Profile Saving)
> Links audit data to user accounts for persistent dashboard history.

- [ ] Expand audit_leads schema: add painPoints, topPraises, competitorAnalysis JSON columns
- [ ] Save full audit data when user captures email
- [ ] Link audit leads to Clerk users (auditLeadId FK on users table)
- [ ] Auto-populate dashboard for returning users who ran an audit before signing up
- [ ] Admin leads view showing full report data per lead
- [ ] Full competitive analysis section: AI-generated, saved to DB, displayed in audit UI

## Promo Code Bypass

- [x] Add promo code input field to the payment step in /free-trial (below card fields)
- [x] If user enters "freecode", skip Stripe entirely and set a cookie `wr_access=freecode` (30-day expiry)
- [x] Redirect to /dashboard after promo code accepted
- [x] Dashboard and protected pages check for `wr_access=freecode` cookie as valid access (alongside real Stripe subscription)
- [x] Show a subtle "Demo Access" badge in the dashboard nav when on promo access
- [x] Promo users without a client record see a demo dashboard with "Complete Setup" CTA

## Bug Fix — Demo Access Badge

- [ ] Fix: Demo Access badge shows for all users who sign up through onboarding — should only show when wr_access=freecode cookie is present AND user has no real Stripe subscription

## Dashboard Audit Data (Priority)

- [ ] Add user_audits table to schema: userId (FK), placeId, businessName, auditJson (TEXT), createdAt
- [ ] Add onboarding.saveAuditResults procedure: saves full AuditAnalysis JSON for a user
- [ ] Add onboarding.getMyAudit procedure: returns latest audit for the current user
- [ ] Trigger full AI audit in background after business selection in FreeTrial.tsx (Step 2)
- [ ] Add "Skip for now →" grey button on payment step that goes to /dashboard
- [ ] Rebuild Dashboard to show audit cards when audit data exists (health score, pain points, praises, sentiment trend, do this now, unanswered count)
- [ ] Dashboard shows locked/greyed premium feature cards (SEO, Social PR) for future upsell
- [ ] Remove Demo Access badge — all users see the same dashboard regardless of payment status

## Bug Fixes — Post-Onboarding Dashboard (Phase 8 Follow-up)

- [x] Fix: Dashboard audit query uses sessionStorage email (ft_email) as fallback when Clerk user is not yet hydrated
- [x] Fix: Dashboard audit query enabled even for promo/skip users (not gated on Clerk user object)
- [x] Fix: Promo code apply creates a client record on backend via new promoActivate procedure so user lands on full dashboard
- [x] Fix: Nav shows empty placeholder instead of "Sign In" while Clerk is hydrating (both top nav and footer)
- [x] Fix: user.id=0 (falsy during Clerk hydration) no longer blocks audit query — only real positive IDs are passed
- [x] Fix: After OTP sign-in, if user came from audit page, skip straight to showcase step instead of business search

## Sign-In Page Updates
- [x] Rename brand on sign-in page from "ReviewPilot" to "WatchReviews"
- [x] Remove Google OAuth sign-in button
- [x] Add phone number input field to sign-in page
