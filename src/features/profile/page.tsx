//src\features\profile\page.tsx
import { Suspense } from "react";
import ProfileContent from "./components/ProfileContent";

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}