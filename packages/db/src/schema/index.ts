// Phase 1 adds Better Auth tables (users, accounts, sessions, verification_tokens).
// Subsequent phases add aggregates per domain:
//   Phase 2 — lawyers, kyc, offices
//   Phase 3 — clients
//   Phase 4 — cases, engagements
//   Phase 5 — billing
//   Phase 6 — referrals
//   Phase 2/6 — reference data (ibp_chapters, practice_areas, jurisdictions)
//
// Each aggregate lives in its own file and is re-exported here.

export {};
