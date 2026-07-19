import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: "/expo-ci-doctor",
  assetPrefix: "/expo-ci-doctor",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
