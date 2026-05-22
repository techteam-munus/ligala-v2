import path from "node:path";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [],
  },
});

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ligala/ui", "@ligala/shared", "@ligala/auth", "@ligala/db"],
  typedRoutes: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Standalone output is a self-contained Node bundle in `.next/standalone/`
  // with the only deps the runtime actually needs. Required for Amplify SSR
  // hosting in a pnpm monorepo — Amplify's deploy step looks for
  // node_modules/next, which pnpm symlinks into the workspace root and the
  // standalone bundle re-materializes correctly.
  output: "standalone",
  // For monorepos, point Next's file-trace at the workspace root so it picks
  // up workspace packages (@ligala/*) into the standalone bundle.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default withMDX(config);
