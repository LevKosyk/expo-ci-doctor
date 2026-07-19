import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const siteUrl = "https://levkosyk.github.io/expo-ci-doctor";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/docs/", "/errors/"].map((path) => ({
    url: `${siteUrl}${path || "/"}`,
    lastModified: new Date("2026-07-19"),
    changeFrequency: "yearly",
    priority: path ? 0.7 : 1,
  }));
}
