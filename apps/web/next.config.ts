import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [],
  },
});

// Better Auth runs only on the API Lambda (in-VPC; the web Lambda has no DB
// access). The web app exposes /api/auth/* to the browser and rewrites those
// requests straight to the API at the routing layer. A catch-all Route Handler
// at app/api/auth/[...all]/route.ts works locally but is silently dropped by
// Amplify Hosting's SSR routing (non-catch-all handlers like /api/health do
// match) — a rewrite avoids that whole class of issue.
const API_URL = process.env.API_URL ?? "http://localhost:8787";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ligala/ui", "@ligala/shared", "@ligala/auth", "@ligala/db"],
  typedRoutes: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${API_URL}/auth/:path*`,
      },
    ];
  },
};

export default withMDX(config);
