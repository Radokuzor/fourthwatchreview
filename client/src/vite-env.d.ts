/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_CALENDLY_URL?: string;
}
