import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydClient } from "../floyd-client.js";
import { formatBooking, success } from "../format.js";
import { handleToolError } from "../errors.js";

export const name = "floyd_cancel_booking";

export const description =
  "Cancel a held or confirmed booking. Releases the time slot.";

export const inputSchema = {
  bookingId: z.string().describe("The booking ID to cancel."),
  reason: z
    .string()
    .optional()
    .describe("Optional cancellation reason for record-keeping."),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Forwarded as Idempotency-Key header."),
};

export async function handler(
  args: {
    bookingId: string;
    reason?: string;
    idempotencyKey?: string;
  },
  client: FloydClient,
): Promise<CallToolResult> {
  if (args.reason) {
    // Engine does not accept a reason field yet. Log server-side.
    console.info(
      `[floyd-mcp] cancel reason for ${args.bookingId}: ${args.reason}`,
    );
  }

  try {
    const response = await client.cancelBooking(
      args.bookingId,
      args.idempotencyKey,
    );

    const resourceId = response.data.allocations[0]?.resourceId;
    const resource = resourceId
      ? await client.getResource(resourceId).then((r) => r.data).catch(() => null)
      : null;

    const booking = formatBooking(response.data, resource);
    return success({ booking });
  } catch (err) {
    return handleToolError(err);
  }
}
