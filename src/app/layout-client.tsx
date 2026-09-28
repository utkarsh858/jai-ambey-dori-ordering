"use client";

import { LoadingIndicator } from "@/components/LoadingIndicator";

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LoadingIndicator />
    </>
  );
}
