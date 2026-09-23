import { describe, expect, it } from "vitest";
import { addDays, nextReviewState } from "./srs";

describe("nextReviewState", () => {
  it("resets to interval 1, reps 0 on 'again', regardless of prior reps", () => {
    expect(nextReviewState({ ease: 2.5, interval: 6, reps: 2 }, "again")).toEqual({ ease: 2.3, interval: 1, reps: 0 });
  });

  it("floors ease at 1.3 even from a low starting ease", () => {
    expect(nextReviewState({ ease: 1.4, interval: 6, reps: 2 }, "again").ease).toBe(1.3);
    expect(nextReviewState({ ease: 1.35, interval: 6, reps: 2 }, "hard").ease).toBe(1.3);
  });

  it("uses fixed intervals for the first two successful reviews (reps 0 and 1)", () => {
    expect(nextReviewState({ ease: 2.5, interval: 0, reps: 0 }, "good")).toEqual({ ease: 2.5, interval: 1, reps: 1 });
    expect(nextReviewState({ ease: 2.5, interval: 1, reps: 1 }, "good")).toEqual({ ease: 2.5, interval: 6, reps: 2 });
  });

  it("multiplies interval by ease from reps 2 onward, leaving ease unchanged on 'good'", () => {
    expect(nextReviewState({ ease: 2.5, interval: 6, reps: 2 }, "good")).toEqual({ ease: 2.5, interval: 15, reps: 3 });
  });

  it("'hard' lowers ease by 0.15 and shrinks the resulting interval by 20%", () => {
    // interval = round(6 * 2.35) = 14, then round(14 * 0.8) = 11
    expect(nextReviewState({ ease: 2.5, interval: 6, reps: 2 }, "hard")).toEqual({ ease: 2.35, interval: 11, reps: 3 });
  });

  it("'hard' never shrinks the interval below 1 day", () => {
    expect(nextReviewState({ ease: 2.5, interval: 0, reps: 0 }, "hard")).toEqual({ ease: 2.35, interval: 1, reps: 1 });
  });

  it("'easy' raises ease by 0.15 and grows the resulting interval by 30%", () => {
    // interval = round(6 * 2.65) = 16, then round(16 * 1.3) = 21
    expect(nextReviewState({ ease: 2.5, interval: 6, reps: 2 }, "easy")).toEqual({ ease: 2.65, interval: 21, reps: 3 });
  });

  it("always increments reps on a non-'again' rating", () => {
    expect(nextReviewState({ ease: 2.5, interval: 6, reps: 2 }, "hard").reps).toBe(3);
    expect(nextReviewState({ ease: 2.5, interval: 6, reps: 2 }, "easy").reps).toBe(3);
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-09-23", 6)).toBe("2026-09-29");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });

  it("supports 0 days (returns the same date)", () => {
    expect(addDays("2026-09-23", 0)).toBe("2026-09-23");
  });
});
