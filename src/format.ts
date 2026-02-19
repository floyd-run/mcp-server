import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydAllocation, FloydBooking, FloydResource, McpBooking } from "./types";

export function toLocalTime(utcIso: string, timezone: string): string {
  const date = new Date(utcIso);
  // Build an ISO-like local string with offset
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour") === "24" ? "00" : get("hour");
  const min = get("minute");
  const ss = get("second");
  const offset = get("timeZoneName").replace("GMT", "") || "+00:00";

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${offset}`;
}

/**
 * Derives the customer appointment times from a buffer-expanded allocation.
 * Engine stores: allocation.startTime = appointment - bufferBefore,
 *                allocation.endTime   = appointment + bufferAfter.
 */
function appointmentTimes(alloc: FloydAllocation): { startTime: string; endTime: string } {
  const start = new Date(alloc.startTime).getTime() + alloc.buffer.beforeMs;
  const end = new Date(alloc.endTime).getTime() - alloc.buffer.afterMs;
  return {
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
  };
}

export function formatBooking(booking: FloydBooking, resource: FloydResource | null): McpBooking {
  const alloc: FloydAllocation | undefined = booking.allocations[0];
  const timezone = resource?.timezone ?? "UTC";
  const times = alloc ? appointmentTimes(alloc) : null;
  const startTime = times?.startTime ?? null;
  const endTime = times?.endTime ?? null;

  return {
    bookingId: booking.id,
    status: booking.status,
    serviceId: booking.serviceId,
    resourceId: alloc?.resourceId ?? "",
    resourceName: resource?.name ?? null,
    startTime,
    endTime,
    startTimeLocal: startTime ? toLocalTime(startTime, timezone) : null,
    endTimeLocal: endTime ? toLocalTime(endTime, timezone) : null,
    timezone,
    expiresAt: booking.expiresAt,
    metadata: Object.keys(booking.metadata).length > 0 ? booking.metadata : null,
  };
}

export function success(data: Record<string, unknown>): CallToolResult {
  const text = JSON.stringify(data);
  return {
    structuredContent: data,
    content: [{ type: "text", text }],
  };
}

export function error(code: string, message: string, recoveryHint: string): CallToolResult {
  const data = { error: true, code, message, recoveryHint };
  const text = JSON.stringify(data);
  return {
    isError: true,
    structuredContent: data,
    content: [{ type: "text", text }],
  };
}
