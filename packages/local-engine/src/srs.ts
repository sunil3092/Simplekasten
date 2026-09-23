// A simplified SM-2 (same family Anki and Obsidian's spaced-repetition
// plugin use), with four ratings instead of SM-2's original 0-5 quality
// score — the interaction every flashcard app already trained users on.
// Pure and I/O-free by design: this is the part most worth getting right
// in isolation before any vault read/write touches it.

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewProgress {
  ease: number;
  interval: number;
  reps: number;
}

export function nextReviewState(current: ReviewProgress, rating: ReviewRating): ReviewProgress {
  if (rating === "again") {
    return { ease: Math.max(1.3, current.ease - 0.2), interval: 1, reps: 0 };
  }

  let ease = current.ease;
  if (rating === "hard") ease = Math.max(1.3, ease - 0.15);
  else if (rating === "easy") ease += 0.15;
  // "good" leaves ease unchanged — this is SM-2's actual behavior, not a simplification.

  let interval = current.reps === 0 ? 1 : current.reps === 1 ? 6 : Math.round(current.interval * ease);
  if (rating === "hard") interval = Math.max(1, Math.round(interval * 0.8));
  if (rating === "easy") interval = Math.round(interval * 1.3);

  return { ease, interval, reps: current.reps + 1 };
}

/** "YYYY-MM-DD" + N days, computed in UTC so it can't shift by a day depending on the machine's local timezone offset. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
