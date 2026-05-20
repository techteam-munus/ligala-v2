// Side-effect-only module. MUST be the first thing imported in `dev.ts`
// so its top-level statements run before any sibling imports that read
// process.env at module-evaluation time (e.g. @ligala/auth, @ligala/db).
// ESM hoists imports above top-level statements within a single module, but
// imports themselves are evaluated in source order — so a bare `import "./load-env"`
// at the top of dev.ts guarantees this runs first.
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
