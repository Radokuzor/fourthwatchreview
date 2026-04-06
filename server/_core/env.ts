export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  clerkPublishableKey:
    process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
  ownerClerkUserId: process.env.OWNER_CLERK_USER_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  scrapingDogApiKey: process.env.SCRAPINGDOG_API_KEY ?? "",
  textbeltApiKey: process.env.TEXTBELT_API_KEY ?? "textbelt",
  /** OpenAI API key (ChatGPT / Responses API via chat completions) */
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  /** Default model for invokeLLM (e.g. gpt-4o-mini) */
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "uploads",
};
