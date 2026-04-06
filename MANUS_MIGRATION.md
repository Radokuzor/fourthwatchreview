# ReviewPilot: Manus → Railway Migration Guide

> **Goal:** Remove all Manus platform dependencies. Replace with Railway (DB + hosting), Supabase (auth only), and direct API access. This document is written for an LLM to execute sequentially.

---

## Dependency Map: What Manus Provides vs. What Replaces It

| Manus Feature | Where Used | Replacement |
|---|---|---|
| Manus OAuth (`OAUTH_SERVER_URL`) | Auth flow, user identity | Supabase Auth |
| Forge API – LLM | `server/aiResponse.ts`, `server/scraper.ts` | Google AI Studio (Gemini API directly) |
| Forge API – Email | `server/emailService.ts` | Nodemailer via SMTP (already wired, just unused) |
| Forge API – File Storage | `server/storage.ts` | Cloudinary or Railway volume / S3 |
| Forge API – Data APIs | `server/scraper.ts` (Google Places) | Google Places API directly |
| Manus MySQL DB | All DB queries | Railway MySQL (same schema, just new `DATABASE_URL`) |
| `vite-plugin-manus-runtime` | `vite.config.ts` | Remove entirely |
| Manus dev host allowlist | `vite.config.ts` | Remove; add Railway/custom domain |
| Manus log middleware (`/__manus__/logs`) | `vite.config.ts` | Remove entirely |
| `.manus/` directory | Dev debug cache | Delete |
| `client/public/__manus__/` | Version/debug files | Delete |
| `APP_BASE_URL` default (`reviewpilot.manus.space`) | `server/reviewPipeline.ts` | Set to Railway app URL |
| Clerk auth (`@clerk/clerk-react`, `@clerk/backend`) | Frontend + backend | Remove (Supabase replaces) |
| `OWNER_OPEN_ID` (Manus openId) | Admin role assignment | Replace with Supabase user ID |

---

## Environment Variables: Old → New

### Remove these variables completely
```
OAUTH_SERVER_URL          # Manus OAuth server
BUILT_IN_FORGE_API_URL    # Forge LLM/email/storage
BUILT_IN_FORGE_API_KEY    # Forge API key
OWNER_OPEN_ID             # Manus user identity
VITE_APP_ID               # Manus app ID
VITE_FRONTEND_FORGE_API_KEY
VITE_FRONTEND_FORGE_API_URL
CLERK_SECRET_KEY
VITE_CLERK_PUBLISHABLE_KEY
```

### Add these new variables
```
# Supabase Auth
SUPABASE_URL              # e.g. https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY # Backend-only, never exposed to client
VITE_SUPABASE_URL         # Same value, exposed to frontend
VITE_SUPABASE_ANON_KEY    # Public anon key, exposed to frontend

# AI (Google AI Studio - free tier available)
GEMINI_API_KEY            # From https://aistudio.google.com/apikey

# App
APP_BASE_URL              # Your Railway app domain e.g. https://reviewpilot.up.railway.app
OWNER_SUPABASE_ID         # Supabase UUID of the platform owner (you)

# JWT (keep, just ensure it's set)
JWT_SECRET                # Generate a strong random string
```

### Keep unchanged
```
DATABASE_URL              # Just point to Railway MySQL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_PLATFORM_ACCESS_TOKEN
GOOGLE_MANAGER_EMAIL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
VITE_STRIPE_PUBLISHABLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_OWNER_CHAT_ID
SCRAPINGDOG_API_KEY
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
TEXTBELT_API_KEY
PORT
NODE_ENV
VITE_CALENDLY_URL
```

---

## Phase 1: Remove Manus Build Tooling

### Step 1.1 — Remove `vite-plugin-manus-runtime`

**File:** `package.json`

Remove from `devDependencies`:
```json
"vite-plugin-manus-runtime": "0.0.57"
```

Run: `pnpm remove vite-plugin-manus-runtime`

---

### Step 1.2 — Rewrite `vite.config.ts`

