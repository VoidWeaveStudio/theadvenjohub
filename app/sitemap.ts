// app/sitemap.ts
import type { MetadataRoute } from "next";
import { listIndexableFactions } from "@/core/lib/factionPublic";
import { absoluteUrl } from "@/core/lib/siteUrl";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/factions"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const factions = await listIndexableFactions();
    return [
      ...staticRoutes,
      ...factions.map((faction) => ({
        url: absoluteUrl(`/f/${faction.slug}`),
        lastModified: faction.createdAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.error("[sitemap] faction listing failed:", error);
    return staticRoutes;
  }
}
