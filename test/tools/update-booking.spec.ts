import { describe, it, expect, vi } from "vitest";
import { handler } from "../../src/tools/update-booking";
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
      expiresAt: "2026-03-01T10:15:00Z",
      allocations: [
        {
          id: "alc_01jkl",
          resourceId: "rsc_01mno",
          startTime: "2026-03-01T10:00:00Z",
          endTime: "2026-03-01T11:00:00Z",
          buffer: { beforeMs: 0, afterMs: 0 },
          active: true,
        },
      ],
      metadata: { customerName: "Alice", partySize: 2 },
      createdAt: "2026-03-01T09:50:00Z",
      updatedAt: "2026-03-01T10:00:00Z",
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
    updateBookingMetadata: vi.fn().mockResolvedValue(bookingResponse),
    getResource: vi.fn().mockResolvedValue(resourceResponse),
    ...overrides,
  } as unknown as FloydClient;
}

describe("floyd_update_booking", () => {
  it("updates metadata and returns formatted result", async () => {
    const client = mockClient();

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        metadata: { customerName: "Alice", partySize: 2 },
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    const data = result.structuredContent as Record<string, unknown>;
    const booking = data["booking"] as Record<string, unknown>;
    expect(booking["bookingId"]).toBe("bkg_01abc");
    expect(booking["metadata"]).toEqual({ customerName: "Alice", partySize: 2 });
    expect(booking["resourceName"]).toBe("Dr. Smith");
  });

  it("calls updateBookingMetadata with correct arguments", async () => {
    const client = mockClient();
    const metadata = { notes: "Needs wheelchair accessible room" };

    await handler({ bookingId: "bkg_01abc", metadata }, client);

    expect(client.updateBookingMetadata).toHaveBeenCalledWith("bkg_01abc", metadata);
  });

  it("maps 404 error for non-existent booking", async () => {
    const client = mockClient({
      updateBookingMetadata: vi.fn().mockRejectedValue(
        new FloydApiError(404, {
          error: { code: "not_found", message: "Booking not found" },
        }),
      ),
    });

    const result = await handler(
      {
        bookingId: "bkg_missing",
        metadata: { foo: "bar" },
      },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("not_found");
  });

  it("maps 422 error for invalid input", async () => {
    const client = mockClient({
      updateBookingMetadata: vi.fn().mockRejectedValue(
        new FloydApiError(422, {
          error: { code: "validation_error", message: "metadata is required" },
        }),
      ),
    });

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        metadata: {},
      },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("invalid_input");
  });

  it("handles network errors gracefully", async () => {
    const client = mockClient({
      updateBookingMetadata: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    });

    const result = await handler(
      {
        bookingId: "bkg_01abc",
        metadata: { foo: "bar" },
      },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("upstream_error");
  });
});
