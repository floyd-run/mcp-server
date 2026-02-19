import { describe, it, expect, vi } from "vitest";
import { handler } from "../../src/tools/get-available-slots";
import { verify } from "../../src/slot-id";
import { FloydClient } from "../../src/floyd-client";
import type { FloydSlotsResponse, FloydResourceResponse } from "../../src/types";

const API_KEY = "floyd_live_test_key";

function mockClient(overrides: Partial<FloydClient> = {}): FloydClient {
  const slotsResponse: FloydSlotsResponse = {
    data: [
      {
        resourceId: "rsc_01mno",
        timezone: "America/New_York",
        slots: [
          {
            startTime: "2026-03-01T14:00:00Z",
            endTime: "2026-03-01T14:30:00Z",
            status: "available",
          },
          {
            startTime: "2026-03-01T15:00:00Z",
            endTime: "2026-03-01T15:30:00Z",
            status: "available",
          },
          {
            startTime: "2026-03-01T16:00:00Z",
            endTime: "2026-03-01T16:30:00Z",
            status: "unavailable",
          },
        ],
      },
    ],
    meta: { serverTime: "2026-03-01T13:00:00Z" },
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
    getAvailableSlots: vi.fn().mockResolvedValue(slotsResponse),
    getResource: vi.fn().mockResolvedValue(resourceResponse),
    ...overrides,
  } as unknown as FloydClient;
}

describe("floyd_get_available_slots", () => {
  it("returns available slots with signed slotIds", async () => {
    const client = mockClient();

    const result = await handler(
      {
        serviceId: "svc_01def",
        startTime: "2026-03-01T00:00:00Z",
        endTime: "2026-03-02T00:00:00Z",
        durationMinutes: 30,
        limit: 10,
      },
      client,
      API_KEY,
    );

    expect(result.isError).toBeUndefined();
    const data = result.structuredContent as Record<string, unknown>;
    const slots = data["slots"] as Array<Record<string, unknown>>;

    // Only 2 available (third is unavailable)
    expect(slots).toHaveLength(2);

    // Verify slotId is signed and verifiable
    const slotId = slots[0]!["slotId"] as string;
    expect(slotId).toMatch(/^slot_v1\./);
    const payload = verify(slotId, API_KEY);
    expect(payload).not.toBeNull();
    expect(payload!.svc).toBe("svc_01def");
    expect(payload!.rsc).toBe("rsc_01mno");

    // Check local time conversion
    expect(slots[0]!["resourceName"]).toBe("Dr. Smith");
    expect(slots[0]!["timezone"]).toBe("America/New_York");
    expect(slots[0]!["startTimeLocal"]).toContain("2026-03-01T09:00:00");
  });

  it("respects limit parameter", async () => {
    const client = mockClient();

    const result = await handler(
      {
        serviceId: "svc_01def",
        startTime: "2026-03-01T00:00:00Z",
        endTime: "2026-03-02T00:00:00Z",
        durationMinutes: 30,
        limit: 1,
      },
      client,
      API_KEY,
    );

    const data = result.structuredContent as Record<string, unknown>;
    const slots = data["slots"] as Array<Record<string, unknown>>;
    expect(slots).toHaveLength(1);
  });

  it("passes durationMs to Floyd API", async () => {
    const client = mockClient();

    await handler(
      {
        serviceId: "svc_01def",
        startTime: "2026-03-01T00:00:00Z",
        endTime: "2026-03-02T00:00:00Z",
        durationMinutes: 60,
        limit: 10,
      },
      client,
      API_KEY,
    );

    expect(client.getAvailableSlots).toHaveBeenCalledWith(
      "svc_01def",
      "2026-03-01T00:00:00Z",
      "2026-03-02T00:00:00Z",
      3_600_000, // 60 * 60000
    );
  });

  it("handles resource fetch failure gracefully", async () => {
    const client = mockClient({
      getResource: vi.fn().mockRejectedValue(new Error("fail")),
    });

    const result = await handler(
      {
        serviceId: "svc_01def",
        startTime: "2026-03-01T00:00:00Z",
        endTime: "2026-03-02T00:00:00Z",
        durationMinutes: 30,
        limit: 10,
      },
      client,
      API_KEY,
    );

    expect(result.isError).toBeUndefined();
    const data = result.structuredContent as Record<string, unknown>;
    const slots = data["slots"] as Array<Record<string, unknown>>;
    expect(slots[0]!["resourceName"]).toBeNull();
  });
});
