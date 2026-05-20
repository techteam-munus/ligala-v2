// Aggregates added per phase. Each file is the single source of truth for one
// bounded context; reads here are flat re-exports so the drizzle client sees
// everything as one schema map.
//
//   Phase 1 — auth (Better Auth: user, session, account, verification + role)
//   Phase 2 — lawyers, kyc, offices, reference (ibp/practice/jurisdictions)
//   Phase 3 — clients
//   Phase 4 — cases, engagements
//   Phase 5 — billing
//   Phase 6 — referrals

export * from "./auth";
export * from "./reference";
export * from "./lawyers";
export * from "./kyc";
export * from "./offices";
export * from "./clients";
