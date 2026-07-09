"use client";

import { useCallback } from "react";
import { useClerk } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";

/**
 * Lets signed-out visitors browse the app shell while any real action sends
 * them to sign up first. `requireAuth` wraps a handler: when there is no
 * session it opens Clerk's sign-up modal instead of running the handler.
 */
export const useRequireAuth = () => {
  const { openSignUp } = useClerk();
  const { isAuthenticated, isLoading } = useConvexAuth();

  const requireAuth = useCallback(
    (action: () => void) => {
      return () => {
        if (isLoading) return;

        if (!isAuthenticated) {
          openSignUp({});
          return;
        }

        action();
      };
    },
    [isAuthenticated, isLoading, openSignUp],
  );

  return { isAuthenticated, isLoading, requireAuth };
};
