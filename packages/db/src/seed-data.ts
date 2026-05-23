import type * as schema from "./schema/index";

// Reference data for the dev/staging environments. Stable slug-style IDs keep
// re-runs idempotent and FKs portable across environments.
//
// Shared between the local `pnpm db:seed` script (scripts/seed-reference.ts)
// and the deployed migrate Lambda (apps/api/src/migrate-lambda.ts). Keeping a
// single source means production-shaped envs always seed the same rows.

export const ibpChapters: (typeof schema.ibpChapters.$inferInsert)[] = [
  { id: "manila", name: "Manila", region: "NCR", city: "Manila", sortOrder: 1 },
  { id: "quezon-city", name: "Quezon City", region: "NCR", city: "Quezon City", sortOrder: 2 },
  { id: "makati", name: "Makati", region: "NCR", city: "Makati", sortOrder: 3 },
  { id: "pasig", name: "Pasig", region: "NCR", city: "Pasig", sortOrder: 4 },
  { id: "caloocan", name: "Caloocan", region: "NCR", city: "Caloocan", sortOrder: 5 },
  { id: "cebu-city", name: "Cebu City", region: "Region VII", city: "Cebu City", sortOrder: 10 },
  { id: "mandaue", name: "Mandaue", region: "Region VII", city: "Mandaue", sortOrder: 11 },
  { id: "davao-city", name: "Davao City", region: "Region XI", city: "Davao City", sortOrder: 20 },
  { id: "iloilo-city", name: "Iloilo City", region: "Region VI", city: "Iloilo City", sortOrder: 30 },
  { id: "bacolod-city", name: "Bacolod City", region: "Region VI", city: "Bacolod City", sortOrder: 31 },
  { id: "baguio", name: "Baguio", region: "CAR", city: "Baguio", sortOrder: 40 },
  { id: "cagayan-de-oro", name: "Cagayan de Oro", region: "Region X", city: "Cagayan de Oro", sortOrder: 50 },
  { id: "zamboanga-city", name: "Zamboanga City", region: "Region IX", city: "Zamboanga City", sortOrder: 60 },
];

export const practiceAreas: (typeof schema.practiceAreas.$inferInsert)[] = [
  { id: "civil", name: "Civil Law", category: "General", sortOrder: 1 },
  { id: "criminal", name: "Criminal Law", category: "General", sortOrder: 2 },
  { id: "family", name: "Family Law", category: "General", sortOrder: 3 },
  { id: "labor", name: "Labor Law", category: "General", sortOrder: 4 },
  { id: "tax", name: "Taxation", category: "Commercial", sortOrder: 10 },
  { id: "corporate", name: "Corporate Law", category: "Commercial", sortOrder: 11 },
  { id: "banking-finance", name: "Banking & Finance", category: "Commercial", sortOrder: 12 },
  { id: "intellectual-property", name: "Intellectual Property", category: "Commercial", sortOrder: 13 },
  { id: "real-estate", name: "Real Estate & Property", category: "Commercial", sortOrder: 14 },
  { id: "immigration", name: "Immigration", category: "Specialty", sortOrder: 20 },
  { id: "estate-planning", name: "Estate Planning", category: "Specialty", sortOrder: 21 },
  { id: "election", name: "Election Law", category: "Specialty", sortOrder: 22 },
  { id: "maritime", name: "Maritime Law", category: "Specialty", sortOrder: 23 },
  { id: "environment", name: "Environmental Law", category: "Specialty", sortOrder: 24 },
  { id: "litigation", name: "Litigation", category: "Practice", sortOrder: 30 },
];

export const jurisdictions: (typeof schema.jurisdictions.$inferInsert)[] = [
  { id: "supreme-court", name: "Supreme Court", level: "Supreme", sortOrder: 1 },
  { id: "court-of-appeals", name: "Court of Appeals", level: "Appellate", sortOrder: 2 },
  { id: "sandiganbayan", name: "Sandiganbayan", level: "Appellate", sortOrder: 3 },
  { id: "court-of-tax-appeals", name: "Court of Tax Appeals", level: "Appellate", sortOrder: 4 },
  { id: "rtc", name: "Regional Trial Court", level: "Trial", sortOrder: 10 },
  { id: "metc", name: "Metropolitan Trial Court", level: "Trial", sortOrder: 11 },
  { id: "mtcc", name: "Municipal Trial Court in Cities", level: "Trial", sortOrder: 12 },
  { id: "mtc", name: "Municipal Trial Court", level: "Trial", sortOrder: 13 },
  { id: "sharia-district", name: "Sharia District Court", level: "Trial", sortOrder: 20 },
  { id: "sharia-circuit", name: "Sharia Circuit Court", level: "Trial", sortOrder: 21 },
];
