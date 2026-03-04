import { describe, it, expect, vi } from "vitest";
import { handler } from "../../src/tools/reschedule-booking";
import { FloydClient, FloydApiError } from "../../src/floyd-client";
import type { FloydBookingResponse, FloydResourceResponse } from "../../src/types";

function mockClient(overrides: Partial<FloydClient> = {}): FloydClient {
  const bookingResponse: FloydBookingResponse = {
    data: {
      id: "bkg_01abc",
      ledgerId: "ldg_01xyz",
      serviceId: "svc_01def",
      policyVersionId: "pvr_01ghi",
      status: "hold",
      expiresAt: "2026-03-01T15:15:00Z",
      allocations: [
        {
          id: "alc_01old",
          resourceId: "rsc_01mno",
          startTime: "2026-03-01T10:00:00Z",
          endTime: "2026-03-01T11:00:00Z",
          buffer: { beforeMs: 0, afterMs: 0 },
          active: false,
        },
        {
          id: "alc_01new",
          resourceId: "rsc_01mno",
          startTime: "2026-03-01T14:00:00Z",
          endTime: "2026-03-01T15:00:00Z",
          buffer: { beforeMs: 0, afterMs: 0 },
          active: true,
        },
      ],
      metadata: {},
      createdAt: "2026-03-01T09:50:00Z",
      updatedAt: "2026-03-01T15:00:00Z",
    },
  };

  const resourceResponse: FloydResourceResponse = {
    data: {
      id: "rsc_01mno",
      ledgerId: "ldg_01xyz",
      name: "Dr. Smith",
      timezone: "America/New_York",
      metadata: {},
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  };

  return {
    rescheduleBooking: vi.fn().mockResolvedValue(bookingResponse),
    getResource: vi.fn().mockResolvedValue(resourceResponse),
    ...overrides,
  } as unknown as FloydClient;
}

describe("floyd_reschedule_booking", () => {
  it("reschedules and returns formatted result with new times", async () => {
    const client = mockClient();

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T15:00:00Z",
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    const data = result.structuredContent as Record<string, unknown>;
    const booking = data["booking"] as Record<string, unknown>;
    expect(booking["bookingId"]).toBe("bkg_01abc");
    expect(booking["status"]).toBe("hold");
    expect(booking["startTime"]).toBe("2026-03-01T14:00:00.000Z");
    expect(booking["endTime"]).toBe("2026-03-01T15:00:00.000Z");
    expect(booking["resourceName"]).toBe("Dr. Smith");
  });

  it("picks the active allocation, not the inactive one", async () => {
    const client = mockClient();

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T15:00:00Z",
      },
      client,
    );

    const data = result.structuredContent as Record<string, unknown>;
    const booking = data["booking"] as Record<string, unknown>;
    // Should use the active allocation times (14:00-15:00), not the old ones (10:00-11:00)
    expect(booking["startTime"]).toBe("2026-03-01T14:00:00.000Z");
    expect(booking["endTime"]).toBe("2026-03-01T15:00:00.000Z");
  });

  it("passes idempotencyKey to client", async () => {
    const client = mockClient();

    await handler(
      {
        bookingId: "bkg_01abc",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T15:00:00Z",
        idempotencyKey: "idem_789",
      },
      client,
    );

    expect(client.rescheduleBooking).toHaveBeenCalledWith({
      bookingId: "bkg_01abc",
      startTime: "2026-03-01T14:00:00Z",
      endTime: "2026-03-01T15:00:00Z",
      idempotencyKey: "idem_789",
    });
  });

  it("maps policy.rejected error", async () => {
    const client = mockClient({
      rescheduleBooking: vi.fn().mockRejectedValue(
        new FloydApiError(409, {
          error: {
            code: "policy.rejected",
            message: "Rejected",
            details: { code: "policy.closed" },
          },
        }),
      ),
    });

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        startTime: "2026-03-01T02:00:00Z",
        endTime: "2026-03-01T03:00:00Z",
      },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("policy_rejected");
  });

  it("maps allocation.overlap error", async () => {
    const client = mockClient({
      rescheduleBooking: vi.fn().mockRejectedValue(
        new FloydApiError(409, {
          error: { code: "allocation.overlap", message: "Overlap" },
        }),
      ),
    });

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T15:00:00Z",
      },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("slot_unavailable");
  });

  it("maps hold_expired error", async () => {
    const client = mockClient({
      rescheduleBooking: vi.fn().mockRejectedValue(
        new FloydApiError(409, {
          error: {
            code: "booking.hold_expired",
            message: "Hold expired",
          },
        }),
      ),
    });

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T15:00:00Z",
      },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("hold_expired");
  });

  it("handles network errors gracefully", async () => {
    const client = mockClient({
      rescheduleBooking: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    });

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T15:00:00Z",
      },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("upstream_error");
  });
});
