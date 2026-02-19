import { describe, it, expect } from "vitest";
import { toLocalTime, formatBooking, success, error } from "../src/format";
import type { FloydBooking, FloydResource } from "../src/types";

describe("toLocalTime", () => {
  it("converts UTC to Eastern time with offset", () => {
    // 2026-03-01 is not DST yet (EST = UTC-5)
    const result = toLocalTime("2026-03-01T19:30:00Z", "America/New_York");
    expect(result).toBe("2026-03-01T14:30:00-05:00");
  });

  it("converts UTC to Pacific time with offset", () => {
    // 2026-06-01 is DST (PDT = UTC-7)
    const result = toLocalTime("2026-06-01T20:00:00Z", "America/Los_Angeles");
    expect(result).toBe("2026-06-01T13:00:00-07:00");
  });

  it("handles UTC timezone", () => {
    const result = toLocalTime("2026-03-01T14:00:00Z", "UTC");
    expect(result).toBe("2026-03-01T14:00:00+00:00");
  });
});

describe("formatBooking", () => {
  const booking: FloydBooking = {
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
    metadata: { customerName: "Jane" },
    createdAt: "2026-03-01T13:50:00Z",
    updatedAt: "2026-03-01T13:50:00Z",
  };

  const resource: FloydResource = {
    id: "rsc_01mno",
    ledgerId: "ldg_01xyz",
    name: "Dr. Smith",
    timezone: "America/New_York",
    metadata: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("formats booking with resource", () => {
    const result = formatBooking(booking, resource);
    expect(result.bookingId).toBe("bkg_01abc");
    expect(result.status).toBe("hold");
    expect(result.resourceName).toBe("Dr. Smith");
    expect(result.timezone).toBe("America/New_York");
    expect(result.startTimeLocal).toContain("2026-03-01T09:00:00");
    expect(result.metadata).toEqual({ customerName: "Jane" });
  });

  it("formats booking without resource (null)", () => {
    const result = formatBooking(booking, null);
    expect(result.resourceName).toBeNull();
    expect(result.timezone).toBe("UTC");
  });

  it("returns null metadata when empty", () => {
    const emptyMetaBooking = { ...booking, metadata: {} };
    const result = formatBooking(emptyMetaBooking, resource);
    expect(result.metadata).toBeNull();
  });
});

describe("success", () => {
  it("returns structuredContent and text mirror", () => {
    const data = { slots: [{ slotId: "test" }] };
    const result = success(data);
    expect(result.structuredContent).toEqual(data);
    expect(result.content).toHaveLength(1);
    expect(result.content![0]).toEqual({
      type: "text",
      text: JSON.stringify(data),
    });
    expect(result.isError).toBeUndefined();
  });
});

describe("error", () => {
  it("returns isError true with structured error", () => {
    const result = error("slot_unavailable", "Slot taken", "Pick another time");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: true,
      code: "slot_unavailable",
      message: "Slot taken",
      recoveryHint: "Pick another time",
    });
    expect(result.content).toHaveLength(1);
  });
});
