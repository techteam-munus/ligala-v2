import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyCaseStatus } from "./case-emails";

// Mock @ligala/db — provide db().query.user.findFirst
vi.mock("@ligala/db", () => {
  const findFirst = vi.fn();
  return {
    db: vi.fn(() => ({
      query: {
        user: { findFirst },
      },
    })),
    schema: {
      user: { id: "user.id" },
    },
  };
});

// Mock @ligala/email
vi.mock("@ligala/email", () => ({
  dispatchEmail: vi.fn(),
}));

// Mock ./env
vi.mock("./env", () => ({
  env: vi.fn(() => ({
    BETTER_AUTH_URL: "https://app.example.com",
  })),
}));

import { db } from "@ligala/db";
import { dispatchEmail } from "@ligala/email";

const mockDispatch = vi.mocked(dispatchEmail);

function mockFindFirst() {
  // db() is called fresh each time; grab the inner mock from the first call result.
  return vi.mocked(db().query.user.findFirst);
}

const BASE_ARGS = {
  activityId: "act-123",
  recipientUserId: "user-456",
  caseId: "case-abc",
  caseRef: "Case abc",
  actorName: "John Smith",
} as const;

// Cast to unknown so we can use partial objects in mocks without satisfying the
// full Drizzle-inferred user shape (tests only care about email + name).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyUser = any;
const RECIPIENT: AnyUser = { email: "user@example.com", name: "Jane Doe" };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: findFirst resolves to a recipient with email + name.
  mockFindFirst().mockResolvedValue(RECIPIENT);
});

describe("notifyCaseStatus", () => {
  it("calls dispatchEmail with kind:case_status and correct dedupeKey", async () => {
    await notifyCaseStatus({
      ...BASE_ARGS,
      recipientPortal: "client",
      event: "case_created",
    });
    expect(mockDispatch).toHaveBeenCalledOnce();
    const call = mockDispatch.mock.calls[0]?.[0];
    expect(call?.kind).toBe("case_status");
    expect(call?.dedupeKey).toBe("case_status:act-123");
  });

  it("uses lawyer URL when recipientPortal is lawyer", async () => {
    await notifyCaseStatus({
      ...BASE_ARGS,
      recipientPortal: "lawyer",
      event: "case_created",
    });
    const call = mockDispatch.mock.calls[0]?.[0];
    expect(call?.kind).toBe("case_status");
    if (call?.kind === "case_status") {
      expect(call.data.caseUrl).toBe(
        "https://app.example.com/lawyer/cases/case-abc",
      );
    }
  });

  it("uses client URL when recipientPortal is client", async () => {
    await notifyCaseStatus({
      ...BASE_ARGS,
      recipientPortal: "client",
      event: "case_closed",
    });
    const call = mockDispatch.mock.calls[0]?.[0];
    expect(call?.kind).toBe("case_status");
    if (call?.kind === "case_status") {
      expect(call.data.caseUrl).toBe(
        "https://app.example.com/cases/case-abc",
      );
    }
  });

  it("passes event, actorName, caseRef, and recipientName through to data", async () => {
    await notifyCaseStatus({
      ...BASE_ARGS,
      recipientPortal: "client",
      event: "engagement_sent",
    });
    const call = mockDispatch.mock.calls[0]?.[0];
    expect(call?.kind).toBe("case_status");
    if (call?.kind === "case_status") {
      expect(call.data.event).toBe("engagement_sent");
      expect(call.data.actorName).toBe("John Smith");
      expect(call.data.caseRef).toBe("Case abc");
      // recipientName comes from the looked-up user, not args
      expect(call.data.recipientName).toBe("Jane Doe");
    }
    expect(call?.to).toBe("user@example.com");
  });

  it("does NOT call dispatchEmail when recipient has an empty email", async () => {
    // email is notNull in the DB schema, but an empty string is falsy —
    // guard covers it the same way it covers undefined.
    const noEmailUser: AnyUser = { email: "", name: "No Email" };
    mockFindFirst().mockResolvedValue(noEmailUser);
    await notifyCaseStatus({
      ...BASE_ARGS,
      recipientPortal: "client",
      event: "case_accepted",
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("does NOT call dispatchEmail when findFirst returns undefined", async () => {
    mockFindFirst().mockResolvedValue(undefined);
    await notifyCaseStatus({
      ...BASE_ARGS,
      recipientPortal: "lawyer",
      event: "engagement_signed",
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("does NOT throw when findFirst rejects (error swallowed)", async () => {
    mockFindFirst().mockRejectedValue(new Error("DB connection lost"));
    await expect(
      notifyCaseStatus({
        ...BASE_ARGS,
        recipientPortal: "lawyer",
        event: "engagement_declined",
      }),
    ).resolves.toBeUndefined();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("does NOT throw when dispatchEmail rejects (error swallowed)", async () => {
    mockDispatch.mockRejectedValueOnce(new Error("SQS unavailable"));
    await expect(
      notifyCaseStatus({
        ...BASE_ARGS,
        recipientPortal: "lawyer",
        event: "engagement_signed",
      }),
    ).resolves.toBeUndefined();
  });

  it("no-ops immediately when recipientUserId is null", async () => {
    await notifyCaseStatus({
      ...BASE_ARGS,
      recipientUserId: null,
      recipientPortal: "client",
      event: "case_created",
    });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockFindFirst()).not.toHaveBeenCalled();
  });
});
