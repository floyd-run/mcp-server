import { describe, it, expect } from "vitest";
import { mapFloydError } from "../src/errors";
import { FloydApiError } from "../src/floyd-client";

function makeError(status: number, code: string, message = "test error"): FloydApiError {
  return new FloydApiError(status, {
    error: { code, message },
  });
}

describe("mapFloydError", () => {
  it("maps allocation.overlap to slot_unavailable", () => {
    const result = mapFloydError(makeError(409, "allocation.overlap"));
    expect(result.code).toBe("slot_unavailable");
    expect(result.recoveryHint).toContain("different time");
  });

  it("maps policy.blackout to policy_rejected", () => {
    const result = mapFloydError(makeError(409, "policy.blackout"));
    expect(result.code).toBe("policy_rejected");
    expect(result.recoveryHint).toContain("blocked");
  });

  it("maps policy.closed to policy_rejected", () => {
    const result = mapFloydError(makeError(409, "policy.closed"));
    expect(result.code).toBe("policy_rejected");
    expect(result.recoveryHint).toContain("business hours");
  });

  it("maps policy.invalid_duration to policy_rejected", () => {
    const result = mapFloydError(makeError(409, "policy.invalid_duration"));
    expect(result.code).toBe("policy_rejected");
    expect(result.recoveryHint).toContain("duration");
  });

  it("maps policy.misaligned_start to policy_rejected", () => {
    const result = mapFloydError(makeError(409, "policy.misaligned_start"));
    expect(result.code).toBe("policy_rejected");
    expect(result.recoveryHint).toContain("grid");
  });

  it("maps policy.lead_time_violation to policy_rejected", () => {
    const result = mapFloydError(makeError(409, "policy.lead_time_violation"));
    expect(result.code).toBe("policy_rejected");
    expect(result.recoveryHint).toContain("further in the future");
  });

  it("maps policy.horizon_exceeded to policy_rejected", () => {
    const result = mapFloydError(makeError(409, "policy.horizon_exceeded"));
    expect(result.code).toBe("policy_rejected");
    expect(result.recoveryHint).toContain("closer to today");
  });

  it("maps policy.overnight_not_supported to policy_rejected", () => {
    const result = mapFloydError(makeError(409, "policy.overnight_not_supported"));
    expect(result.code).toBe("policy_rejected");
    expect(result.recoveryHint).toContain("Overnight");
  });

  it("maps booking.invalid_transition to hold_expired", () => {
    const result = mapFloydError(makeError(409, "booking.invalid_transition"));
    expect(result.code).toBe("hold_expired");
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
