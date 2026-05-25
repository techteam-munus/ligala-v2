/** Money and date formatting helpers for transactional email data assembly. */

export function formatPhp(cents: number): string {
  return "₱" + (cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
