import type {
  FloydSlotsResponse,
  FloydBookingResponse,
  FloydResourceResponse,
  FloydErrorBody,
} from "./types";

export class FloydApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: FloydErrorBody | null,
  ) {
    const code = body?.error.code ?? "unknown";
    super(`Floyd API ${status}: ${code}`);
    this.name = "FloydApiError";
  }

  get code(): string {
    return this.body?.error.code ?? "unknown";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class FloydClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...headers,
    };
    if (body) {
      reqHeaders["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      let errorBody: FloydErrorBody | null = null;
      try {
        errorBody = (await res.json()) as FloydErrorBody;
      } catch {
        // response body not JSON
      }
      throw new FloydApiError(res.status, errorBody);
    }

    return (await res.json()) as T;
  }

  async getAvailableSlots(
    serviceId: string,
    startTime: string,
    endTime: string,
    durationMs: number,
  ): Promise<FloydSlotsResponse> {
    return this.request("POST", `/services/${serviceId}/availability/slots`, {
      startTime,
      endTime,
      durationMs,
    });
  }

  async createBooking(params: {
    serviceId: string;
    resourceId: string;
    startTime: string;
    endTime: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<FloydBookingResponse> {
    const headers: Record<string, string> = {};
    if (params.idempotencyKey) {
      headers["Idempotency-Key"] = params.idempotencyKey;
    }
    return this.request(
      "POST",
      "/bookings",
      {
        serviceId: params.serviceId,
        resourceId: params.resourceId,
        startTime: params.startTime,
        endTime: params.endTime,
        status: "hold",
        metadata: params.metadata ?? {},
      },
      headers,
    );
  }

  async confirmBooking(bookingId: string, idempotencyKey?: string): Promise<FloydBookingResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return this.request("POST", `/bookings/${bookingId}/confirm`, undefined, headers);
  }

  async cancelBooking(bookingId: string, idempotencyKey?: string): Promise<FloydBookingResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return this.request("POST", `/bookings/${bookingId}/cancel`, undefined, headers);
  }

  async getBooking(bookingId: string): Promise<FloydBookingResponse> {
    return this.request("GET", `/bookings/${bookingId}`);
  }

  async getResource(resourceId: string): Promise<FloydResourceResponse> {
    return this.request("GET", `/resources/${resourceId}`);
  }
}
