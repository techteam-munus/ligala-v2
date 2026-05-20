import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ligala/ui", "@ligala/shared", "@ligala/auth", "@ligala/db"],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
