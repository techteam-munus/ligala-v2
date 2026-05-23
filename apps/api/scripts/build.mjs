// Bundles both Lambda handlers (`lambda.ts` + `migrate-lambda.ts`) and copies
// the Drizzle migrations folder into `dist/` so `migrate-lambda` can reference
// them via path.join(__dirname, "drizzle"). Output is consumed by CDK's
// `lambda.Code.fromAsset("apps/api/dist")` in infra/lib/app-stack.ts.

import { build } from "esbuild";
import { cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");
const drizzleSrc = resolve(root, "../../packages/db/drizzle");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: {
    js: "import{createRequire}from'module';const require=createRequire(import.meta.url);",
  },
  // AWS SDK is provided by the Lambda runtime; don't pull it into the bundle.
  external: ["@aws-sdk/*"],
};

await build({
  ...common,
  entryPoints: [resolve(root, "src/lambda.ts")],
  outfile: resolve(dist, "lambda.js"),
});

await build({
  ...common,
  entryPoints: [resolve(root, "src/migrate-lambda.ts")],
  outfile: resolve(dist, "migrate-lambda.js"),
});

cpSync(drizzleSrc, resolve(dist, "drizzle"), { recursive: true });

// Lambda Node runtime treats .js as CommonJS unless a package.json in the
// asset declares `"type": "module"`. The bundles are ESM (banner + format),
// so this one-liner makes the runtime load them correctly.
writeFileSync(resolve(dist, "package.json"), '{"type":"module"}\n');

console.log("[api/build] dist/{lambda,migrate-lambda}.js + drizzle/ ready");
