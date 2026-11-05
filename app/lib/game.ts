import type { Item, Level, Mode, Placements, ShapePlacements } from "./types";

export function initialPlacements(level: Level): Placements {
  const p: Placements = {};
  for (const n of level.nodes) p[n.id] = n.fixed ? n.answer : null;
  return p;
}

export function initialShapePlacements(level: Level): ShapePlacements {
  return Object.fromEntries(
    level.nodes.map((node) => [
      node.id,
      node.fixed ? itemById(level, node.answer).shape : null,
    ]),
  );
}

export function itemById(level: Level, id: string): Item {
  const item = level.items.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown item ${id}`);
  return item;
}

/** Items that are not currently sitting in a slot. */
export function bankItems(level: Level, placements: Placements): Item[] {
  const used = new Set(Object.values(placements));
  return level.items.filter((i) => !used.has(i.id));
}

/** Put an item in a slot. Moving from another slot swaps the two. */
export function place(
  level: Level,
  placements: Placements,
  slotId: string,
  itemId: string,
): Placements {
  const isFixed = (id: string) => level.nodes.find((n) => n.id === id)?.fixed;
  if (isFixed(slotId)) return placements;

  const source = Object.keys(placements).find((k) => placements[k] === itemId);
  if (source && isFixed(source)) return placements;

  const next = { ...placements };
  const occupant = placements[slotId] ?? null;
  if (source) next[source] = occupant;
  next[slotId] = itemId;
  return next;
}

export function remove(
  level: Level,
  placements: Placements,
  slotId: string,
): Placements {
  if (level.nodes.find((n) => n.id === slotId)?.fixed) return placements;
  return { ...placements, [slotId]: null };
}

export interface CheckResult {
  correct: string[];
  wrong: string[];
  empty: string[];
  solved: boolean;
}

/**
 * Items with identical shape and text are interchangeable, and so are the
 * slots listed together in `level.interchangeable` (steps whose order does
 * not change the result, such as two inputs in a row). When the student
 * draws the arrows, every slot is interchangeable: the arrows decide the
 * flow, so only the set of symbols placed matters, not where they sit.
 */
export function check(
  level: Level,
  placements: Placements,
  drawArrows = false,
): CheckResult {
  const correct: string[] = [];
  const wrong: string[] = [];
  const empty: string[] = [];
  const key = (itemId: string) => {
    const item = itemById(level, itemId);
    return `${item.shape}|${item.text}`;
  };
  const groupOf = new Map<string, string[]>();
  const groups = drawArrows
    ? [level.nodes.map((n) => n.id)]
    : (level.interchangeable ?? []);
  for (const group of groups) {
    for (const id of group) groupOf.set(id, group);
  }
  const remaining = new Map<string[], string[]>();
  for (const group of groupOf.values()) {
    if (remaining.has(group)) continue;
    const answers = group.map((id) => {
      const node = level.nodes.find((n) => n.id === id);
      return node ? key(node.answer) : "";
    });
    remaining.set(group, answers);
  }
  for (const n of level.nodes) {
    const placed = placements[n.id];
    if (!placed) {
      empty.push(n.id);
      continue;
    }
    const group = groupOf.get(n.id);
    if (group) {
      const pool = remaining.get(group) ?? [];
      const i = pool.indexOf(key(placed));
      if (i >= 0) {
        pool.splice(i, 1);
        correct.push(n.id);
      } else {
        wrong.push(n.id);
      }
    } else {
      (key(placed) === key(n.answer) ? correct : wrong).push(n.id);
    }
  }
  return {
    correct,
    wrong,
    empty,
    solved: correct.length === level.nodes.length,
  };
}

export function checkShapes(
  level: Level,
  placements: ShapePlacements,
): CheckResult {
  const correct: string[] = [];
  const wrong: string[] = [];
  const empty: string[] = [];
  for (const node of level.nodes) {
    const placed = placements[node.id];
    if (!placed) {
      empty.push(node.id);
      continue;
    }
    if (placed === itemById(level, node.answer).shape) correct.push(node.id);
    else wrong.push(node.id);
  }
  return {
    correct,
    wrong,
    empty,
    solved: correct.length === level.nodes.length,
  };
}

const KEY = "flowchartfun-progress-v4";
const LEGACY_KEY = "flowchartfun-progress-v3";

type Progress = Record<Mode, number[]>;

function readProgress(): Progress {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? "{}",
    );
    return {
      guided: Array.isArray(parsed.guided) ? parsed.guided : [],
      draw: Array.isArray(parsed.draw) ? parsed.draw : [],
      shapes: Array.isArray(parsed.shapes) ? parsed.shapes : [],
    };
  } catch {
    return { guided: [], draw: [], shapes: [] };
  }
}

export function loadCompleted(mode: Mode): number[] {
  return readProgress()[mode];
}

export function saveCompleted(levelId: number, mode: Mode): number[] {
  const progress = readProgress();
  progress[mode] = Array.from(new Set([...progress[mode], levelId]));
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable */
  }
  return progress[mode];
}
