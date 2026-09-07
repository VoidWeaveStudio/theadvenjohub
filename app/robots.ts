// app/robots.ts
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/core/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/profile", "/auth/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
