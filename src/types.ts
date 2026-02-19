// Floyd Engine/Cloud API response types (what the upstream API returns)

export interface FloydAllocation {
  id: string;
  resourceId: string;
  startTime: string;
  endTime: string;
  buffer: { beforeMs: number; afterMs: number };
  active: boolean;
}

export interface FloydBooking {
  id: string;
  ledgerId: string;
  serviceId: string;
  policyVersionId: string;
  status: "hold" | "confirmed" | "canceled" | "expired";
  expiresAt: string | null;
  allocations: FloydAllocation[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FloydResource {
  id: string;
  ledgerId: string;
  name: string | null;
  timezone: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FloydSlot {
  startTime: string;
  endTime: string;
  status: "available" | "unavailable";
}

export interface FloydSlotsResourceEntry {
  resourceId: string;
  timezone: string;
  slots: FloydSlot[];
}

export interface FloydSlotsResponse {
  data: FloydSlotsResourceEntry[];
  meta: { serverTime: string };
}

export interface FloydResourceResponse {
  data: FloydResource;
}

export interface FloydBookingResponse {
  data: FloydBooking;
}

export interface FloydErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// MCP tool output types (what we return to the MCP client)

export interface McpSlot {
  slotId: string;
  serviceId: string;
  resourceId: string;
  resourceName: string | null;
  startTime: string;
  endTime: string;
  startTimeLocal: string;
  endTimeLocal: string;
  timezone: string;
}

export interface McpBooking {
  bookingId: string;
  status: string;
  serviceId: string;
  resourceId: string;
  resourceName: string | null;
  startTime: string | null;
  endTime: string | null;
  startTimeLocal: string | null;
  endTimeLocal: string | null;
  timezone: string;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
}
