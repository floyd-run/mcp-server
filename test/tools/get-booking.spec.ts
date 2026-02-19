import { describe, it, expect, vi } from "vitest";
import { handler } from "../../src/tools/get-booking";
import { FloydClient, FloydApiError } from "../../src/floyd-client";
import type { FloydBookingResponse, FloydResourceResponse } from "../../src/types";

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
          buffer: { beforeMs: 300000, afterMs: 600000 },
          active: true,
        },
      ],
      metadata: { customerName: "Jane Doe" },
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
    getBooking: vi.fn().mockResolvedValue(bookingResponse),
    getResource: vi.fn().mockResolvedValue(resourceResponse),
    ...overrides,
  } as unknown as FloydClient;
}

describe("floyd_get_booking", () => {
  it("retrieves booking without allocations by default", async () => {
    const client = mockClient();

    const result = await handler({ bookingId: "bkg_01abc", includeAllocations: false }, client);

    expect(result.isError).toBeUndefined();
    const data = result.structuredContent as Record<string, unknown>;
    const booking = data["booking"] as Record<string, unknown>;
    expect(booking["bookingId"]).toBe("bkg_01abc");
    expect(booking["status"]).toBe("confirmed");
    expect(booking["resourceName"]).toBe("Dr. Smith");
    expect(booking["metadata"]).toEqual({ customerName: "Jane Doe" });
    expect(data["allocations"]).toBeUndefined();
  });

  it("includes allocations when requested", async () => {
    const client = mockClient();

    const result = await handler({ bookingId: "bkg_01abc", includeAllocations: true }, client);

    expect(result.isError).toBeUndefined();
    const data = result.structuredContent as Record<string, unknown>;
    expect(data["allocations"]).toBeDefined();

    const allocations = data["allocations"] as Array<Record<string, unknown>>;
    expect(allocations).toHaveLength(1);
    expect(allocations[0]!["allocationId"]).toBe("alc_01jkl");
    expect(allocations[0]!["resourceId"]).toBe("rsc_01mno");
    expect(allocations[0]!["bufferBeforeMs"]).toBe(300000);
    expect(allocations[0]!["bufferAfterMs"]).toBe(600000);
  });

  it("maps 404 error to not_found", async () => {
    const client = mockClient({
      getBooking: vi.fn().mockRejectedValue(
        new FloydApiError(404, {
          error: { code: "booking.not_found", message: "Not found" },
        }),
      ),
    });

    const result = await handler({ bookingId: "bkg_missing", includeAllocations: false }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("not_found");
  });

  it("handles network errors gracefully", async () => {
    const client = mockClient({
      getBooking: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    });

    const result = await handler({ bookingId: "bkg_01abc", includeAllocations: false }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("upstream_error");
  });

  it("handles missing resource gracefully", async () => {
    const client = mockClient({
      getResource: vi.fn().mockRejectedValue(new Error("not found")),
    });

    const result = await handler({ bookingId: "bkg_01abc", includeAllocations: false }, client);

    expect(result.isError).toBeUndefined();
    const data = result.structuredContent as Record<string, unknown>;
    const booking = data["booking"] as Record<string, unknown>;
    expect(booking["resourceName"]).toBeNull();
  });
});
