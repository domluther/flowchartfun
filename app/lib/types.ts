export type Shape = "terminator" | "io" | "process" | "decision";
export type Side = "t" | "b" | "l" | "r";

export interface Item {
  id: string;
  shape: Shape;
  text: string;
}

export interface NodeDef {
  id: string;
  col: number;
  row: number;
  /** id of the item that belongs in this slot */
  answer: string;
  /** pre-filled and locked */
  fixed?: boolean;
}

export interface EdgeDef {
  from: string;
  to: string;
  fromSide: Side;
  toSide: Side;
  label?: string;
}

export type Tier = "easy" | "medium" | "hard";

export interface Level {
  id: number;
  tier: Tier;
  title: string;
  topic: string;
  instructions: string;
  items: Item[];
  nodes: NodeDef[];
  edges: EdgeDef[];
  /** Groups of slot ids whose symbols may be placed in any order. */
  interchangeable?: string[][];
}

/** slot id -> placed item id */
export type Placements = Record<string, string | null>;

/** slot id -> drawn shape */
export type ShapePlacements = Record<string, Shape | null>;

export type Mode = "guided" | "draw" | "shapes";
