import {
  addEdge,
  checkEdges,
  isDecision,
  pruneEdges,
  removeEdge,
  setLabel,
  type UserEdge,
} from "../app/lib/edges";
import { nearestSide } from "../app/lib/layout";
import { getLevel, levels } from "../app/lib/levels";
import type { Level } from "../app/lib/types";

const level = getLevel(5) as Level; // start → in0 → dec ─Yes→ yes, ─No→ no → end

/** The student's perfect answer, built through the public API. */
function perfect(l: Level): UserEdge[] {
  let edges: UserEdge[] = [];
  for (const e of l.edges) {
    edges = addEdge(edges, e.from, e.fromSide, e.to, e.toSide).edges;
    if (e.label)
      edges = setLabel(edges, `${e.from}->${e.to}`, e.label as "Yes");
  }
  return edges;
}

describe.each(levels)("level $id arrows", (l) => {
  it("is solved by the intended arrows and not by none", () => {
    expect(checkEdges(l, perfect(l)).solved).toBe(true);
    expect(checkEdges(l, []).solved).toBe(false);
    expect(checkEdges(l, []).missing).toBe(l.edges.length);
  });

  it("only labels arrows leaving decisions, with Yes or No", () => {
    const decisions = new Set(
      l.nodes
        .filter(
          (n) => l.items.find((i) => i.id === n.answer)?.shape === "decision",
        )
        .map((n) => n.id),
    );
    for (const e of l.edges) {
      expect(Boolean(e.label)).toBe(decisions.has(e.from));
      if (e.label) expect(["Yes", "No"]).toContain(e.label);
    }
  });

  it("has at most one arrow per from→to pair", () => {
    const ids = l.edges.map((e) => `${e.from}->${e.to}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("drawing arrows", () => {
  it("ignores self-loops and duplicates", () => {
    const a = addEdge([], "start", "b", "in0", "t");
    expect(a.created).toBe(true);
    expect(addEdge(a.edges, "start", "r", "in0", "l").created).toBe(false);
    expect(addEdge(a.edges, "in0", "b", "in0", "t").created).toBe(false);
  });

  it("removes and relabels arrows", () => {
    let edges = addEdge([], "dec", "l", "yes", "t").edges;
    edges = setLabel(edges, "dec->yes", "No");
    expect(edges[0].label).toBe("No");
    expect(removeEdge(edges, "dec->yes")).toEqual([]);
  });

  it("drops arrows whose symbol was removed", () => {
    const edges = addEdge([], "start", "b", "in0", "t").edges;
    expect(pruneEdges(edges, { start: "start", in: null })).toEqual([]);
    expect(pruneEdges(edges, { start: "start", in0: "in0" })).toEqual(edges);
  });

  it("detects decision symbols", () => {
    expect(isDecision(level, { dec: "dec" }, "dec")).toBe(true);
    expect(isDecision(level, { in0: "in0" }, "in0")).toBe(false);
    expect(isDecision(level, { dec: null }, "dec")).toBe(false);
  });
});

describe("checking arrows", () => {
  it("rejects swapped Yes and No", () => {
    const swapped = perfect(level).map((e) =>
      e.label ? { ...e, label: e.label === "Yes" ? "No" : "Yes" } : e,
    );
    const r = checkEdges(level, swapped);
    expect(r.solved).toBe(false);
    expect(r.wrong).toHaveLength(2);
    expect(r.missing).toBe(2);
  });

  it("rejects an unlabelled decision arrow", () => {
    const edges = perfect(level).map((e) => ({ ...e, label: undefined }));
    expect(checkEdges(level, edges).correct).not.toContain("dec->yes");
    expect(checkEdges(level, edges).solved).toBe(false);
  });

  it("rejects extra arrows even when every required one is present", () => {
    const extra = addEdge(perfect(level), "yes", "r", "no", "l").edges;
    const r = checkEdges(level, extra);
    expect(r.solved).toBe(false);
    expect(r.wrong).toEqual(["yes->no"]);
    expect(r.missing).toBe(0);
  });

  it("rejects arrows pointing the wrong way", () => {
    const reversed = perfect(level).map((e) =>
      e.id === "start->in0"
        ? { ...e, id: "in0->start", from: "in0", to: "start" }
        : e,
    );
    expect(checkEdges(level, reversed).solved).toBe(false);
  });

  it("does not care which sides an arrow uses", () => {
    const edges = perfect(level).map((e) => ({
      ...e,
      fromSide: "r" as const,
      toSide: "l" as const,
    }));
    expect(checkEdges(level, edges).solved).toBe(true);
  });
});

describe("nearestSide", () => {
  const node = { id: "n", col: 0, row: 0, answer: "n" };
  it("picks the side closest to the pointer", () => {
    expect(nearestSide(node, { x: 140, y: 40 })).toBe("t");
    expect(nearestSide(node, { x: 140, y: 120 })).toBe("b");
    expect(nearestSide(node, { x: 45, y: 80 })).toBe("l");
    expect(nearestSide(node, { x: 235, y: 80 })).toBe("r");
  });
});
