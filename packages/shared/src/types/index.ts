// Domain types and enums shared across the monorepo.
export type Role = "client" | "lawyer" | "admin";
export type CaseType = "paid" | "probono";
export type CaseStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "declined"
  | "in_progress"
  | "closed";
export type InvoiceStatus = "draft" | "issued" | "paid" | "void";