**File:** `vite.config.ts`

Replace the entire file with this clean version:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client/",
  publicDir: "client/public/",
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/trpc": "http://localhost:3000",
      "/api": "http://localhost:3000",
    },
  },
});
```

This removes:
- `vitePluginManusRuntime()` import and call
- The entire Manus debug log collector plugin
- The `/__manus__/logs` middleware
- All `.manus.computer` allowed hosts

---

### Step 1.3 — Delete Manus directories and files

```bash
rm -rf .manus/
rm -rf .manus-logs/
rm -rf client/public/__manus__/
```

---

## Phase 2: Replace Manus Auth with Supabase

The current auth system uses Manus OAuth to exchange a code for a token, then stores a user record keyed by `openId`. The new system uses Supabase Auth — Supabase handles login/session, and the backend validates the Supabase JWT.

### Step 2.1 — Install Supabase packages

```bash
pnpm add @supabase/supabase-js
pnpm remove @clerk/clerk-react @clerk/backend @clerk/clerk-sdk-node
```

---

### Step 2.2 — Update the database schema

**File:** `drizzle/schema.ts`

In the `users` table, replace `openId` with `supabaseId`:

```typescript
// BEFORE
openId: varchar("open_id", { length: 255 }).notNull().unique(),
loginMethod: varchar("login_method", { length: 50 }),

// AFTER
supabaseId: varchar("supabase_id", { length: 255 }).notNull().unique(),
```

Generate and run migration:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

### Step 2.3 — Rewrite the backend auth middleware

**File:** `server/_core/sdk.ts` (or wherever Manus OAuth exchange lives)

The Manus auth flow calls `/webdev.v1.WebDevAuthPublicService/ExchangeToken` and `/GetUserInfo`. Replace the entire auth module with Supabase JWT verification:

```typescript
// server/_core/auth.ts  (new file, replaces sdk.ts auth logic)
import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  // Look up or create our local user record
  let [localUser] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, user.id))
    .limit(1);

  if (!localUser) {
    const isOwner = user.id === process.env.OWNER_SUPABASE_ID;
    [localUser] = await db
      .insert(users)
      .values({
        supabaseId: user.id,
        name: user.user_metadata?.full_name ?? user.email ?? "User",
        email: user.email ?? "",
        role: isOwner ? "admin" : "user",
      })
      .$returningId();
    [localUser] = await db.select().from(users).where(eq(users.supabaseId, user.id)).limit(1);
  }

  return localUser;
}
```

---

### Step 2.4 — Update tRPC context to use Supabase auth

**File:** `server/_core/index.ts` (or wherever tRPC context is created)

Replace the Manus cookie/JWT session lookup with the new `getUserFromRequest`:

```typescript
// In the tRPC createContext function, replace:
// const user = await getManusUser(req)
// With:
const user = await getUserFromRequest(req);
```

Remove all references to:
- `COOKIE_NAME` cookie reading
- `jose` JWT verification of Manus tokens
- `OAUTH_SERVER_URL` calls
- `VITE_APP_ID` / app ID checks

---

### Step 2.5 — Update the `SignIn` page (frontend)

**File:** `client/src/pages/SignIn.tsx`

Replace the Manus OAuth redirect with Supabase Auth UI:

```tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Google OAuth sign-in:
async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  });
}
```

Remove all `@clerk/clerk-react` imports and `<ClerkProvider>` wrappers from `client/src/main.tsx`.

---

### Step 2.6 — Add Supabase client to frontend

Create `client/src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Update frontend auth hook to get the Supabase session token and attach it to tRPC requests as `Authorization: Bearer <access_token>`.

In the tRPC client setup (wherever `httpBatchLink` is configured):

```typescript
import { supabase } from "../lib/supabase";

// In headers:
headers: async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
},
```

---

### Step 2.7 — Enable Google OAuth in Supabase dashboard

In Supabase Dashboard → Authentication → Providers → Google:
- Enable Google provider
- Enter your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Add your Railway domain to "Redirect URLs": `https://your-app.up.railway.app/**`

