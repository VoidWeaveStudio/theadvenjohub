// app/f/[slug]/dashboard/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveFactionRef } from "@/core/lib/factionPublic";
import { FounderDashboard } from "@/features/faction-page/FounderDashboard";

export const metadata: Metadata = {
  title: "Faction dashboard",
  robots: { index: false, follow: false },
};

export default async function FactionDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const ref = await resolveFactionRef(slug);
  if (!ref) notFound();

  return <FounderDashboard slug={slug} />;
}
