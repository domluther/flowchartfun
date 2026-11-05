import {
  bankItems,
  check,
  initialPlacements,
  place,
  remove,
} from "../app/lib/game";
import { routeEdge } from "../app/lib/layout";
import { getLevel, levels } from "../app/lib/levels";
import type { Level, Placements } from "../app/lib/types";

describe.each(levels)("level $id: $title", (level) => {
  const solution = (): Placements =>
    Object.fromEntries(level.nodes.map((n) => [n.id, n.answer]));

  it("has unique node ids and valid edges", () => {
    const ids = level.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of level.edges) {
      expect(ids).toContain(e.from);
      expect(ids).toContain(e.to);
      expect(routeEdge(e, level.nodes).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has no two nodes on the same grid cell", () => {
    const cells = level.nodes.map((n) => `${n.col},${n.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("is solved by its own solution and not by an empty board", () => {
    expect(check(level, solution()).solved).toBe(true);
    expect(check(level, initialPlacements(level)).solved).toBe(false);
  });

  it("offers every non-fixed answer in the bank", () => {
    const bank = bankItems(level, initialPlacements(level)).map((i) => i.id);
    for (const n of level.nodes.filter((n) => !n.fixed)) {
      expect(bank).toContain(n.answer);
    }
  });
});

describe("placement", () => {
  const level = levels[0];

  it("places an item and removes it from the bank", () => {
    const p = place(level, initialPlacements(level), "start", "start");
    expect(p.start).toBe("start");
    expect(bankItems(level, p).map((i) => i.id)).not.toContain("start");
  });

  it("swaps when moving between occupied slots", () => {
    let p = place(level, initialPlacements(level), "start", "start");
    p = place(level, p, "inA", "inA");
    p = place(level, p, "inA", "start");
    expect(p.inA).toBe("start");
    expect(p.start).toBe("inA");
  });

  it("returns the previous occupant to the bank when replaced", () => {
    let p = place(level, initialPlacements(level), "start", "start");
    p = place(level, p, "start", "end");
    expect(bankItems(level, p).map((i) => i.id)).toContain("start");
  });

  it("marks wrong placements", () => {
    const p = place(level, initialPlacements(level), "start", "end");
    expect(check(level, p).wrong).toEqual(["start"]);
  });

  it("cannot change fixed slots", () => {
    const l = getLevel(11) as Level;
    const p = initialPlacements(l);
    expect(remove(l, p, "start")).toBe(p);
    expect(place(l, p, "start", "in")).toBe(p);
  });
});
