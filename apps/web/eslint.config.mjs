// Next.js layers its own plugin rules on top of the monorepo's root flat config.
//
// We load the @next/next plugin natively rather than via FlatCompat /
// eslint-config-next. That older path (a) re-registered the @typescript-eslint
// plugin rootConfig already defines — ESLint 9 flat config rejects a plugin
// being defined twice — and (b) swapped in eslint-config-next's parser, which
// broke rootConfig's type-aware rules (consistent-type-imports). TypeScript
// linting comes entirely from rootConfig (typescript-eslint).
import nextPlugin from "@next/eslint-plugin-next";
import rootConfig from "../../eslint.config.js";

const config = [
  ...rootConfig,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    rules: {
      // Server Components legitimately reference unimported globals (process, etc.)
      "no-undef": "off",
    },
  },
];

export default config;