---

### Step 2.8 — Update admin role assignment

**File:** `server/routers.ts` (or wherever `adminProcedure` is defined)

Replace:
```typescript
// BEFORE: checks user.role !== "admin" and OWNER_OPEN_ID
```
With the existing `role` column check — no changes needed if the schema migration set `role: "admin"` for the owner. Just ensure `OWNER_SUPABASE_ID` env var is set to your Supabase user UUID.

---

## Phase 3: Replace Forge API with Direct Services

### Step 3.1 — Replace Forge LLM with Google AI Studio

**File:** `server/aiResponse.ts` and `server/scraper.ts`

Install Google AI SDK:
```bash
pnpm add @google/generative-ai
```

Replace all Forge LLM calls:

```typescript
// BEFORE (Forge)
const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/v1/chat/completions`, {
  headers: { Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
  body: JSON.stringify({ model: "gemini-2.5-flash", messages, ... })
});

// AFTER (Google AI Studio)
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const result = await model.generateContent({
  contents: [{ role: "user", parts: [{ text: prompt }] }],
  generationConfig: {
    responseMimeType: "application/json",   // for structured JSON output
  },
});
const text = result.response.text();
```

For every place that used `response_format: { type: "json_schema", json_schema: ... }` (Forge structured output), switch to:
```typescript
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: { ... }  // Gemini native schema
}
```

Search for all occurrences of `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` and replace.

---

### Step 3.2 — Replace Forge Email with direct SMTP (Nodemailer)

**File:** `server/emailService.ts`

The app already has `nodemailer` installed and `SMTP_*` env vars. The Forge notification endpoint (`/notification/email`) is just a wrapper.

Replace the Forge email call:

```typescript
// BEFORE (Forge)
await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/notification/email`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
  body: JSON.stringify({ to, subject, html })
});

// AFTER (direct SMTP)
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

await transporter.sendMail({
  from: process.env.SMTP_USER,
  to,
  subject,
  html,
});
```

Recommended SMTP provider: **Resend** (free 3k emails/mo) — `smtp.resend.com:587`.

---

### Step 3.3 — Replace Forge File Storage

**File:** `server/storage.ts`

The Forge storage API (`/v1/storage/upload`, `/v1/storage/downloadUrl`) needs a replacement. Two options:

**Option A: Cloudinary (recommended for images)**
```bash
pnpm add cloudinary
```
```typescript
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({ cloud_name: "...", api_key: "...", api_secret: "..." });

// Upload
const result = await cloudinary.uploader.upload(fileBuffer, { resource_type: "auto" });
return result.secure_url;
```
Add env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

**Option B: Supabase Storage (reuses existing Supabase connection)**
```typescript
const { data, error } = await supabaseAdmin.storage
  .from("uploads")
  .upload(fileName, fileBuffer, { contentType });
const { data: { publicUrl } } = supabaseAdmin.storage.from("uploads").getPublicUrl(fileName);
```

Check where `storage.ts` is actually called in the app. If it's only used for logo/asset uploads and is rarely used, Supabase Storage is the path-of-least-resistance since you already have the client set up.

---

### Step 3.4 — Replace Forge Data API (Google Places)

**File:** `server/scraper.ts`

Search for `/webdevtoken.v1.WebDevService/CallApi` calls. These proxy Google Places/Search through Forge.

Replace with direct Google Places API calls:

```typescript
// Google Places Text Search
const response = await fetch(
  `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
);
```

Add env var: `GOOGLE_PLACES_API_KEY` (enable "Places API" in Google Cloud Console under the same project as your existing Google credentials).

---

## Phase 4: Database — Migrate to Railway MySQL

### Step 4.1 — Provision Railway MySQL

1. In Railway dashboard: **New Project → Database → MySQL**
2. Copy the `DATABASE_URL` from Railway's "Connect" tab
3. Format: `mysql://user:password@host:port/database`

### Step 4.2 — Run migrations on Railway DB

