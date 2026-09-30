import { describe, expect, it } from "vitest";
import { effortFor, runLengthLabel } from "./effort";
import { parseDuration } from "./training";
import { clockLeftRunning } from "./splitFlags";

const pace = (mmss: string) => parseDuration(mmss) as number;

describe("effort bands", () => {
  it("labels paces with the plan's zones", () => {
    expect(effortFor(pace("10:17"))).toBe("Easy");
    expect(effortFor(pace("9:50"))).toBe("Easy");
    expect(effortFor(pace("9:49"))).toBe("Moderate");
    expect(effortFor(pace("9:00"))).toBe("Moderate");
    expect(effortFor(pace("8:59"))).toBe("Fast");
    expect(effortFor(pace("8:36"))).toBe("Fast");
    expect(effortFor(pace("8:35"))).toBe("Tempo");
    expect(effortFor(pace("8:25"))).toBe("Tempo");
    expect(effortFor(pace("8:24"))).toBe("Hard");
    expect(effortFor(null)).toBeNull();
  });

  it("buckets runs by length", () => {
    expect(runLengthLabel(4.9)).toBe("Short run");
    expect(runLengthLabel(5)).toBe("Medium run");
    expect(runLengthLabel(10)).toBe("Long run");
  });
});

describe("clock left running", () => {
  const r = (moving: number, elapsed: number) => ({
    distance_mi: 5,
    duration_seconds: moving,
    avg_pace_seconds: null,
    elapsed_seconds: elapsed,
  });

  it("flags stops over 20% of moving time or over 10 minutes", () => {
    expect(clockLeftRunning(r(3000, 3000 + 601))).toBe(true); // > 10 min stopped
    expect(clockLeftRunning(r(1000, 1000 + 201))).toBe(true); // > 20% of moving
    expect(clockLeftRunning(r(3000, 3000 + 300))).toBe(false);
    expect(clockLeftRunning(r(3000, 3000))).toBe(false);
  });
});
