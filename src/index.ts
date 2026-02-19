#!/usr/bin/env node
/* eslint-disable no-console */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { createServer } from "./server";

const config = loadConfig();
const isStdio = process.argv.includes("--stdio");

function extractApiKey(req: Request): string | undefined {
  // Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // ?token=<value> query parameter
  const url = new URL(req.url);
  return url.searchParams.get("token") ?? undefined;
}

if (isStdio) {
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[floyd-mcp] Running in stdio mode");
} else {
  const app = new Hono();

  app.post("/mcp", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    const server = createServer(config);
    await server.connect(transport);

    const apiKey = extractApiKey(c.req.raw);
    return transport.handleRequest(
      c.req.raw,
      apiKey ? { authInfo: { token: apiKey, clientId: "", scopes: [] } } : undefined,
    );
  });

  app.get("/mcp", (c) => c.body(null, 405));

  app.get("/health", (c) => c.json({ ok: true }));

  const httpServer = serve({ fetch: app.fetch, port: config.port }, () => {
    console.error(`[floyd-mcp] Streamable HTTP server listening on port ${config.port}`);
    console.error(`[floyd-mcp] Endpoint: POST http://localhost:${config.port}/mcp`);
  });

  function shutdown() {
    console.error("[floyd-mcp] Shutting down...");
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
