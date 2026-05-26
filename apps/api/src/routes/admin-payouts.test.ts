import { describe, it, expect, vi, beforeEach } from "vitest";

const { rows, mockSelectChain, mockDb } = vi.hoisted(() => {
  const rows = [
    {
      payout: { id: "po_1", lawyerId: "law_1", amountCents: 60000, feeCents: 1000, netCents: 59000, status: "succeeded", currency: "PHP", requestedAt: new Date(), completedAt: new Date(), destinationSnapshot: { type: "gcash" } },
      lawyerName: "Atty. Juan", lawyerEmail: "juan@x.test",
    },
  ];
  // db().select().from().leftJoin().where().orderBy()  → rows
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const leftJoin = vi.fn().mockReturnValue({ where, orderBy });
  const from = vi.fn().mockReturnValue({ leftJoin });
  const mockSelectChain = { from };
  const mockDb = { select: vi.fn().mockReturnValue(mockSelectChain) };
  return { rows, mockSelectChain, mockDb };
});

vi.mock("@ligala/db", () => ({
  db: () => mockDb,
  schema: { payouts: { lawyerId: "lawyer_id", status: "status", createdAt: "created_at" }, user: { id: "id", name: "name", email: "email" } },
}));
vi.mock("../middleware/session", () => ({
  requireRole: () => async (c: any, next: any) => {
    c.set("user", { id: "admin_1", role: "admin" });
    await next();
  },
  requireSession: async (c: any, next: any) => next(),
}));
vi.mock("../lib/env", () => ({ env: () => ({}) }));
vi.mock("../lib/paymongo", () => ({ createBatchTransfer: vi.fn(), PaymongoApiError: class {}, PaymongoUnreachableError: class {} }));
vi.mock("../lib/transfer-webhook", () => ({ applyTransferWebhook: vi.fn() }));

import { adminPayouts } from "./payouts";

describe("adminPayouts GET /", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns payouts with lawyer info", async () => {
    const res = await adminPayouts.request("/", { method: "GET" });
    expect(res.status).toBe(200);
    const body = await res.json() as { items: Array<Record<string, unknown>> };
    expect(body.items[0]).toMatchObject({ id: "po_1", lawyer: { name: "Atty. Juan" } });
  });
});
