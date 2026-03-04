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
| `floyd_reschedule_booking`  | Move a booking to a new time                            |
| `floyd_update_booking`      | Update a booking's metadata                             |
| `floyd_get_booking`         | Retrieve booking details and status                     |

## Setup

```bash
pnpm install
```

### Environment variables

| Variable         | Required | Default                    | Description        |
| ---------------- | -------- | -------------------------- | ------------------ |
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

When the Floyd engine requires authentication, connecting agents provide their API key via:

1. `Authorization: Bearer <token>` header (preferred)
2. `?token=<value>` query parameter

The API key is forwarded to the Floyd engine on each request. If the engine has auth disabled (e.g. self-hosted), no key is needed.

## Booking flow

```
get_available_slots → hold_booking → confirm_booking
                                   ↘ cancel_booking
                                   ↘ reschedule_booking
                                   ↘ update_booking (metadata)
```

1. **Get slots** — query available times, returns signed `slotId` tokens
2. **Hold** — reserve a slot using the `slotId` (or explicit fields). Creates a booking in `held` state
3. **Confirm** — finalize the booking. Requires `userConfirmed: true`
4. **Cancel** — release a held or confirmed booking
5. **Reschedule** — move a booking to a new time, preserving its identity
6. **Update** — attach or replace metadata (e.g. party size, special requests)

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
pnpm start
```

The server handles `SIGTERM`/`SIGINT` for graceful shutdown. HTTP requests to the Floyd API have a 10-second timeout.
