//app\marketplace\page.tsx
import { Suspense } from "react";
import MarketplaceContent from "@/features/marketplace/page";

export const dynamic = "force-dynamic";

export default function MarketplacePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        <MarketplaceContent />
      </Suspense>
    </div>
  );
}