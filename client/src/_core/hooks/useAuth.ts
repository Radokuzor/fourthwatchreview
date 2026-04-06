import { useUser, useClerk } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(_options?: UseAuthOptions) {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: Boolean(isSignedIn),
  });

  const logout = useCallback(async () => {
    await signOut();
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [signOut, utils]);

  const loading = !isLoaded || (isSignedIn && meQuery.isLoading);

  const user = meQuery.data
    ? meQuery.data
    : isSignedIn && clerkUser
      ? {
          id: 0,
          clerkId: clerkUser.id,
          name: clerkUser.fullName ?? clerkUser.primaryEmailAddress?.emailAddress ?? null,
          email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
          loginMethod: "clerk",
          role: "user" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null;

  return {
    user,
    loading,
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(isSignedIn),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
