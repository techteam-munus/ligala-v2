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

// AMPLIFY_BUILD is set as a branch env var in the Amplify console (Phase 4).
// Gating standalone output on it keeps local Windows `pnpm build` working —
// pnpm's content-addressable store uses symlinks the standalone copy can't
// follow on Windows without admin (vercel/next.js#50833).
const isAmplifyBuild = process.env.AMPLIFY_BUILD === "true";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ligala/ui", "@ligala/shared", "@ligala/auth", "@ligala/db"],
  typedRoutes: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  ...(isAmplifyBuild
    ? {
        // Self-contained Node bundle in `.next/standalone/`. Amplify's SSR
        // deploy step expects a node_modules/next next to server.js, which
        // pnpm's symlinked workspace install doesn't provide — standalone
        // re-materializes only the deps the runtime actually needs.
        output: "standalone" as const,
        // Trace from the workspace root so @ligala/* workspace packages are
        // copied into the standalone bundle.
        outputFileTracingRoot: path.join(__dirname, "../.."),
      }
    : {}),
};

export default withMDX(config);
