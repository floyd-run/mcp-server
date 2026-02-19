import { describe, it, expect, vi } from "vitest";
import { handler } from "../../src/tools/hold-booking";
import { sign } from "../../src/slot-id";
import { FloydClient, FloydApiError } from "../../src/floyd-client";
import type { FloydBookingResponse, FloydResourceResponse } from "../../src/types";

const API_KEY = "floyd_live_test_key";

function mockClient(overrides: Partial<FloydClient> = {}): FloydClient {
  const bookingResponse: FloydBookingResponse = {
    data: {
      id: "bkg_01abc",
      ledgerId: "ldg_01xyz",
      serviceId: "svc_01def",
      policyVersionId: "pvr_01ghi",
      status: "hold",
      expiresAt: "2026-03-01T14:15:00Z",
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
      updatedAt: "2026-03-01T13:50:00Z",
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
    createBooking: vi.fn().mockResolvedValue(bookingResponse),
    getResource: vi.fn().mockResolvedValue(resourceResponse),
    ...overrides,
  } as unknown as FloydClient;
}

describe("floyd_hold_booking", () => {
  it("holds a booking using slotId", async () => {
    const client = mockClient();
    const slotId = sign(
      {
        v: 1,
        svc: "svc_01def",
        rsc: "rsc_01mno",
        st: "2026-03-01T14:00:00Z",
        et: "2026-03-01T14:30:00Z",
        tz: "America/New_York",
      },
      API_KEY,
    );

    const result = await handler({ slotId }, client, API_KEY);

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toBeDefined();
    const data = result.structuredContent as Record<string, unknown>;
    const booking = data["booking"] as Record<string, unknown>;
    expect(booking["bookingId"]).toBe("bkg_01abc");
    expect(booking["status"]).toBe("hold");
    expect(booking["resourceName"]).toBe("Dr. Smith");

    expect(client.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: "svc_01def",
        resourceId: "rsc_01mno",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T14:30:00Z",
      }),
    );
  });

  it("holds a booking using explicit fields", async () => {
    const client = mockClient();

    const result = await handler(
      {
        serviceId: "svc_01def",
        resourceId: "rsc_01mno",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T14:30:00Z",
      },
      client,
      API_KEY,
    );

    expect(result.isError).toBeUndefined();
    expect(client.createBooking).toHaveBeenCalled();
  });

  it("returns error for invalid slotId", async () => {
    const client = mockClient();

    const result = await handler({ slotId: "slot_v1.tampered.signature" }, client, API_KEY);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("invalid_input");
  });

  it("returns error when explicit fields are incomplete", async () => {
    const client = mockClient();

    const result = await handler({ serviceId: "svc_01def" }, client, API_KEY);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("invalid_input");
  });

  it("maps Floyd API error to MCP error", async () => {
    const client = mockClient({
      createBooking: vi.fn().mockRejectedValue(
        new FloydApiError(409, {
          error: { code: "allocation.overlap", message: "Overlap" },
        }),
      ),
    });

    const result = await handler(
      {
        serviceId: "svc_01def",
        resourceId: "rsc_01mno",
        startTime: "2026-03-01T14:00:00Z",
        endTime: "2026-03-01T14:30:00Z",
      },
      client,
      API_KEY,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured["code"]).toBe("slot_unavailable");
  });
});
