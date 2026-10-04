import { describe, expect, it } from "vitest";
import {
  FLOW_CARD,
  FLOW_UNTAGGED,
  filterFlowNodes,
  flowAutoPositions,
  flowRoutes,
  flowTagOptions,
  placeFlowCards,
  roundedFlowPath,
} from "./flow-view";

describe("flowAutoPositions", () => {
  it("puts each layer on its own row, centred on x = 0", () => {
    const positions = flowAutoPositions([
      { id: "root", layer: 0, order: 0 },
      { id: "left", layer: 1, order: 0 },
      { id: "right", layer: 1, order: 1 },
    ]);
    expect(positions.get("root")).toEqual({ x: 0, y: 0 });
    expect(positions.get("left")).toEqual({ x: -FLOW_CARD.columnWidth / 2, y: FLOW_CARD.layerHeight });
    expect(positions.get("right")).toEqual({ x: FLOW_CARD.columnWidth / 2, y: FLOW_CARD.layerHeight });
  });
});

describe("placeFlowCards", () => {
  const auto = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 340, y: 0 }],
  ]);

  it("keeps a dragged card where it was put and the rest on the automatic layout", () => {
    const placed = placeFlowCards(auto, new Map([["a", { x: 900, y: 500 }]]));
    expect(placed.get("a")).toEqual({ x: 900, y: 500 });
    expect(placed.get("b")).toEqual({ x: 340, y: 0 });
  });

  it("steps an automatic card sideways when a dragged card is parked on its slot", () => {
    const placed = placeFlowCards(auto, new Map([["a", { x: 350, y: 10 }]]));
    expect(placed.get("b")).toEqual({ x: 340 + FLOW_CARD.columnWidth, y: 0 });
  });

  it("ignores a remembered position for a card that is not on the flow", () => {
    const placed = placeFlowCards(auto, new Map([["gone", { x: 0, y: 0 }]]));
    expect([...placed.keys()]).toEqual(["a", "b"]);
    expect(placed.get("a")).toEqual({ x: 0, y: 0 });
  });
});

describe("flowRoutes", () => {
  const positions = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 0, y: 540 }],
  ]);

  it("draws one path per edge between cards that are both showing", () => {
    const routes = flowRoutes(
      [
        { source: "a", target: "b" },
        { source: "a", target: "hidden" },
        { source: "a", target: "a" },
      ],
      positions,
    );
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ source: "a", target: "b" });
    // Straight down from the bottom edge of a to the top edge of b.
    expect(routes[0].d).toBe(`M ${FLOW_CARD.width / 2} ${FLOW_CARD.height} L ${FLOW_CARD.width / 2} 540`);
  });

  it("bends the path around a card standing between the two", () => {
    const withBlocker = new Map([...positions, ["c", { x: 0, y: 270 }]]);
    const [route] = flowRoutes([{ source: "a", target: "b" }], withBlocker);
    expect(route.d).toContain("Q");
  });
});

describe("roundedFlowPath", () => {
  it("leaves a two-point path straight", () => {
    expect(
      roundedFlowPath([
        { x: 0, y: 0 },
        { x: 0, y: 100 },
      ]),
    ).toBe("M 0 0 L 0 100");
  });
});

describe("filterFlowNodes", () => {
  const nodes = [
    { id: "a", type: "permanent" },
    { id: "b", type: "fleeting" },
    { id: "j", type: "daily" },
    { id: "u", type: "fleeting" },
  ];
  const tags = new Map([
    ["a", ["method"]],
    ["b", ["habits", "method"]],
    ["j", ["journalentry"]],
    ["u", []],
  ]);
  const ids = (options: Parameters<typeof filterFlowNodes>[2]) => filterFlowNodes(nodes, tags, options).map((n) => n.id);

  it("shows everything with no filter", () => {
    expect(ids({ filterTags: [], hideJournal: false, keepId: null })).toEqual(["a", "b", "j", "u"]);
  });

  it("keeps notes carrying any chosen tag", () => {
    expect(ids({ filterTags: ["habits"], hideJournal: false, keepId: null })).toEqual(["b"]);
    expect(ids({ filterTags: ["habits", "journalentry"], hideJournal: false, keepId: null })).toEqual(["b", "j"]);
  });

  it("offers notes with no tags under the untagged value", () => {
    expect(ids({ filterTags: [FLOW_UNTAGGED], hideJournal: false, keepId: null })).toEqual(["u"]);
  });

  it("hides journal entries on request", () => {
    expect(ids({ filterTags: [], hideJournal: true, keepId: null })).toEqual(["a", "b", "u"]);
  });

  it("keeps the card being edited even when it no longer matches", () => {
    expect(ids({ filterTags: ["habits"], hideJournal: true, keepId: "j" })).toEqual(["b", "j"]);
  });
});

describe("flowTagOptions", () => {
  it("counts each tag, sorts by name, and adds Untagged last when needed", () => {
    const options = flowTagOptions(
      new Map([
        ["a", ["method"]],
        ["b", ["habits", "method"]],
        ["u", []],
      ]),
    );
    expect(options).toEqual([
      { value: "habits", label: "#habits", count: 1 },
      { value: "method", label: "#method", count: 2 },
      { value: FLOW_UNTAGGED, label: "Untagged", count: 1 },
    ]);
  });

  it("leaves Untagged out when every note has a tag", () => {
    expect(flowTagOptions(new Map([["a", ["x"]]])).map((o) => o.value)).toEqual(["x"]);
  });
});
