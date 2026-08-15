// app/marketplace/page.tsx
import { Suspense } from "react";
import MarketplaceContent from "@/features/marketplace/page";

export const dynamic = "force-dynamic";

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <MarketplaceContent />
    </Suspense>
  );
}
