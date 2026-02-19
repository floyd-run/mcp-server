import { describe, it, expect, vi } from "vitest";
import { handler } from "../../src/tools/confirm-booking.js";
import { FloydClient, FloydApiError } from "../../src/floyd-client.js";
import type { FloydBookingResponse, FloydResourceResponse } from "../../src/types.js";

function mockClient(overrides: Partial<FloydClient> = {}): FloydClient {
  const bookingResponse: FloydBookingResponse = {
    data: {
      id: "bkg_01abc",
      ledgerId: "ldg_01xyz",
      serviceId: "svc_01def",
      policyVersionId: "pvr_01ghi",
      status: "confirmed",
      expiresAt: null,
      allocations: [
        {
          id: "alc_01jkl",
          resourceId: "rsc_01mno",
          startTime: "2026-03-01T14:00:00Z",
          endTime: "2026-03-01T14:30:00Z",
          buffer: { beforeMs: 0, afterMs: 0 },
          active: true,
        },
      ],
      metadata: {},
      createdAt: "2026-03-01T13:50:00Z",
      updatedAt: "2026-03-01T13:51:00Z",
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
    confirmBooking: vi.fn().mockResolvedValue(bookingResponse),
    getResource: vi.fn().mockResolvedValue(resourceResponse),
    ...overrides,
  } as unknown as FloydClient;
}

describe("floyd_confirm_booking", () => {
  it("confirms a booking when userConfirmed is true", async () => {
    const client = mockClient();

    const result = await handler(
      { bookingId: "bkg_01abc", userConfirmed: true },
      client,
    );

    expect(result.isError).toBeUndefined();
    const booking = (result.structuredContent as Record<string, unknown>).booking as Record<string, unknown>;
    expect(booking.status).toBe("confirmed");
    expect(booking.expiresAt).toBeNull();
    expect(client.confirmBooking).toHaveBeenCalledWith("bkg_01abc", undefined);
  });

  it("returns error when userConfirmed is false", async () => {
    const client = mockClient();

    const result = await handler(
      { bookingId: "bkg_01abc", userConfirmed: false },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.code).toBe("user_confirmation_required");
    expect(client.confirmBooking).not.toHaveBeenCalled();
  });

  it("passes idempotencyKey to client", async () => {
    const client = mockClient();

    await handler(
      {
        bookingId: "bkg_01abc",
        userConfirmed: true,
        idempotencyKey: "idem_123",
      },
      client,
    );

    expect(client.confirmBooking).toHaveBeenCalledWith("bkg_01abc", "idem_123");
  });

  it("maps hold_expired error", async () => {
    const client = mockClient({
      confirmBooking: vi.fn().mockRejectedValue(
        new FloydApiError(409, {
          error: {
            code: "booking.invalid_transition",
            message: "Cannot confirm",
          },
        }),
      ),
    });

    const result = await handler(
      { bookingId: "bkg_01abc", userConfirmed: true },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured.code).toBe("hold_expired");
  });
});
