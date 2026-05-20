// Next.js layers its own plugin rules on top of the monorepo's root flat config.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import rootConfig from "../../eslint.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...rootConfig,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Server Components legitimately reference unimported globals (process, etc.)
      "no-undef": "off",
    },
  },
];

export default config;