```bash
DATABASE_URL="mysql://railway-connection-string" pnpm drizzle-kit migrate
```

### Step 4.3 — Update `.env` / Railway environment variables

Set `DATABASE_URL` in Railway project variables to the new Railway MySQL connection string.

No code changes needed — `drizzle.config.ts` already reads `DATABASE_URL`.

---

## Phase 5: Deploy to Railway

### Step 5.1 — Add Railway config files

Create `railway.toml` in project root:

```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install && pnpm build"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/api/health"
restartPolicyType = "on_failure"
```

Create `nixpacks.toml` in project root:

```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[phases.install]
cmds = ["npm install -g pnpm && pnpm install --frozen-lockfile"]

[phases.build]
cmds = ["pnpm build"]

[start]
cmd = "node dist/index.js"
```

### Step 5.2 — Add a health check endpoint

**File:** `server/_core/index.ts`

Add before tRPC middleware:

```typescript
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
```

### Step 5.3 — Set all environment variables in Railway

In Railway → your service → Variables, add every env var from the "Keep unchanged" and "Add new" lists above. The Railway MySQL `DATABASE_URL` is auto-injected if they're in the same Railway project.

### Step 5.4 — Update hardcoded URLs

Search and replace all occurrences of `reviewpilot.manus.space`:

**File:** `server/reviewPipeline.ts` (line 179):
```typescript
// BEFORE
const baseUrl = process.env.APP_BASE_URL ?? "https://reviewpilot.manus.space";

// AFTER
const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
```

**File:** `server/routers.ts` (line 1091, approval email links):
```typescript
// BEFORE
const baseUrl = process.env.APP_BASE_URL ?? "https://localhost:3000";

// AFTER — no change needed, already reads APP_BASE_URL
```

Set `APP_BASE_URL` in Railway variables to `https://your-service.up.railway.app` once deployed.

### Step 5.5 — Update Vite dev server allowed hosts (optional, dev only)

Since the new `vite.config.ts` from Step 1.2 already removes Manus hosts and uses `host: true`, no further changes needed for dev.

For Railway preview URLs during development, Vite's `host: true` covers it.

---

## Phase 6: Supabase Project Setup

### Step 6.1 — Create Supabase project

1. Go to supabase.com → New Project
2. Choose a region close to your Railway region
3. Save the project URL and keys

### Step 6.2 — Configure Google OAuth in Supabase

1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Enter `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
3. Copy the "Callback URL" Supabase shows you
4. Add this callback URL to your Google Cloud Console OAuth app's "Authorized redirect URIs"
5. In Supabase → Authentication → URL Configuration:
   - Site URL: `https://your-app.up.railway.app`
   - Redirect URLs: `https://your-app.up.railway.app/**`

### Step 6.3 — (Optional) Enable email magic links

In Supabase → Authentication → Providers → Email → Enable if you want passwordless email login as a fallback.

---

## Phase 7: Cleanup

### Step 7.1 — Remove Clerk completely

```bash
pnpm remove @clerk/clerk-react @clerk/backend @clerk/clerk-sdk-node
```

Search for and remove all remaining `import ... from "@clerk/..."` statements in the codebase.

