import type { EdgeDef, NodeDef, Side } from "./types";

export const NODE_W = 200;
export const NODE_H = 80;
const GAP_X = 70;
const GAP_Y = 44;
const PAD = 40;
const STUB = 24;

export interface Point {
  x: number;
  y: number;
}

export function nodePos(n: Pick<NodeDef, "col" | "row">): Point {
  return {
    x: PAD + n.col * (NODE_W + GAP_X),
    y: PAD + n.row * (NODE_H + GAP_Y),
  };
}

export function canvasSize(nodes: NodeDef[]) {
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  return {
    width: PAD * 2 + cols * NODE_W + (cols - 1) * GAP_X,
    height: PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y,
  };
}

export function anchor(n: NodeDef, side: Side): Point {
  const { x, y } = nodePos(n);
  switch (side) {
    case "t":
      return { x: x + NODE_W / 2, y };
    case "b":
      return { x: x + NODE_W / 2, y: y + NODE_H };
    case "l":
      return { x, y: y + NODE_H / 2 };
    case "r":
      return { x: x + NODE_W, y: y + NODE_H / 2 };
  }
}

function stub(p: Point, side: Side): Point {
  switch (side) {
    case "t":
      return { x: p.x, y: p.y - STUB };
    case "b":
      return { x: p.x, y: p.y + STUB };
    case "l":
      return { x: p.x - STUB, y: p.y };
    case "r":
      return { x: p.x + STUB, y: p.y };
  }
}

const vertical = (s: Side) => s === "t" || s === "b";

function findNode(nodes: NodeDef[], id: string): NodeDef {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Unknown node ${id}`);
  return node;
}

/** Orthogonal route between two node sides. */
export function routeEdge(edge: EdgeDef, nodes: NodeDef[]): Point[] {
  const from = findNode(nodes, edge.from);
  const to = findNode(nodes, edge.to);
  const a = anchor(from, edge.fromSide);
  const b = anchor(to, edge.toSide);
  const p1 = stub(a, edge.fromSide);
  const p2 = stub(b, edge.toSide);

  const pts: Point[] = [a, p1];
  const av = vertical(edge.fromSide);
  const bv = vertical(edge.toSide);
  if (av && bv) {
    if (p1.x !== p2.x) {
      const midY = (p1.y + p2.y) / 2;
      pts.push({ x: p1.x, y: midY }, { x: p2.x, y: midY });
    }
  } else if (!av && !bv) {
    if (p1.y !== p2.y) {
      const x =
        edge.fromSide === edge.toSide
          ? Math.min(p1.x, p2.x)
          : (p1.x + p2.x) / 2;
      pts.push({ x, y: p1.y }, { x, y: p2.y });
    }
  } else if (av) {
    pts.push({ x: p1.x, y: p2.y });
  } else {
    pts.push({ x: p2.x, y: p1.y });
  }
  pts.push(p2, b);

  return pts.filter(
    (p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y,
  );
}

/** Label position beside the first segment leaving a node. */
export function labelPos(
  points: Point[],
): Point & { anchor: "start" | "middle" } {
  const [a, b] = points;
  if (a.x === b.x)
    return { x: a.x + 8, y: (a.y + b.y) / 2 + 4, anchor: "start" };
  return { x: (a.x + b.x) / 2, y: a.y - 6, anchor: "middle" };
}

/** The side of a node whose connection point is closest to a point. */
export function nearestSide(n: NodeDef, p: Point): Side {
  const sides: Side[] = ["t", "b", "l", "r"];
  let best = sides[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const side of sides) {
    const a = anchor(n, side);
    const d = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
    if (d < bestDist) {
      best = side;
      bestDist = d;
    }
  }
  return best;
}

/** Middle of the middle segment of a routed path. */
export function pathMidpoint(points: Point[]): Point {
  const i = Math.floor((points.length - 1) / 2);
  const a = points[i];
  const b = points[i + 1] ?? a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
