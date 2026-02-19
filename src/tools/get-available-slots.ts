import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { FloydClient } from "../floyd-client.js";
import type { FloydResource, McpSlot } from "../types.js";
import { sign } from "../slot-id.js";
import { toLocalTime, success } from "../format.js";
import { handleToolError } from "../errors.js";

export const name = "floyd_get_available_slots";

export const description =
  "Check available appointment times for a service.";

export const inputSchema = {
  serviceId: z
    .string()
    .describe("The service to check availability for."),
  startTime: z
    .string()
    .datetime()
    .describe("ISO 8601 UTC. Start of the search range."),
  endTime: z
    .string()
    .datetime()
    .describe("ISO 8601 UTC. End of the search range. Max 7 days from startTime."),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .describe("Desired appointment length in minutes."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Max slots to return. Default 10."),
};

export async function handler(
  args: {
    serviceId: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    limit: number;
  },
  client: FloydClient,
  apiKey: string,
): Promise<CallToolResult> {
  try {
    const durationMs = args.durationMinutes * 60_000;
    const slotsResponse = await client.getAvailableSlots(
      args.serviceId,
      args.startTime,
      args.endTime,
      durationMs,
    );

    // Collect unique resource IDs and fetch their details
    const resourceIds = [
      ...new Set(slotsResponse.data.map((r) => r.resourceId)),
    ];
    const resourceMap = new Map<string, FloydResource>();

    await Promise.all(
      resourceIds.map(async (id) => {
        try {
          const res = await client.getResource(id);
          resourceMap.set(id, res.data);
        } catch {
          // If resource fetch fails, we still return slots without names
        }
      }),
    );

    // Flatten and transform slots
    const slots: McpSlot[] = [];

    for (const entry of slotsResponse.data) {
      const resource = resourceMap.get(entry.resourceId);
      const timezone = resource?.timezone ?? entry.timezone;

      for (const slot of entry.slots) {
        if (slot.status !== "available") continue;
        if (slots.length >= args.limit) break;

        const slotId = sign(
          {
            v: 1,
            svc: args.serviceId,
            rsc: entry.resourceId,
            st: slot.startTime,
            et: slot.endTime,
            tz: timezone,
          },
          apiKey,
        );

        slots.push({
          slotId,
          serviceId: args.serviceId,
          resourceId: entry.resourceId,
          resourceName: resource?.name ?? null,
          startTime: slot.startTime,
          endTime: slot.endTime,
          startTimeLocal: toLocalTime(slot.startTime, timezone),
          endTimeLocal: toLocalTime(slot.endTime, timezone),
          timezone,
        });
      }
      if (slots.length >= args.limit) break;
    }

    return success({ slots });
  } catch (err) {
    return handleToolError(err);
  }
}
