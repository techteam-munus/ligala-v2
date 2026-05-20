// Stable error codes returned by the api and understood by the web app.
// Add new codes here and never reuse a retired one.
export const ErrorCode = {
  Unauthorized: "unauthorized",
  Forbidden: "forbidden",
  NotFound: "not_found",
  Conflict: "conflict",
  Validation: "validation_error",
  RateLimited: "rate_limited",
  PaymentFailed: "payment_failed",
  KycRequired: "kyc_required",
  Internal: "internal_error",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}
