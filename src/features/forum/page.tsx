//src\features\forum\page.tsx
import { Suspense } from "react";
import ForumContent from "./components/ForumContent";

export const dynamic = "force-dynamic";

export default function ForumPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ForumContent />
      </Suspense>
    </div>
  );
}