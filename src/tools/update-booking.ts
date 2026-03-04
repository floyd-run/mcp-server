import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydClient } from "../floyd-client";
import { formatBooking, success } from "../format";
import { handleToolError } from "../errors";

export const name = "floyd_update_booking";

export const description =
  "Update a booking's metadata. Use this to attach context learned during the conversation (e.g. party size, special requests, cancellation reason). Works on bookings in any status.";

export const inputSchema = {
  bookingId: z.string().describe("The booking ID to update."),
  metadata: z
    .record(z.string(), z.unknown())
    .describe("The new metadata object. Replaces the entire existing metadata."),
};

export async function handler(
  args: {
    bookingId: string;
    metadata: Record<string, unknown>;
  },
  client: FloydClient,
): Promise<CallToolResult> {
  try {
    const response = await client.updateBookingMetadata(args.bookingId, args.metadata);

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
