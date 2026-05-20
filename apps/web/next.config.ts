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
};

export default withMDX(config);
