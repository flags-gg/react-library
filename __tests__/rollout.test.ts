import { bucket, encodeContext, inRollout, visitorId } from "../src/rollout";

// Same vectors as the API (orchestrator internal/flags/rollout_test.go); they must never drift.
const vectors: [string, string, number][] = [
  ["new-checkout", "user-1", 63],
  ["new-checkout", "user-2", 82],
  ["teams", "visitor-abc", 12],
  ["", "", 53],
  ["émoji ✓", "ключ", 95],
];

describe("rollout", () => {
  it.each(vectors)("bucket(%j, %j) = %i", (flag, key, want) => {
    expect(bucket(flag, key)).toBe(want);
  });

  it("applies the percentage and fails closed without a key", () => {
    expect(inRollout("new-checkout", "user-1", 63)).toBe(false); // bucket 63
    expect(inRollout("new-checkout", "user-1", 64)).toBe(true);
    expect(inRollout("new-checkout", undefined, 50)).toBe(false);
    expect(inRollout("new-checkout", undefined, 100)).toBe(true);
    expect(inRollout("new-checkout", undefined)).toBe(true);
    expect(inRollout("new-checkout", "user-1", 0)).toBe(false);
  });

  it("keeps a stable visitor id", () => {
    const first = visitorId();
    expect(first).toBeTruthy();
    expect(visitorId()).toBe(first);
  });

  it("encodes the user for the server's targeting rules", () => {
    const decoded = JSON.parse(Buffer.from(encodeContext("u-1", { email: "ana@acme.com", groups: ["beta", "ünï"] }), "base64").toString("utf8"));
    expect(decoded).toEqual({ email: "ana@acme.com", groups: ["beta", "ünï"], key: "u-1" });
  });
});
