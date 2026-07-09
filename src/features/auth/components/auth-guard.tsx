"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import { UnauthenticatedView } from "./unauthenticated-view";
import { AuthLoadingView } from "./auth-loading-view";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <AuthLoading>
        <AuthLoadingView />
      </AuthLoading>
      <Authenticated>
        {children}
      </Authenticated>
      <Unauthenticated>
        <UnauthenticatedView />
      </Unauthenticated>
    </>
  );
};
