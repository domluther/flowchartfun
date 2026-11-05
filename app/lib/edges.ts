import type { EdgeDef, Level, Placements, Side } from "./types";

export type EdgeLabel = "Yes" | "No";

/** An arrow drawn by the student. Its id is unique because each from→to pair can only exist once. */
export interface UserEdge extends EdgeDef {
  id: string;
}

export function isDecision(
  level: Level,
  placements: Placements,
  slotId: string,
): boolean {
  const itemId = placements[slotId];
  return level.items.find((i) => i.id === itemId)?.shape === "decision";
}

export function addEdge(
  edges: UserEdge[],
  from: string,
  fromSide: Side,
  to: string,
  toSide: Side,
): { edges: UserEdge[]; id: string; created: boolean } {
  const id = `${from}->${to}`;
  if (from === to || edges.some((e) => e.id === id)) {
    return { edges, id, created: false };
  }
  return {
    edges: [...edges, { id, from, fromSide, to, toSide }],
    id,
    created: true,
  };
}

export function setLabel(
  edges: UserEdge[],
  id: string,
  label: EdgeLabel | undefined,
): UserEdge[] {
  return edges.map((e) => (e.id === id ? { ...e, label } : e));
}

export function removeEdge(edges: UserEdge[], id: string): UserEdge[] {
  return edges.filter((e) => e.id !== id);
}

/** Drop arrows attached to a slot that no longer holds a symbol. */
export function pruneEdges(
  edges: UserEdge[],
  placements: Placements,
): UserEdge[] {
  return edges.filter((e) => placements[e.from] && placements[e.to]);
}

export interface EdgeCheck {
  correct: string[];
  wrong: string[];
  /** expected arrows the student has not drawn (or has drawn with the wrong label) */
  missing: number;
  solved: boolean;
}

/**
 * Arrows are compared by where they start, where they end and their Yes/No
 * label. Which sides they use does not matter. When placements are given,
 * arrows are compared by the symbols they connect rather than by slot, so a
 * Yes arrow may lead to either side as long as it reaches the right symbol.
 */
export function checkEdges(
  level: Level,
  edges: UserEdge[],
  placements?: Placements,
): EdgeCheck {
  const symbol = (slot: string, placed: boolean) => {
    const itemId = placed
      ? placements?.[slot]
      : level.nodes.find((n) => n.id === slot)?.answer;
    const item = level.items.find((i) => i.id === itemId);
    return item ? `${item.shape}|${item.text}` : slot;
  };
  const end = (slot: string, placed: boolean) =>
    placements ? symbol(slot, placed) : slot;
  const unmatched = [...level.edges];
  const correct: string[] = [];
  const wrong: string[] = [];
  for (const e of edges) {
    const i = unmatched.findIndex(
      (x) =>
        end(x.from, false) === end(e.from, true) &&
        end(x.to, false) === end(e.to, true) &&
        (x.label ?? null) === (e.label ?? null),
    );
    if (i >= 0) {
      unmatched.splice(i, 1);
      correct.push(e.id);
    } else {
      wrong.push(e.id);
    }
  }
  return {
    correct,
    wrong,
    missing: unmatched.length,
    solved: wrong.length === 0 && unmatched.length === 0,
  };
}
