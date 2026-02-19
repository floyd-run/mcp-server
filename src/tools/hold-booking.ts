import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydClient } from "../floyd-client";
import { verify } from "../slot-id";
import { formatBooking, success, error } from "../format";
import { handleToolError } from "../errors";

export const name = "floyd_hold_booking";

export const description =
  "Place a temporary hold on a time slot. The hold expires automatically if not confirmed. Use a slotId from floyd_get_available_slots, or provide explicit fields.";

export const inputSchema = {
  slotId: z
    .string()
    .optional()
    .describe("Signed token from floyd_get_available_slots. Preferred over explicit fields."),
  serviceId: z.string().optional().describe("Required if no slotId."),
  resourceId: z.string().optional().describe("Required if no slotId."),
  startTime: z.string().datetime().optional().describe("ISO 8601 UTC. Required if no slotId."),
  endTime: z.string().datetime().optional().describe("ISO 8601 UTC. Required if no slotId."),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe("Optional context (customer name, phone, notes)."),
  idempotencyKey: z.string().optional().describe("Forwarded as Idempotency-Key header."),
};

export async function handler(
  args: {
    slotId?: string | undefined;
    serviceId?: string | undefined;
    resourceId?: string | undefined;
    startTime?: string | undefined;
    endTime?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    idempotencyKey?: string | undefined;
  },
  client: FloydClient,
  apiKey: string,
): Promise<CallToolResult> {
  let serviceId: string;
  let resourceId: string;
  let startTime: string;
  let endTime: string;

  if (args.slotId) {
    const payload = verify(args.slotId, apiKey);
    if (!payload) {
      return error(
        "invalid_input",
        "Invalid slot token.",
        "Invalid slot token. Call floyd_get_available_slots for fresh slots.",
      );
    }
    serviceId = payload.svc;
    resourceId = payload.rsc;
    startTime = payload.st;
    endTime = payload.et;
  } else {
    if (!args.serviceId || !args.resourceId || !args.startTime || !args.endTime) {
      return error(
        "invalid_input",
        "Missing required fields.",
        "Provide either a slotId, or all of: serviceId, resourceId, startTime, endTime.",
      );
    }
    serviceId = args.serviceId;
    resourceId = args.resourceId;
    startTime = args.startTime;
    endTime = args.endTime;
  }

  try {
    const response = await client.createBooking({
      serviceId,
      resourceId,
      startTime,
      endTime,
      metadata: args.metadata,
      idempotencyKey: args.idempotencyKey,
    });

    const resource = await client
      .getResource(resourceId)
      .then((r) => r.data)
      .catch(() => null);

    const booking = formatBooking(response.data, resource);
    return success({ booking });
  } catch (err) {
    return handleToolError(err);
  }
}
