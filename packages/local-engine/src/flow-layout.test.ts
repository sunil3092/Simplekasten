import { describe, expect, it } from "vitest";
import { layoutFlow } from "./flow-layout";
import type { GraphEdge, GraphNode } from "./types";

function node(id: string): GraphNode {
  return { id, title: id, zettelId: id, type: "fleeting" };
}

function byId(result: ReturnType<typeof layoutFlow>) {
  return new Map(result.map((n) => [n.id, n]));
}

describe("layoutFlow", () => {
  it("lays out a linear chain one layer per hop", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const result = byId(layoutFlow(nodes, edges));
    expect(result.get("a")?.layer).toBe(0);
    expect(result.get("b")?.layer).toBe(1);
    expect(result.get("c")?.layer).toBe(2);
  });

  it("puts branching children in the same layer, ordered deterministically", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
    ];
    const result = byId(layoutFlow(nodes, edges));
    expect(result.get("a")?.layer).toBe(0);
    expect(result.get("b")?.layer).toBe(1);
    expect(result.get("c")?.layer).toBe(1);
    expect(result.get("b")?.order).not.toBe(result.get("c")?.order);
  });

  it("places a diamond's convergence point at the longer path's depth", () => {
    const nodes = [node("a"), node("b"), node("c"), node("d")];
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "d" },
      { source: "c", target: "d" },
    ];
    const result = byId(layoutFlow(nodes, edges));
    expect(result.get("a")?.layer).toBe(0);
    expect(result.get("b")?.layer).toBe(1);
    expect(result.get("c")?.layer).toBe(1);
    expect(result.get("d")?.layer).toBe(2);
  });

  it("breaks a cycle by dropping the back edge, not crashing or looping forever", () => {
    const nodes = [node("a"), node("b")];
    const edges: GraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ];
    const result = byId(layoutFlow(nodes, edges));
    expect(result.get("a")?.layer).toBe(0);
    expect(result.get("b")?.layer).toBe(1);
  });

  it("gives every disconnected node its own layer-0 root", () => {
    const nodes = [node("a"), node("b")];
    const result = byId(layoutFlow(nodes, []));
    expect(result.get("a")?.layer).toBe(0);
    expect(result.get("b")?.layer).toBe(0);
  });

  it("ignores a self-loop", () => {
    const nodes = [node("a")];
    const edges: GraphEdge[] = [{ source: "a", target: "a" }];
    const result = byId(layoutFlow(nodes, edges));
    expect(result.get("a")?.layer).toBe(0);
  });

  it("ignores edges to/from nodes not in the node list", () => {
    const nodes = [node("a")];
    const edges: GraphEdge[] = [{ source: "a", target: "ghost" }];
    expect(() => layoutFlow(nodes, edges)).not.toThrow();
    expect(byId(layoutFlow(nodes, edges)).get("a")?.layer).toBe(0);
  });

  it("orders a layer by the barycenter of its parents' positions", () => {
    // Two layer-0 roots x (order 0, alphabetically first) and y (order 1);
    // w's only parent is x and z's only parent is y, so w should land on
    // x's side (order 0) and z on y's side (order 1), not swapped.
    const nodes = [node("x"), node("y"), node("w"), node("z")];
    const edges: GraphEdge[] = [
      { source: "x", target: "w" },
      { source: "y", target: "z" },
    ];
    const result = byId(layoutFlow(nodes, edges));
    expect(result.get("x")?.order).toBe(0);
    expect(result.get("y")?.order).toBe(1);
    expect(result.get("w")?.order).toBe(0);
    expect(result.get("z")?.order).toBe(1);
  });

  it("returns an empty layout for an empty graph", () => {
    expect(layoutFlow([], [])).toEqual([]);
  });
});
