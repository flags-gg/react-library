// Percentage rollouts. Must match the API and every other SDK exactly:
// bucket = FNV-1a 32-bit of UTF-8 "<flag name>:<targeting key>", modulo 100.
export const bucket = (flagName: string, targetingKey: string): number => {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`${flagName}:${targetingKey}`)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
};

// Without a key only a full rollout applies, so partial rollouts fail closed.
export const inRollout = (flagName: string, targetingKey: string | undefined, rollout = 100): boolean => {
  if (rollout >= 100) return true;
  if (rollout <= 0 || !targetingKey) return false;
  return bucket(flagName, targetingKey) < rollout;
};

const VISITOR_KEY = "flagsgg:visitor";

// A stable anonymous id per browser, so "percentage of visitors" works without a user id.
export const visitorId = (): string | undefined => {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return undefined; // storage blocked / SSR: partial rollouts stay off
  }
};
