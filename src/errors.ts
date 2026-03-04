import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FloydApiError } from "./floyd-client";
import { error as mcpError } from "./format";

export interface McpError {
  code: string;
  message: string;
  recoveryHint: string;
}

const POLICY_HINTS: Record<string, string> = {
  "policy.blackout": "That date is blocked. Try a different date.",
  "policy.closed": "The service is closed at that time. Try during business hours.",
  "policy.invalid_duration": "That duration isn't available. Check allowed durations.",
  "policy.misaligned_start": "That start time doesn't align to the scheduling grid.",
  "policy.lead_time_violation": "Too short notice. Try a time further in the future.",
  "policy.horizon_exceeded": "Too far in advance. Try a date closer to today.",
  "policy.overnight_not_supported": "Overnight bookings are not supported.",
};

export function mapFloydError(err: FloydApiError): McpError {
  const apiCode = err.code;

  if (err.status === 409) {
    if (apiCode === "allocation.overlap") {
      return {
        code: "slot_unavailable",
        message: "That time slot is no longer available.",
        recoveryHint:
          "Ask the user to pick a different time, or call floyd_get_available_slots again.",
      };
    }

    // Engine returns error.code = "policy.rejected" with the specific reason
    // in error.details.code (e.g. "policy.blackout", "policy.closed")
    if (apiCode === "policy.rejected") {
      const subCode = err.body?.error.details?.code;
      const hint = subCode ? POLICY_HINTS[subCode] : undefined;
      return {
        code: "policy_rejected",
        message: hint ?? "The booking was rejected by the service policy.",
        recoveryHint:
          hint ?? "The booking was rejected by the service policy. Try different parameters.",
      };
    }

    // Explicit hold expiry (hold's expiresAt has passed)
    if (apiCode === "booking.hold_expired") {
      return {
        code: "hold_expired",
        message: "The hold has expired.",
        recoveryHint: "The hold expired. Call floyd_get_available_slots for new options.",
      };
    }

    // Service configuration errors — not transient, retrying won't help
    if (apiCode === "service.no_policy" || apiCode === "service.resource_not_member") {
      return {
        code: "service_misconfigured",
        message: err.body?.error.message ?? "The service is not properly configured.",
        recoveryHint: "The service is not properly configured. Contact the administrator.",
      };
    }

    // Status transition conflict — differentiate by currentStatus
    if (apiCode === "booking.invalid_transition") {
      const currentStatus = err.body?.error.details?.currentStatus;
      if (currentStatus === "expired") {
        return {
          code: "hold_expired",
          message: "The hold has expired.",
          recoveryHint: "The hold expired. Call floyd_get_available_slots for new options.",
        };
      }
      if (currentStatus === "confirmed") {
        return {
          code: "already_confirmed",
          message: "This booking is already confirmed.",
          recoveryHint: "This booking is already confirmed. No further action needed.",
        };
      }
      if (currentStatus === "canceled") {
        return {
          code: "already_canceled",
          message: "This booking was already canceled.",
          recoveryHint: "This booking was already canceled. Create a new booking if needed.",
        };
      }
      return {
        code: "invalid_transition",
        message: err.body?.error.message ?? "Invalid booking status transition.",
        recoveryHint: "The booking cannot be changed to the requested status.",
      };
    }

    return {
      code: "conflict",
      message: err.body?.error.message ?? "Conflict.",
      recoveryHint: "The request conflicts with existing data. Try again.",
    };
  }

  if (err.status === 422) {
    return {
      code: "invalid_input",
      message: err.body?.error.message ?? "Invalid input.",
      recoveryHint: err.body?.error.message ?? "Check the input and try again.",
    };
  }

  if (err.status === 404) {
    return {
      code: "not_found",
      message: "That resource was not found.",
      recoveryHint: "That booking or resource was not found. Check the ID.",
    };
  }

  if (err.status === 425) {
    return {
      code: "retry_in_progress",
      message: "A previous request is still processing.",
      recoveryHint: "A previous request is still processing. Wait and retry.",
    };
  }

  if (err.status === 401) {
    return {
      code: "auth_failed",
      message: "Invalid API key.",
      recoveryHint: "Invalid API key.",
    };
  }

  if (err.status >= 500) {
    return {
      code: "upstream_error",
      message: "Floyd API is temporarily unavailable.",
      recoveryHint: "Floyd API is temporarily unavailable. Try again.",
    };
  }

  return {
    code: "upstream_error",
    message: err.body?.error.message ?? "Unexpected error.",
    recoveryHint: "An unexpected error occurred. Try again.",
  };
}

/**
 * Catch-all error handler for tool handlers. Converts FloydApiError and
 * network errors into MCP tool error responses.
 */
export function handleToolError(err: unknown): CallToolResult {
  if (err instanceof FloydApiError) {
    const mapped = mapFloydError(err);
    return mcpError(mapped.code, mapped.message, mapped.recoveryHint);
  }
  // Network errors (DNS, timeout, connection refused, etc.)
  return mcpError(
    "upstream_error",
    "Floyd API is temporarily unavailable.",
    "Floyd API is temporarily unavailable. Try again.",
  );
}
