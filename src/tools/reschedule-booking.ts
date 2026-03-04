import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydClient } from "../floyd-client";
import { formatBooking, success } from "../format";
import { handleToolError } from "../errors";

export const name = "floyd_reschedule_booking";

export const description =
  "Move a held or confirmed booking to a new time. Preserves the booking identity and re-evaluates the service policy against the new time.";

export const inputSchema = {
  bookingId: z.string().describe("The booking ID to reschedule."),
  startTime: z
    .string()
    .describe("New appointment start time in ISO 8601 UTC (e.g. 2026-03-01T14:00:00Z)."),
  endTime: z
    .string()
    .describe("New appointment end time in ISO 8601 UTC (e.g. 2026-03-01T15:00:00Z)."),
  idempotencyKey: z.string().optional().describe("Forwarded as Idempotency-Key header."),
};

export async function handler(
  args: {
    bookingId: string;
    startTime: string;
    endTime: string;
    idempotencyKey?: string | undefined;
  },
  client: FloydClient,
): Promise<CallToolResult> {
  try {
    const response = await client.rescheduleBooking({
      bookingId: args.bookingId,
      startTime: args.startTime,
      endTime: args.endTime,
      idempotencyKey: args.idempotencyKey,
    });

    const activeAlloc = response.data.allocations.find((a) => a.active);
    const resourceId = activeAlloc?.resourceId;
    const resource = resourceId
      ? await client
          .getResource(resourceId)
          .then((r) => r.data)
          .catch(() => null)
      : null;

    const booking = formatBooking(response.data, resource);
    return success({ booking });
  } catch (err) {
    return handleToolError(err);
  }
}
