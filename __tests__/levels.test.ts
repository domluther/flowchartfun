import type { Point } from "../app/lib/layout";
import { NODE_H, NODE_W, nodePos, routeEdge } from "../app/lib/layout";
import { levels, TIERS } from "../app/lib/levels";
import type { EdgeDef, Level } from "../app/lib/types";

interface Segment {
  a: Point;
  b: Point;
  edge: EdgeDef;
}

const segmentsOf = (level: Level): Segment[] =>
  level.edges.flatMap((edge) => {
    const pts = routeEdge(edge, level.nodes);
    return pts.slice(1).map((b, i) => ({ a: pts[i], b, edge }));
  });

const range = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)];

/** True when an axis-aligned segment passes through the inside of a node. */
function crossesNode(s: Segment, level: Level) {
  return level.nodes.filter((n) => {
    const { x, y } = nodePos(n);
    const [x0, x1] = range(s.a.x, s.b.x);
    const [y0, y1] = range(s.a.y, s.b.y);
    return x1 > x && x0 < x + NODE_W && y1 > y && y0 < y + NODE_H;
  });
}

function overlap(s: Segment, t: Segment) {
  const horizontal = (u: Segment) => u.a.y === u.b.y;
  if (horizontal(s) && horizontal(t) && s.a.y === t.a.y) {
    const [a0, a1] = range(s.a.x, s.b.x);
    const [b0, b1] = range(t.a.x, t.b.x);
    return Math.min(a1, b1) - Math.max(a0, b0) > 0;
  }
  if (!horizontal(s) && !horizontal(t) && s.a.x === t.a.x) {
    const [a0, a1] = range(s.a.y, s.b.y);
    const [b0, b1] = range(t.a.y, t.b.y);
    return Math.min(a1, b1) - Math.max(a0, b0) > 0;
  }
  return false;
}

/** Two arrows may share a line only where they leave or enter the same connection point. */
const mayMerge = (e: EdgeDef, f: EdgeDef) =>
  (e.to === f.to && e.toSide === f.toSide) ||
  (e.from === f.from && e.fromSide === f.fromSide);

it("has 10 levels in each tier, numbered in order", () => {
  expect(levels.map((l) => l.id)).toEqual(levels.map((_, i) => i + 1));
  for (const tier of TIERS) {
    expect(levels.filter((l) => l.tier === tier.id)).toHaveLength(10);
  }
  expect(levels.slice(0, 10).every((l) => l.tier === "easy")).toBe(true);
  expect(levels.slice(10, 20).every((l) => l.tier === "medium")).toBe(true);
  expect(levels.slice(20).every((l) => l.tier === "hard")).toBe(true);
});

it("gives every level a unique title", () => {
  const titles = levels.map((l) => l.title);
  expect(new Set(titles).size).toBe(titles.length);
});

describe.each(levels)("level $id: $title (layout and logic)", (level) => {
  const itemOf = (id: string) =>
    level.items.find(
      (i) => i.id === level.nodes.find((n) => n.id === id)?.answer,
    );
  const shapeOf = (id: string) => itemOf(id)?.shape;
  const nodeWithText = (text: string) =>
    level.nodes.find((n) => itemOf(n.id)?.text === text)?.id;

  it("starts with exactly one Start and ends with exactly one End", () => {
    const texts = level.items
      .filter((i) => i.shape === "terminator")
      .map((t) => t.text)
      .sort();
    expect(texts).toEqual(["End", "Start"]);
  });

  it("has no arrows into Start or out of End", () => {
    for (const e of level.edges) {
      expect(e.to).not.toBe(nodeWithText("Start"));
      expect(e.from).not.toBe(nodeWithText("End"));
    }
  });

  it("labels the exits of every decision Yes and No, and nothing else", () => {
    for (const n of level.nodes) {
      const out = level.edges.filter((e) => e.from === n.id);
      if (shapeOf(n.id) === "decision") {
        expect(out.map((e) => e.label).sort()).toEqual(["No", "Yes"]);
      } else {
        expect(out.every((e) => e.label === undefined)).toBe(true);
      }
    }
  });

  it("lets every symbol be reached from Start and reach End", () => {
    const next = new Map<string, string[]>();
    for (const e of level.edges) {
      next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
    }
    const reach = (from: string) => {
      const seen = new Set([from]);
      const queue = [from];
      for (const id of queue) {
        for (const n of next.get(id) ?? []) {
          if (!seen.has(n)) {
            seen.add(n);
            queue.push(n);
          }
        }
      }
      return seen;
    };
    const startId = nodeWithText("Start") as string;
    const endId = nodeWithText("End") as string;
    expect(reach(startId).size).toBe(level.nodes.length);
    for (const n of level.nodes) {
      expect(reach(n.id).has(endId)).toBe(true);
    }
  });

  it("only uses distractors that are not part of the answer", () => {
    const answers = new Set(level.nodes.map((n) => n.answer));
    const extras = level.items.filter((i) => !answers.has(i.id));
    for (const x of extras) expect(x.id).toMatch(/^distractor-/);
    for (const n of level.nodes) {
      expect(level.items.some((i) => i.id === n.answer)).toBe(true);
    }
  });

  it("fits within three columns", () => {
    expect(Math.max(...level.nodes.map((n) => n.col))).toBeLessThanOrEqual(2);
    expect(Math.min(...level.nodes.map((n) => n.col))).toBeGreaterThanOrEqual(
      0,
    );
  });

  it("draws no arrow through a symbol", () => {
    for (const s of segmentsOf(level)) {
      expect(crossesNode(s, level)).toEqual([]);
    }
  });

  it("never lets two arrows run along the same line", () => {
    const segs = segmentsOf(level);
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        if (segs[i].edge === segs[j].edge) continue;
        if (mayMerge(segs[i].edge, segs[j].edge)) continue;
        expect(overlap(segs[i], segs[j])).toBe(false);
      }
    }
  });
});
