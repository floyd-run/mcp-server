import { describe, it, expect } from "vitest";
import { sign, verify, type SlotPayload } from "../src/slot-id.js";

const API_KEY = "floyd_live_test_abc123";

const payload: SlotPayload = {
  v: 1,
  svc: "svc_01abc",
  rsc: "rsc_01def",
  st: "2026-03-01T14:00:00Z",
  et: "2026-03-01T14:30:00Z",
  tz: "America/New_York",
};

describe("slot-id", () => {
  it("sign produces a slot_v1 prefixed token", () => {
    const token = sign(payload, API_KEY);
    expect(token).toMatch(/^slot_v1\..+\..+$/);
  });

  it("verify returns payload for a valid token", () => {
    const token = sign(payload, API_KEY);
    const result = verify(token, API_KEY);
    expect(result).toEqual(payload);
  });

  it("verify returns null for a different API key", () => {
    const token = sign(payload, API_KEY);
    const result = verify(token, "floyd_live_different_key");
    expect(result).toBeNull();
  });

  it("verify returns null for a tampered payload", () => {
    const token = sign(payload, API_KEY);
    const parts = token.split(".");
    // Modify one character in the payload
    const tampered = `${parts[0]}.${parts[1]}x.${parts[2]}`;
    expect(verify(tampered, API_KEY)).toBeNull();
  });

  it("verify returns null for a tampered signature", () => {
    const token = sign(payload, API_KEY);
    const tampered = token.slice(0, -2) + "xx";
    expect(verify(tampered, API_KEY)).toBeNull();
  });

  it("verify returns null for garbage input", () => {
    expect(verify("not-a-token", API_KEY)).toBeNull();
    expect(verify("", API_KEY)).toBeNull();
    expect(verify("slot_v1.abc", API_KEY)).toBeNull();
    expect(verify("slot_v2.abc.def", API_KEY)).toBeNull();
  });

  it("verify returns null for wrong version prefix", () => {
    const token = sign(payload, API_KEY);
    const tampered = token.replace("slot_v1", "slot_v2");
    expect(verify(tampered, API_KEY)).toBeNull();
  });

  it("different payloads produce different tokens", () => {
    const token1 = sign(payload, API_KEY);
    const token2 = sign({ ...payload, st: "2026-03-01T15:00:00Z" }, API_KEY);
    expect(token1).not.toEqual(token2);
  });

  it("same payload + key produces deterministic tokens", () => {
    const token1 = sign(payload, API_KEY);
    const token2 = sign(payload, API_KEY);
    expect(token1).toEqual(token2);
  });
});
