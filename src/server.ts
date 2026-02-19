import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FloydClient } from "./floyd-client.js";
import type { Config } from "./config.js";

import * as getAvailableSlots from "./tools/get-available-slots.js";
import * as holdBooking from "./tools/hold-booking.js";
import * as confirmBooking from "./tools/confirm-booking.js";
import * as cancelBooking from "./tools/cancel-booking.js";
import * as getBooking from "./tools/get-booking.js";

function resolveApiKey(
  extra: { authInfo?: { token?: string } },
  fallback: string,
): string {
  return extra.authInfo?.token || fallback;
}

export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: "floyd-mcp-server",
    version: "0.1.0",
  });

  server.tool(
    getAvailableSlots.name,
    getAvailableSlots.description,
    getAvailableSlots.inputSchema,
    (args, extra) => {
      const apiKey = resolveApiKey(extra, config.floydApiKey);
      const client = new FloydClient(config.floydBaseUrl, apiKey);
      return getAvailableSlots.handler(args, client, apiKey);
    },
  );

  server.tool(
    holdBooking.name,
    holdBooking.description,
    holdBooking.inputSchema,
    (args, extra) => {
      const apiKey = resolveApiKey(extra, config.floydApiKey);
      const client = new FloydClient(config.floydBaseUrl, apiKey);
      return holdBooking.handler(args, client, apiKey);
    },
  );

  server.tool(
    confirmBooking.name,
    confirmBooking.description,
    confirmBooking.inputSchema,
    (args, extra) => {
      const apiKey = resolveApiKey(extra, config.floydApiKey);
      const client = new FloydClient(config.floydBaseUrl, apiKey);
      return confirmBooking.handler(args, client);
    },
  );

  server.tool(
    cancelBooking.name,
    cancelBooking.description,
    cancelBooking.inputSchema,
    (args, extra) => {
      const apiKey = resolveApiKey(extra, config.floydApiKey);
      const client = new FloydClient(config.floydBaseUrl, apiKey);
      return cancelBooking.handler(args, client);
    },
  );

  server.tool(
    getBooking.name,
    getBooking.description,
    getBooking.inputSchema,
    (args, extra) => {
      const apiKey = resolveApiKey(extra, config.floydApiKey);
      const client = new FloydClient(config.floydBaseUrl, apiKey);
      return getBooking.handler(args, client);
    },
  );

  return server;
}
