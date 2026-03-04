import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydClient } from "../floyd-client";
import { formatBooking, success } from "../format";
import { handleToolError } from "../errors";

export const name = "floyd_get_booking";

export const description =
  "Retrieve booking details. Use this for recap at end of session or to check current status.";

export const inputSchema = {
  bookingId: z.string().describe("The booking ID to retrieve."),
  includeAllocations: z
    .boolean()
    .default(false)
    .describe("If true, includes time allocation details. Default false."),
};

export async function handler(
  args: {
    bookingId: string;
    includeAllocations: boolean;
  },
  client: FloydClient,
): Promise<CallToolResult> {
  try {
    const response = await client.getBooking(args.bookingId);

    const alloc = response.data.allocations.find((a) => a.active) ?? response.data.allocations[0];
    const resourceId = alloc?.resourceId;
    const resource = resourceId
      ? await client
          .getResource(resourceId)
          .then((r) => r.data)
          .catch(() => null)
      : null;

    const booking = formatBooking(response.data, resource);

    if (args.includeAllocations) {
      const allocations = response.data.allocations.map((a) => ({
        allocationId: a.id,
        resourceId: a.resourceId,
        startTime: a.startTime,
        endTime: a.endTime,
        bufferBeforeMs: a.buffer.beforeMs,
        bufferAfterMs: a.buffer.afterMs,
        active: a.active,
      }));
      return success({ booking, allocations });
    }

    return success({ booking });
  } catch (err) {
    return handleToolError(err);
  }
}
