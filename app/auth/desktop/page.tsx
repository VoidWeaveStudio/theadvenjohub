// src/app/auth/desktop/page.tsx
import { Suspense } from "react";
import DesktopAuthPage from "@/features/auth/desktop/page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DesktopAuthPage />
    </Suspense>
  );
}