import { describe, it, expect, vi } from "vitest";
import { handler } from "../../src/tools/cancel-booking.js";
import { FloydClient, FloydApiError } from "../../src/floyd-client.js";
import type { FloydBookingResponse, FloydResourceResponse } from "../../src/types.js";

function mockClient(overrides: Partial<FloydClient> = {}): FloydClient {
  const bookingResponse: FloydBookingResponse = {
    data: {
      id: "bkg_01abc",
      ledgerId: "ldg_01xyz",
      serviceId: "svc_01def",
      policyVersionId: "pvr_01ghi",
      status: "canceled",
      expiresAt: null,
      allocations: [
        {
          id: "alc_01jkl",
          resourceId: "rsc_01mno",
          startTime: "2026-03-01T14:00:00Z",
          endTime: "2026-03-01T14:30:00Z",
          buffer: { beforeMs: 0, afterMs: 0 },
          active: false,
        },
      ],
      metadata: {},
      createdAt: "2026-03-01T13:50:00Z",
      updatedAt: "2026-03-01T14:00:00Z",
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
    cancelBooking: vi.fn().mockResolvedValue(bookingResponse),
    getResource: vi.fn().mockResolvedValue(resourceResponse),
    ...overrides,
  } as unknown as FloydClient;
}

describe("floyd_cancel_booking", () => {
  it("cancels a booking and returns formatted result", async () => {
    const client = mockClient();

    const result = await handler({ bookingId: "bkg_01abc" }, client);

    expect(result.isError).toBeUndefined();
    const booking = (result.structuredContent as Record<string, unknown>)
      .booking as Record<string, unknown>;
    expect(booking.bookingId).toBe("bkg_01abc");
    expect(booking.status).toBe("canceled");
    expect(booking.resourceName).toBe("Dr. Smith");
    expect(client.cancelBooking).toHaveBeenCalledWith("bkg_01abc", undefined);
  });

  it("passes idempotencyKey to client", async () => {
    const client = mockClient();

    await handler(
      { bookingId: "bkg_01abc", idempotencyKey: "idem_456" },
      client,
    );

    expect(client.cancelBooking).toHaveBeenCalledWith("bkg_01abc", "idem_456");
  });

  it("logs reason server-side without sending to engine", async () => {
    const client = mockClient();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await handler(
      { bookingId: "bkg_01abc", reason: "user changed mind" },
      client,
    );

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("user changed mind"),
    );
    infoSpy.mockRestore();
  });

  it("maps Floyd API error to MCP error", async () => {
    const client = mockClient({
      cancelBooking: vi.fn().mockRejectedValue(
        new FloydApiError(404, {
          error: { code: "booking.not_found", message: "Not found" },
        }),
      ),
    });

    const result = await handler({ bookingId: "bkg_missing" }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.code).toBe("not_found");
  });

  it("handles network errors gracefully", async () => {
    const client = mockClient({
      cancelBooking: vi
        .fn()
        .mockRejectedValue(new TypeError("fetch failed")),
    });

    const result = await handler({ bookingId: "bkg_01abc" }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.code).toBe("upstream_error");
  });
});