Remove `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from all `.env` files.

### Step 7.2 — Remove WatchReviews CloudFront branding (if desired)

Search for `d2xsxph8kpxj0f.cloudfront.net` — these are hardcoded WatchReviews logo URLs. Either:
- Host your own logos in `client/public/` and reference them locally
- Or use Supabase Storage / Cloudinary if you need CDN delivery

### Step 7.3 — Final search for Manus remnants

Run these searches and confirm zero results:

```bash
grep -r "manus" . --include="*.ts" --include="*.tsx" --include="*.json" -i -l
grep -r "forge.manus.im" . -r
grep -r "BUILT_IN_FORGE" . -r
grep -r "OAUTH_SERVER_URL" . -r
grep -r "openId\|open_id\|openid" . --include="*.ts" -i  # should only remain as Google OAuth field names
grep -r "clerk" . --include="*.ts" --include="*.tsx" -i -l
```

### Step 7.4 — Update `package.json` scripts

Confirm the `build` and `start` scripts work standalone:

```json
"scripts": {
  "dev": "concurrently \"vite\" \"tsx watch server/_core/index.ts\"",
  "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "NODE_ENV=production node dist/index.js"
}
```

---

## Execution Order Summary

Execute phases in this exact order to avoid broken states:

1. **Phase 1** — Remove Manus build tooling (safe, no runtime impact)
2. **Phase 4** — Provision Railway MySQL and run schema migration (before any code deployment)
3. **Phase 3** — Replace Forge API (LLM → Gemini, Email → SMTP, Storage → Cloudinary/Supabase)
4. **Phase 2** — Replace Manus Auth with Supabase (biggest change, do last in dev)
5. **Phase 6** — Configure Supabase project settings
6. **Phase 5** — Deploy to Railway
7. **Phase 7** — Final cleanup and verification

---

## Files to Change — Master List

| File | Change |
|---|---|
| `package.json` | Remove `vite-plugin-manus-runtime`, `@clerk/*`; add `@supabase/supabase-js`, `@google/generative-ai` |
| `vite.config.ts` | Full rewrite (Phase 1.2) |
| `drizzle/schema.ts` | Rename `openId` → `supabaseId` in users table |
| `server/_core/sdk.ts` | Replace Manus OAuth with Supabase JWT verification |
| `server/_core/index.ts` | Update tRPC context; add health check endpoint |
| `server/aiResponse.ts` | Replace Forge LLM calls with `@google/generative-ai` |
| `server/scraper.ts` | Replace Forge LLM + Data API with Google AI + Places API |
| `server/emailService.ts` | Replace Forge email with direct nodemailer SMTP |
| `server/storage.ts` | Replace Forge storage with Cloudinary or Supabase Storage |
| `server/routers.ts` | Remove Clerk middleware; update admin check |
| `server/reviewPipeline.ts` | Replace `reviewpilot.manus.space` default URL |
| `client/src/main.tsx` | Remove `<ClerkProvider>`; add Supabase session provider |
| `client/src/pages/SignIn.tsx` | Replace Manus OAuth redirect with Supabase OAuth |
| `client/src/lib/supabase.ts` | New file — Supabase client singleton |
| `client/src/hooks/useAuth.ts` | Update to use Supabase session |
| `.env` / Railway vars | Add Supabase vars, Gemini key; remove Forge/Clerk/Manus vars |
| `railway.toml` | New file |
| `nixpacks.toml` | New file |

---

## Cost Comparison

| Service | Manus | Replacement | Cost |
|---|---|---|---|
| DB | Manus MySQL | Railway MySQL | $5/mo (Hobby) or free 500MB |
| Hosting | Manus | Railway Node.js service | $5/mo (Hobby) |
| Auth | Manus OAuth | Supabase Auth | Free (50k MAU) |
| LLM | Forge (Gemini) | Google AI Studio | Free (1500 req/day) or pay-as-go |
| Email | Forge notification | Resend SMTP | Free (3k/mo) |
| Storage | Forge storage | Supabase Storage | Free (1GB) |
| **Total** | | | **~$10/mo** |

---

## Risk Notes

- **`openId` → `supabaseId` migration**: If there is existing user data in the Manus MySQL DB that you want to preserve, you cannot automatically map Manus `openId` values to Supabase UUIDs. Users will need to re-authenticate after migration, which will create new local user records. Their client/location/review data can be re-linked manually if needed by email address.
- **Gemini structured output**: The Forge API used OpenAI-compatible `response_format.json_schema`. Google AI Studio's native schema format differs slightly — test each AI prompt carefully after migration.
- **Stripe webhooks**: Update the webhook endpoint URL in Stripe dashboard from the Manus URL to your Railway URL.
- **Telegram webhook**: Re-register the Telegram bot webhook URL via `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.up.railway.app/api/telegram/webhook`
