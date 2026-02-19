import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydClient } from "../floyd-client.js";
import { formatBooking, success, error } from "../format.js";
import { handleToolError } from "../errors.js";

export const name = "floyd_confirm_booking";

export const description =
  "Confirm a held booking. Only call this after the user has explicitly agreed to finalize the booking.";

export const inputSchema = {
  bookingId: z
    .string()
    .describe("The booking ID from floyd_hold_booking."),
  userConfirmed: z
    .boolean()
    .describe(
      "Must be true. Set to true only after the user has explicitly agreed to finalize the booking.",
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe("Forwarded as Idempotency-Key header."),
};

export async function handler(
  args: {
    bookingId: string;
    userConfirmed: boolean;
    idempotencyKey?: string;
  },
  client: FloydClient,
): Promise<CallToolResult> {
  if (args.userConfirmed !== true) {
    return error(
      "user_confirmation_required",
      "The user has not confirmed yet.",
      "Present the appointment details and ask the user to explicitly confirm before calling this tool again.",
    );
  }

  try {
    const response = await client.confirmBooking(
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
