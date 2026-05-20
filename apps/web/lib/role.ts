// Better Auth's additionalFields adds `role` as `string | null | undefined` at
// the type level (defaults only fire at insert time, not in TS). We narrow here
// instead of fighting Better Auth's types at every call site.
export function roleHome(role: string | null | undefined): string {
  switch (role) {
    case "lawyer":
      return "/lawyer/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "client":
    default:
      return "/dashboard";
  }
}
