import { describe, it, expect } from "vitest";
import { mapFloydError } from "../src/errors";
import { FloydApiError } from "../src/floyd-client";
import type { FloydErrorDetails } from "../src/types";

function makeError(
  status: number,
  code: string,
  message = "test error",
  details?: FloydErrorDetails,
): FloydApiError {
  return new FloydApiError(status, {
    error: { code, message, ...(details ? { details } : {}) },
  });
}

describe("mapFloydError", () => {
  it("maps allocation.overlap to slot_unavailable", () => {
    const result = mapFloydError(makeError(409, "allocation.overlap"));
    expect(result.code).toBe("slot_unavailable");
    expect(result.recoveryHint).toContain("different time");
  });

  describe("policy.rejected with sub-codes", () => {
    it("maps policy.blackout to policy_rejected with specific hint", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", { code: "policy.blackout" }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("blocked");
    });

    it("maps policy.closed to policy_rejected with specific hint", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", { code: "policy.closed" }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("business hours");
    });

    it("maps policy.invalid_duration to policy_rejected with specific hint", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", { code: "policy.invalid_duration" }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("duration");
    });

    it("maps policy.misaligned_start to policy_rejected with specific hint", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", { code: "policy.misaligned_start" }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("grid");
    });

    it("maps policy.lead_time_violation to policy_rejected with specific hint", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", { code: "policy.lead_time_violation" }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("further in the future");
    });

    it("maps policy.horizon_exceeded to policy_rejected with specific hint", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", { code: "policy.horizon_exceeded" }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("closer to today");
    });

    it("maps policy.overnight_not_supported to policy_rejected with specific hint", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", {
          code: "policy.overnight_not_supported",
        }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("Overnight");
    });

    it("uses generic message for unknown policy sub-code", () => {
      const result = mapFloydError(
        makeError(409, "policy.rejected", "Conflict", { code: "policy.eval_error" }),
      );
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("rejected by the service policy");
    });

    it("uses generic message when no details present", () => {
      const result = mapFloydError(makeError(409, "policy.rejected", "Conflict"));
      expect(result.code).toBe("policy_rejected");
      expect(result.message).toContain("rejected by the service policy");
    });
  });

  describe("booking.hold_expired", () => {
    it("maps to hold_expired", () => {
      const result = mapFloydError(makeError(409, "booking.hold_expired"));
      expect(result.code).toBe("hold_expired");
      expect(result.recoveryHint).toContain("floyd_get_available_slots");
    });
  });

  describe("booking.invalid_transition", () => {
    it("maps expired status to hold_expired", () => {
      const result = mapFloydError(
        makeError(409, "booking.invalid_transition", "Conflict", {
          currentStatus: "expired",
          requestedStatus: "confirmed",
        }),
      );
      expect(result.code).toBe("hold_expired");
    });

    it("maps confirmed status to already_confirmed", () => {
      const result = mapFloydError(
        makeError(409, "booking.invalid_transition", "Conflict", {
          currentStatus: "confirmed",
          requestedStatus: "confirmed",
        }),
      );
      expect(result.code).toBe("already_confirmed");
    });

    it("maps canceled status to already_canceled", () => {
      const result = mapFloydError(
        makeError(409, "booking.invalid_transition", "Conflict", {
          currentStatus: "canceled",
          requestedStatus: "canceled",
        }),
      );
      expect(result.code).toBe("already_canceled");
    });

    it("falls back to invalid_transition for unknown status", () => {
      const result = mapFloydError(makeError(409, "booking.invalid_transition", "Conflict"));
      expect(result.code).toBe("invalid_transition");
    });
  });

  it("maps 422 to invalid_input", () => {
    const result = mapFloydError(makeError(422, "validation_error"));
    expect(result.code).toBe("invalid_input");
  });

  it("maps 404 to not_found", () => {
    const result = mapFloydError(makeError(404, "not_found"));
    expect(result.code).toBe("not_found");
  });

  it("maps 425 to retry_in_progress", () => {
    const result = mapFloydError(makeError(425, "idempotency_in_progress"));
    expect(result.code).toBe("retry_in_progress");
  });

  it("maps 401 to auth_failed", () => {
    const result = mapFloydError(makeError(401, "unauthorized"));
    expect(result.code).toBe("auth_failed");
  });

  it("maps 500 to upstream_error", () => {
    const result = mapFloydError(makeError(500, "internal"));
    expect(result.code).toBe("upstream_error");
  });

  it("maps 503 to upstream_error", () => {
    const result = mapFloydError(makeError(503, "unavailable"));
    expect(result.code).toBe("upstream_error");
  });

  it("maps unknown status to upstream_error", () => {
    const result = mapFloydError(makeError(418, "teapot"));
    expect(result.code).toBe("upstream_error");
  });
});
