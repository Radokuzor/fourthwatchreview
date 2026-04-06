export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Auth is handled by Clerk (see `ClerkProvider` in `main.tsx` and `useAuth`).
 */
export const getLoginUrl = () => {
  return "/sign-in";
};
