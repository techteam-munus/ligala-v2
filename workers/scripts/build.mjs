// Bundles every worker Lambda handler to `dist/<name>/handler.js`, preserving
// the per-worker folder layout so CDK handlers like "email/handler.handler"
// resolve. Output is consumed by CDK's `lambda.Code.fromAsset("workers/dist")`
// in infra/lib/app-stack.ts.

import { build } from "esbuild";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = resolve(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: {
    js: "import{createRequire}from'module';const require=createRequire(import.meta.url);",
  },
  // AWS SDK is provided by the Lambda runtime; sharp ships as a layer/native
  // binary. Keep both out of the bundle.
  external: ["@aws-sdk/*", "sharp"],
  entryPoints: [
    resolve(root, "paymongo/handler.ts"),
    resolve(root, "paypal/handler.ts"),
    resolve(root, "idmeta/handler.ts"),
    resolve(root, "email/handler.ts"),
    resolve(root, "image/handler.ts"),
  ],
  // outbase = workers root so outputs keep their `<name>/handler.js` layout.
  outbase: root,
  outdir: dist,
});

// Lambda's Node runtime treats .js as CommonJS unless a package.json in the
// deployed asset declares `"type": "module"`. The parent workers/package.json
// is NOT part of the `workers/dist` asset, so without this the ESM bundles
// fail at INIT with "Cannot use import statement outside a module".
writeFileSync(resolve(dist, "package.json"), '{"type":"module"}\n');

console.log("[workers/build] dist/{paymongo,paypal,idmeta,email,image}/handler.js + package.json ready");
