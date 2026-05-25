import { describe, it, expect } from "vitest";
import { renderEmail } from "./render";

describe("renderEmail", () => {
  it("renders auth_verify with subject + the code in html/text", async () => {
    const out = await renderEmail("auth_verify", { code: "123456" });
    expect(out.subject.length).toBeGreaterThan(0);
    expect(out.html).toContain("123456");
    expect(out.text).toContain("123456");
  });
  it("renders every kind without throwing", async () => {
    const samples = {
      auth_verify: { code: "654321" },
      auth_reset: { name: "A", resetUrl: "https://x/r" },
      invoice_sent: { clientName: "A", lawyerName: "L", invoiceNumber: "INV-1", amountFormatted: "P5,500.00", currency: "PHP", invoiceUrl: "https://x/i" },
      payment_receipt: { clientName: "A", invoiceNumber: "INV-1", amountPaidFormatted: "P5,500.00", currency: "PHP", paidAtFormatted: "May 25, 2026", invoiceUrl: "https://x/i" },
      case_status: { recipientName: "A", caseRef: "Case #1", event: "engagement_sent", actorName: "L", caseUrl: "https://x/c" },
      subscription_receipt: { lawyerName: "L", invoiceNumber: "INV-2", amountFormatted: "P999.00", currency: "PHP", periodEndFormatted: "Jul 24, 2026", subscriptionUrl: "https://x/s" },
    } as const;
    for (const [kind, data] of Object.entries(samples)) {
      const out = await renderEmail(kind as keyof typeof samples, data as never);
      expect(out.html.length).toBeGreaterThan(0);
      expect(out.subject.length).toBeGreaterThan(0);
    }
  });
});
