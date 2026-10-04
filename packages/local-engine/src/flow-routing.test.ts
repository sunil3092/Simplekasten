import { describe, expect, it } from "vitest";
import { flowPathCrosses, routeFlowEdge, type FlowRect } from "./flow-routing";

const card = (x: number, y: number): FlowRect => ({ x, y, width: 260, height: 170 });

describe("routeFlowEdge", () => {
  it("draws a straight line between the facing borders when nothing is in the way", () => {
    const points = routeFlowEdge(card(0, 0), card(0, 270), []);
    expect(points).toEqual([
      { x: 130, y: 170 },
      { x: 130, y: 270 },
    ]);
  });

  it("leaves from the side when the target sits beside the source", () => {
    const points = routeFlowEdge(card(0, 0), card(600, 0), []);
    expect(points).toEqual([
      { x: 260, y: 85 },
      { x: 600, y: 85 },
    ]);
  });

  it("bends around a card sitting between the two ends", () => {
    const from = card(0, 0);
    const middle = card(0, 270);
    const to = card(0, 540);
    const points = routeFlowEdge(from, to, [middle]);
    expect(points.length).toBeGreaterThan(2);
    expect(flowPathCrosses(points, middle)).toBe(false);
  });

  it("clears every card on a long diagonal through a grid", () => {
    const from = card(0, 0);
    const to = card(680, 810);
    const others = [card(340, 270), card(0, 270), card(340, 540), card(680, 540), card(0, 540)];
    const points = routeFlowEdge(from, to, others);
    for (const other of others) expect(flowPathCrosses(points, other)).toBe(false);
  });

  it("ignores a card that overlaps one of the ends instead of looping", () => {
    const from = card(0, 0);
    const to = card(0, 540);
    const points = routeFlowEdge(from, to, [card(40, 40)]);
    expect(points).toHaveLength(2);
  });
});
