// Text typed into a note is saved a moment after the typing stops. Anything
// that must happen after that save — changing the note's type, deleting it,
// moving to another note — has to wait for the write to land, including one
// that has already started: two writes to the same note at once each read the
// file, change their part and write it back, and the slower one undoes the
// other. This keeps one note's saves in a single line.

export interface PendingSaver<T, R> {
  /** What should be saved next; replaces anything still waiting. */
  set(value: T): void;
  /** Forget what is waiting (the note is being deleted). A save already on its way still finishes. */
  clear(): void;
  hasPending(): boolean;
  /**
   * Waits for any save on its way, then saves what is waiting. Resolves with
   * that save's result, or `undefined` if nothing was waiting. If the save
   * fails, what it was saving goes back to waiting — unless something newer
   * has been set — and the error is rethrown.
   */
  flush(): Promise<R | undefined>;
}

export function createPendingSaver<T, R = unknown>(save: (value: T) => Promise<R>): PendingSaver<T, R> {
  let pending: { value: T } | null = null;
  let inFlight: Promise<unknown> = Promise.resolve();

  return {
    set(value) {
      pending = { value };
    },
    clear() {
      pending = null;
    },
    hasPending: () => pending !== null,
    async flush() {
      // Another flush may start a save while this one waits; wait for that too.
      for (;;) {
        const running = inFlight;
        await running.catch(() => {});
        if (inFlight === running) break;
      }
      const taken = pending;
      pending = null;
      if (!taken) return undefined;
      const run = save(taken.value).catch((error: unknown) => {
        if (!pending) pending = taken;
        throw error;
      });
      inFlight = run;
      return run;
    },
  };
}
