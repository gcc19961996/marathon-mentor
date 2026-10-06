import { describe, expect, it } from "vitest";
import { clockAfterStart, gelSchedule } from "./raceFueling";

describe("clockAfterStart", () => {
  it("adds elapsed time to the 10:00 AM start", () => {
    expect(clockAfterStart(0)).toBe("10:00 AM");
    expect(clockAfterStart(39 * 60 + 20)).toBe("10:39 AM");
    expect(clockAfterStart(2 * 3600 + 5 * 60)).toBe("12:05 PM");
    expect(clockAfterStart(3 * 3600 + 30)).toBe("1:01 PM");
  });
});

describe("gelSchedule", () => {
  const gels = gelSchedule(4.25 * 3600);

  it("puts gels at miles 4, 8, 12, 16, 20 plus an optional 23", () => {
    expect(gels.map((g) => g.mile)).toEqual([4, 8, 12, 16, 20, 23]);
    expect(gels.filter((g) => g.optional).map((g) => g.mile)).toEqual([23]);
  });

  it("spaces gels about 40 minutes apart at a 4:15 goal", () => {
    for (let i = 1; i < 5; i++) {
      const gap = ((gels[i]?.elapsed ?? 0) - (gels[i - 1]?.elapsed ?? 0)) / 60;
      expect(gap).toBeGreaterThan(36);
      expect(gap).toBeLessThan(43);
    }
  });

  it("gets later as the goal gets slower", () => {
    const slower = gelSchedule(4.75 * 3600);
    expect(slower[4]!.elapsed).toBeGreaterThan(gels[4]!.elapsed);
  });
});
