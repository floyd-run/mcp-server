# Floyd MCP Server

MCP server that exposes [Floyd](https://floyd.run) scheduling and booking tools to AI agents. Built on the [Model Context Protocol](https://modelcontextprotocol.io) Streamable HTTP transport.

For full API documentation, see [docs.floyd.run](https://docs.floyd.run).

## Tools

| Tool                        | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `floyd_get_available_slots` | Check available appointment times for a service         |
| `floyd_hold_booking`        | Place a temporary hold on a time slot                   |
| `floyd_confirm_booking`     | Confirm a held booking (requires explicit user consent) |
| `floyd_cancel_booking`      | Cancel a held or confirmed booking                      |
| `floyd_get_booking`         | Retrieve booking details and status                     |

## Setup

```bash
pnpm install
```

### Environment variables

| Variable         | Required | Default                    | Description        |
| ---------------- | -------- | -------------------------- | ------------------ |
| `FLOYD_API_KEY`  | Yes      | —                          | Floyd API key      |
| `FLOYD_BASE_URL` | No       | `https://api.floyd.run/v1` | Floyd API base URL |
| `PORT`           | No       | `3000`                     | HTTP server port   |

## Usage

### HTTP mode (Streamable HTTP)

```bash
pnpm dev
```

MCP endpoint: `POST /`
Health check: `GET /health`

### Stdio mode

```bash
pnpm dev -- --stdio
```

### Authentication

The server resolves API keys per-request in this order:

1. `Authorization: Bearer <token>` header
2. `?token=<value>` query parameter
3. `FLOYD_API_KEY` environment variable (fallback)

This allows multi-tenant setups where each client sends its own API key.

## Booking flow

```
get_available_slots → hold_booking → confirm_booking
                                   ↘ cancel_booking
```

1. **Get slots** — query available times, returns signed `slotId` tokens
2. **Hold** — reserve a slot using the `slotId` (or explicit fields). Creates a booking in `held` state
3. **Confirm** — finalize the booking. Requires `userConfirmed: true`
4. **Cancel** — release a held or confirmed booking

## Development

```bash
pnpm test          # run tests
pnpm typecheck     # type-check
pnpm lint          # eslint
pnpm format        # prettier
pnpm build         # bundle with tsup
```

## Production

```bash
pnpm build
FLOYD_API_KEY=floyd_live_xxx node dist/index.js
```

The server handles `SIGTERM`/`SIGINT` for graceful shutdown. HTTP requests to the Floyd API have a 10-second timeout.
