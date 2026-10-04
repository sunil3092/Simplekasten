import { describe, expect, it } from "vitest";
import { createPendingSaver } from "./pending-save";

/** A save that only finishes when the test says so. */
function controlledSave() {
  const calls: { value: string; finish: () => void; fail: () => void }[] = [];
  const save = (value: string) =>
    new Promise<string>((resolve, reject) => {
      calls.push({ value, finish: () => resolve(`saved ${value}`), fail: () => reject(new Error("disk full")) });
    });
  return { calls, save };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createPendingSaver", () => {
  it("saves what is waiting, once, and hands back the save's result", async () => {
    const { calls, save } = controlledSave();
    const saver = createPendingSaver(save);
    saver.set("a");
    saver.set("ab");

    const flushed = saver.flush();
    await tick();
    expect(calls.map((c) => c.value)).toEqual(["ab"]);
    calls[0].finish();
    expect(await flushed).toBe("saved ab");

    expect(await saver.flush()).toBeUndefined();
    expect(calls).toHaveLength(1);
  });

  it("makes a flush wait for a save that is already on its way", async () => {
    const { calls, save } = controlledSave();
    const saver = createPendingSaver(save);
    saver.set("text");
    void saver.flush();
    await tick();

    // Nothing is waiting any more, but the write has not landed yet.
    let done = false;
    const second = saver.flush().then(() => (done = true));
    await tick();
    expect(done).toBe(false);

    calls[0].finish();
    await second;
    expect(done).toBe(true);
  });

  it("writes one save after another, never two at once", async () => {
    const { calls, save } = controlledSave();
    const saver = createPendingSaver(save);
    saver.set("first");
    void saver.flush();
    await tick();
    saver.set("second");
    const later = saver.flush();
    await tick();
    expect(calls.map((c) => c.value)).toEqual(["first"]);

    calls[0].finish();
    await tick();
    expect(calls.map((c) => c.value)).toEqual(["first", "second"]);
    calls[1].finish();
    expect(await later).toBe("saved second");
  });

  it("keeps a failed save waiting, so the next flush tries it again", async () => {
    const { calls, save } = controlledSave();
    const saver = createPendingSaver(save);
    saver.set("text");
    const failed = saver.flush();
    await tick();
    calls[0].fail();
    await expect(failed).rejects.toThrow("disk full");
    expect(saver.hasPending()).toBe(true);

    const retried = saver.flush();
    await tick();
    expect(calls.map((c) => c.value)).toEqual(["text", "text"]);
    calls[1].finish();
    expect(await retried).toBe("saved text");
  });

  it("does not put a failed save back over something newer", async () => {
    const { calls, save } = controlledSave();
    const saver = createPendingSaver(save);
    saver.set("old");
    const failed = saver.flush();
    await tick();
    saver.set("new");
    calls[0].fail();
    await expect(failed).rejects.toThrow();

    const retried = saver.flush();
    await tick();
    expect(calls[1].value).toBe("new");
    calls[1].finish();
    await retried;
  });

  it("drops what is waiting on clear, but still waits for a save in flight", async () => {
    const { calls, save } = controlledSave();
    const saver = createPendingSaver(save);
    saver.set("first");
    void saver.flush();
    await tick();
    saver.set("never written");
    saver.clear();

    let done = false;
    const flushed = saver.flush().then(() => (done = true));
    await tick();
    expect(done).toBe(false);
    calls[0].finish();
    await flushed;
    expect(calls).toHaveLength(1);
  });

  it("a flush after a failure does not rethrow the old failure once nothing is waiting", async () => {
    const { calls, save } = controlledSave();
    const saver = createPendingSaver(save);
    saver.set("text");
    const failed = saver.flush();
    await tick();
    calls[0].fail();
    await expect(failed).rejects.toThrow();
    saver.clear();
    await expect(saver.flush()).resolves.toBeUndefined();
  });
});
