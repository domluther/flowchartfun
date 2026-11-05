import {
  bankItems,
  check,
  checkShapes,
  initialPlacements,
  initialShapePlacements,
  loadCompleted,
  place,
  remove,
  saveCompleted,
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

describe("interchangeable steps", () => {
  const solved = (level: Level): Placements => {
    const p: Placements = {};
    for (const n of level.nodes) p[n.id] = n.answer;
    return p;
  };

  it("accepts inputs A and B in either order on level 1", () => {
    const level = getLevel(1) as Level;
    const p = solved(level);
    p.inA = "inB";
    p.inB = "inA";
    expect(check(level, p).solved).toBe(true);
  });

  describe("shape checking", () => {
    const level = getLevel(11) as Level;
    const solution = () =>
      Object.fromEntries(
        level.nodes.map((node) => [
          node.id,
          level.items.find((item) => item.id === node.answer)?.shape ?? null,
        ]),
      );

    it("accepts the correct shape in every labelled slot, including fixed nodes", () => {
      expect(checkShapes(level, solution()).solved).toBe(true);
    });

    it("reports incorrect and empty shape slots", () => {
      const placements = solution();
      placements.start = "io";
      placements.in = null;
      const result = checkShapes(level, placements);
      expect(result.solved).toBe(false);
      expect(result.wrong).toContain("start");
      expect(result.empty).toContain("in");
    });

    it("pre-fills fixed shapes", () => {
      const level30 = getLevel(30) as Level;
      const placements = initialShapePlacements(level30);

      expect(placements.start).toBe("terminator");
      expect(placements.in).toBeNull();
      expect(checkShapes(level30, placements).empty).toHaveLength(
        level30.nodes.length - 1,
      );
    });
  });

  it("migrates existing progress into the expanded mode storage", () => {
    localStorage.clear();
    localStorage.setItem(
      "flowchartfun-progress-v3",
      JSON.stringify({ guided: [1], draw: [2] }),
    );

    expect(loadCompleted("guided")).toEqual([1]);
    expect(saveCompleted(3, "shapes")).toEqual([3]);
    expect(
      JSON.parse(localStorage.getItem("flowchartfun-progress-v4") ?? "{}"),
    ).toEqual({ guided: [1], draw: [2], shapes: [3] });
  });

  it("still rejects an independent step swapped with a dependent one", () => {
    const level = getLevel(1) as Level;
    const p = solved(level);
    p.inB = "calc";
    p.calc = "inB";
    const result = check(level, p);
    expect(result.solved).toBe(false);
    expect(result.wrong).toEqual(expect.arrayContaining(["inB", "calc"]));
  });

  it("rejects the same symbol used twice in a group", () => {
    const level = getLevel(1) as Level;
    const p = solved(level);
    p.inB = "inA";
    expect(check(level, p).solved).toBe(false);
  });

  it.each(levels.filter((l) => l.interchangeable))(
    "level $id: every order of each group is accepted",
    (level) => {
      for (const group of level.interchangeable ?? []) {
        const p = solved(level);
        const answers = group.map((id) => p[id]);
        group.forEach((id, i) => {
          p[id] = answers[(i + 1) % group.length];
        });
        expect(check(level, p).solved).toBe(true);
      }
    },
  );

  it("never groups slots holding different kinds of symbol", () => {
    for (const level of levels) {
      for (const group of level.interchangeable ?? []) {
        const shapes = group.map(
          (id) =>
            level.items.find(
              (i) => i.id === level.nodes.find((n) => n.id === id)?.answer,
            )?.shape,
        );
        expect(new Set(shapes).size).toBe(1);
      }
    }
  });
});
