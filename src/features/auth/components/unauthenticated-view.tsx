"use client";

import Link from "next/link";
import Image from "next/image";
import { LockIcon } from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Button } from "@/components/ui/button";

export const UnauthenticatedView = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-screen bg-background p-6">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo.svg" alt="CloudAIIDE" width={24} height={24} />
        <span className="text-lg font-semibold">CloudAIIDE</span>
      </Link>
      <div className="w-full max-w-lg bg-muted">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <LockIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Sign in to continue</ItemTitle>
            <ItemDescription>
              Create an account or sign in to open this project.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">
                Sign up
              </Button>
            </SignUpButton>
          </ItemActions>
        </Item>
      </div>
    </div>
  );
};
