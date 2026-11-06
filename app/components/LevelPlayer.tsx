import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  addEdge,
  checkEdges,
  type EdgeCheck,
  type EdgeLabel,
  isDecision,
  pruneEdges,
  removeEdge,
  setLabel,
  type UserEdge,
} from "../lib/edges";
import {
  bankItems,
  type CheckResult,
  check,
  checkShapes,
  initialPlacements,
  initialShapePlacements,
  itemById,
  place,
  remove,
  saveCompleted,
} from "../lib/game";
import {
  anchor,
  canvasSize,
  NODE_H,
  NODE_W,
  nearestSide,
  nodePos,
  type Point,
  pathMidpoint,
  routeEdge,
} from "../lib/layout";
import { MODE_OPTIONS, withMode } from "../lib/mode";
import type {
  EdgeDef,
  Item,
  Level,
  Mode,
  NodeDef,
  Placements,
  Shape,
  ShapePlacements,
  Side,
} from "../lib/types";
import { ArrowLayer, type ArrowView } from "./ArrowLayer";
import { Block } from "./Block";
import { CodePanel } from "./CodePanel";

interface Endpoint {
  slot: string;
  side: Side;
}

interface ShapeDrag {
  shape: Shape;
  pointerId: number;
}

interface Result {
  slots: CheckResult;
  edges: EdgeCheck | null;
  labels: EdgeCheck | null;
  solved: boolean;
}

const SIDES: Side[] = ["t", "b", "l", "r"];
const SIDE_NAME: Record<Side, string> = {
  t: "top",
  b: "bottom",
  l: "left",
  r: "right",
};
const HANDLE_POS: Record<Side, string> = {
  t: "left-1/2 top-0",
  b: "left-1/2 top-full",
  l: "left-0 top-1/2",
  r: "left-full top-1/2",
};
const SHAPE_TOOLS: {
  shape: Shape;
  label: string;
  item: Item;
}[] = [
  {
    shape: "terminator",
    label: "Stadium (start/stop)",
    item: { id: "tool-terminator", shape: "terminator", text: "Start" },
  },
  {
    shape: "io",
    label: "Parallelogram (input/output)",
    item: { id: "tool-io", shape: "io", text: "Input/Output" },
  },
  {
    shape: "process",
    label: "Rectangle (process)",
    item: { id: "tool-process", shape: "process", text: "Process" },
  },
  {
    shape: "decision",
    label: "Rhombus (decision)",
    item: { id: "tool-decision", shape: "decision", text: "Decision" },
  },
];

function isShape(value: string): value is Shape {
  return SHAPE_TOOLS.some((tool) => tool.shape === value);
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function clientToCanvas(
  canvas: HTMLElement | null,
  clientX: number,
  clientY: number,
): Point {
  const r = canvas?.getBoundingClientRect();
  return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
}

/** The side of the target that faces the point the arrow starts from. */
function facingSide(level: Level, from: Endpoint, target: NodeDef): Side {
  const source = level.nodes.find((n) => n.id === from.slot);
  return source ? nearestSide(target, anchor(source, from.side)) : "t";
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function feedback(level: Level, r: Result, drawShapes: boolean) {
  const parts: string[] = [];
  const noun = drawShapes ? "shapes" : "symbols";
  if (!r.slots.solved) {
    parts.push(
      `${r.slots.correct.length} of ${level.nodes.length} ${noun} correct${
        r.slots.empty.length
          ? `, ${plural(r.slots.empty.length, "slot")} still empty`
          : ""
      }.`,
    );
  } else {
    parts.push(`All the ${noun} are in the right place.`);
  }
  if (r.edges && !r.edges.solved) {
    const e = r.edges;
    parts.push(
      `${e.correct.length} of ${level.edges.length} arrows correct${
        e.missing ? `, ${e.missing} still to draw` : ""
      }.${e.wrong ? " Red arrows are wrong, or a diamond arrow is missing its Yes/No label." : ""}`,
    );
  }
  if (r.labels && !r.labels.solved) {
    const total =
      r.labels.correct.length + r.labels.wrong.length + r.labels.missing;
    parts.push(
      `${r.labels.correct.length} of ${total} Yes/No labels correct${
        r.labels.missing ? `, ${r.labels.missing} still to place` : ""
      }.`,
    );
  }
  return parts.join(" ");
}

const edgeId = (edge: EdgeDef) => `${edge.from}->${edge.to}`;

function isDecisionNode(level: Level, nodeId: string) {
  const node = level.nodes.find((candidate) => candidate.id === nodeId);
  return (
    node !== undefined &&
    level.items.find((item) => item.id === node.answer)?.shape === "decision"
  );
}

export function LevelPlayer({
  level,
  mode = "guided",
  previousId,
  nextId,
}: {
  level: Level;
  mode?: Mode;
  previousId?: number;
  nextId?: number;
}) {
  const draw = mode === "draw";
  const drawShapes = mode === "shapes";
  const [placements, setPlacements] = useState<Placements>(() =>
    initialPlacements(level),
  );
  const [shapePlacements, setShapePlacements] = useState<ShapePlacements>(() =>
    initialShapePlacements(level),
  );
  const [shapeEdgeLabels, setShapeEdgeLabels] = useState<
    Record<string, EdgeLabel | null>
  >({});
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [shapeDrag, setShapeDrag] = useState<ShapeDrag | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [edges, setEdges] = useState<UserEdge[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [pending, setPending] = useState<Endpoint | null>(null);
  const [dragFrom, setDragFrom] = useState<Endpoint | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const bank = useMemo(
    () =>
      bankItems(level, placements).sort(
        (a, b) =>
          SHAPE_TOOLS.findIndex((tool) => tool.shape === a.shape) -
            SHAPE_TOOLS.findIndex((tool) => tool.shape === b.shape) ||
          hash(level.id + a.id) - hash(level.id + b.id),
      ),
    [level, placements],
  );
  const { width, height } = canvasSize(level.nodes);

  const toCanvas = (clientX: number, clientY: number): Point =>
    clientToCanvas(canvasRef.current, clientX, clientY);

  const update = (next: Placements) => {
    setPlacements(next);
    setEdges((es) => pruneEdges(es, next));
    setSelectedEdge(null);
    setPending(null);
    setResult(null);
  };

  const reset = () => {
    setPlacements(initialPlacements(level));
    setShapePlacements(initialShapePlacements(level));
    setShapeEdgeLabels({});
    setEdges([]);
    setSelected(null);
    setSelectedShape(null);
    setSelectedEdge(null);
    setPending(null);
    setResult(null);
  };

  const handleCheck = () => {
    const slots = drawShapes
      ? checkShapes(level, shapePlacements)
      : check(level, placements, draw);
    const edgeResult = draw ? checkEdges(level, edges, placements) : null;
    const decisionEdges = drawShapes
      ? level.edges.filter(
          (edge) => isDecisionNode(level, edge.from) && edge.label,
        )
      : [];
    const correctLabels = decisionEdges
      .filter((edge) => shapeEdgeLabels[edgeId(edge)] === edge.label)
      .map(edgeId);
    const wrongLabels = decisionEdges
      .filter((edge) => {
        const label = shapeEdgeLabels[edgeId(edge)];
        return label !== null && label !== undefined && label !== edge.label;
      })
      .map(edgeId);
    const missingLabels =
      decisionEdges.length - correctLabels.length - wrongLabels.length;
    const labelResult: EdgeCheck | null = drawShapes
      ? {
          correct: correctLabels,
          wrong: wrongLabels,
          missing: missingLabels,
          solved: missingLabels === 0 && wrongLabels.length === 0,
        }
      : null;
    const solved =
      slots.solved &&
      (edgeResult?.solved ?? true) &&
      (labelResult?.solved ?? true);
    setResult({ slots, edges: edgeResult, labels: labelResult, solved });
    setSelectedEdge(null);
    setPending(null);
    if (solved) saveCompleted(level.id, mode);
  };

  const connect = (from: Endpoint, to: Endpoint) => {
    setPending(null);
    if (!placements[from.slot] || !placements[to.slot]) return;
    const r = addEdge(edges, from.slot, from.side, to.slot, to.side);
    setEdges(r.edges);
    setSelectedEdge(
      !r.created || isDecision(level, placements, from.slot) ? r.id : null,
    );
    setResult(null);
  };

  // The window listener is attached once per drag, so it reads the latest connect through a ref.
  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    if (!dragFrom) return;
    const from = dragFrom;
    const move = (e: PointerEvent) =>
      setCursor(clientToCanvas(canvasRef.current, e.clientX, e.clientY));
    const up = (e: PointerEvent) => {
      const el =
        document.elementFromPoint?.(e.clientX, e.clientY) ??
        (e.target as Element | null);
      const slot =
        el instanceof Element
          ? el.closest<HTMLElement>("[data-slot]")?.dataset.slot
          : undefined;
      const node = level.nodes.find((n) => n.id === slot);
      const dot =
        el instanceof Element ? el.closest<HTMLElement>("[data-side]") : null;
      setDragFrom(null);
      setCursor(null);
      if (node && slot !== from.slot) {
        connectRef.current(from, {
          slot: node.id,
          side:
            (dot?.dataset.side as Side | undefined) ??
            facingSide(level, from, node),
        });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragFrom, level]);

  useEffect(() => {
    if (!shapeDrag) return;
    const drag = shapeDrag;
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const el =
        document.elementFromPoint?.(e.clientX, e.clientY) ??
        (e.target as Element | null);
      const slot =
        el instanceof Element
          ? el.closest<HTMLElement>("[data-slot]")?.dataset.slot
          : undefined;
      if (slot) {
        setShapePlacements((current) => ({ ...current, [slot]: drag.shape }));
        setResult(null);
      }
      setShapeDrag(null);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === drag.pointerId) setShapeDrag(null);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [shapeDrag]);

  const handleClick = (ep: Endpoint) => {
    if (!pending) {
      setPending(ep);
      setSelectedEdge(null);
    } else if (pending.slot === ep.slot) {
      setPending(null);
    } else {
      connect(pending, ep);
    }
  };

  const slotClick = (slotId: string) => {
    if (drawShapes) {
      if (selectedShape) {
        setShapePlacements((current) => ({
          ...current,
          [slotId]: selectedShape,
        }));
      }
      setResult(null);
      return;
    }
    if (draw && pending && placements[slotId]) {
      const node = level.nodes.find((n) => n.id === slotId);
      if (node && pending.slot !== slotId) {
        connect(pending, {
          slot: slotId,
          side: facingSide(level, pending, node),
        });
      } else {
        setPending(null);
      }
      return;
    }
    if (level.nodes.find((n) => n.id === slotId)?.fixed) return;
    if (selected) {
      update(place(level, placements, slotId, selected));
      setSelected(null);
    } else if (placements[slotId]) {
      update(remove(level, placements, slotId));
    }
  };

  const onDrop = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (drawShapes) {
      const shape = id.startsWith("shape:") ? id.slice("shape:".length) : "";
      if (isShape(shape)) {
        setShapePlacements((current) => ({ ...current, [slotId]: shape }));
        setResult(null);
      }
      return;
    }
    if (level.nodes.find((n) => n.id === slotId)?.fixed) return;
    if (id) update(place(level, placements, slotId, id));
    setSelected(null);
  };

  const onBankDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const slot = Object.keys(placements).find((k) => placements[k] === id);
    if (slot) update(remove(level, placements, slot));
  };

  const dragProps = (item: Item) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", item.id);
      e.dataTransfer.effectAllowed = "move";
    },
  });

  const shapeDragProps = (shape: Shape) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", `shape:${shape}`);
      e.dataTransfer.effectAllowed = "copy";
      setSelectedShape(shape);
    },
  });

  const labelDragProps = (label: EdgeLabel) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", `label:${label}`);
      e.dataTransfer.effectAllowed = "copy";
    },
  });

  const slotText = (slotId: string) => {
    if (drawShapes) {
      const node = level.nodes.find((n) => n.id === slotId);
      return node ? itemById(level, node.answer).text : "";
    }
    const id = placements[slotId];
    return id ? itemById(level, id).text : "empty slot";
  };

  const arrows: ArrowView[] = draw
    ? edges.map((e) => ({
        id: e.id,
        edge: e,
        label: e.label,
        needsLabel: isDecision(level, placements, e.from),
        status: result?.edges?.correct.includes(e.id)
          ? "correct"
          : result?.edges?.wrong.includes(e.id)
            ? "wrong"
            : undefined,
        description: `Arrow from ${slotText(e.from)} to ${slotText(e.to)}${e.label ? `, ${e.label}` : ""}`,
      }))
    : level.edges.map((e) => ({
        id: drawShapes
          ? edgeId(e)
          : `${e.from}-${e.fromSide}-${e.to}-${e.toSide}`,
        edge: e,
        label: drawShapes ? (shapeEdgeLabels[edgeId(e)] ?? undefined) : e.label,
        needsLabel: drawShapes && isDecisionNode(level, e.from),
        labelPrompt:
          drawShapes &&
          isDecisionNode(level, e.from) &&
          !shapeEdgeLabels[edgeId(e)]
            ? "Drop Yes/No"
            : undefined,
        description: `from ${slotText(e.from)} to ${slotText(e.to)}`,
      }));

  const preview = (() => {
    if (!dragFrom || !cursor) return null;
    const node = level.nodes.find((n) => n.id === dragFrom.slot);
    return node ? { from: anchor(node, dragFrom.side), to: cursor } : null;
  })();

  const editing = draw ? edges.find((e) => e.id === selectedEdge) : undefined;
  const editingMid = editing
    ? pathMidpoint(routeEdge(editing, level.nodes))
    : null;

  const filled = level.nodes.filter((n) => placements[n.id]).length;
  const shapeFilled = level.nodes.filter(
    (node) => shapePlacements[node.id],
  ).length;
  const hasDecisions =
    drawShapes && level.nodes.some((node) => isDecisionNode(level, node.id));
  const levelPath = `/level/${level.id}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const dir = e.key === "n" ? "next" : e.key === "p" ? "previous" : null;
      if (!dir) return;
      document
        .querySelector<HTMLAnchorElement>(`a[data-nav="${dir}"]`)
        ?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="rounded-2xl bg-white p-4 shadow-lg sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-blue-800">
              Level {level.id}: {level.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              <span className="mr-2 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 capitalize">
                {level.tier}
              </span>
              <span
                className={`mr-2 rounded-full px-2 py-0.5 font-semibold ${draw ? "bg-amber-100 text-amber-800" : drawShapes ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}
              >
                {MODE_OPTIONS.find((option) => option.id === mode)?.label}
              </span>
              {MODE_OPTIONS.filter((option) => option.id !== mode).map(
                (option, index) => (
                  <span key={option.id}>
                    {index > 0 && " · "}
                    <Link
                      className="underline"
                      to={withMode(levelPath, option.id)}
                    >
                      Switch to {option.label.toLowerCase()}
                    </Link>
                  </span>
                ),
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCheck}
              className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700"
            >
              Check Answer
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-yellow-500 px-4 py-2 font-bold text-white hover:bg-yellow-600"
            >
              Reset
            </button>
            <Link
              to={withMode("/", mode)}
              className="rounded-lg bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-600"
            >
              Back
            </Link>
          </div>
        </div>

        <nav
          aria-label="Puzzle navigation"
          className="mt-4 flex items-center justify-between"
        >
          {previousId ? (
            <Link
              data-nav="previous"
              title="Shortcut: P"
              to={withMode(`/level/${previousId}`, mode)}
              className="rounded-lg bg-blue-100 px-4 py-2 font-semibold text-blue-800 hover:bg-blue-200"
            >
              ← Previous puzzle
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-400"
            >
              ← Previous puzzle
            </button>
          )}
          {nextId ? (
            <Link
              data-nav="next"
              title="Shortcut: N"
              to={withMode(`/level/${nextId}`, mode)}
              className="rounded-lg bg-blue-100 px-4 py-2 font-semibold text-blue-800 hover:bg-blue-200"
            >
              Next puzzle →
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-400"
            >
              Next puzzle →
            </button>
          )}
        </nav>

        <p className="mt-4 border-l-4 border-blue-500 bg-blue-50 p-4 text-blue-900">
          {level.instructions}
        </p>

        {draw && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Draw arrows:</strong> place the symbols, then draw every
            arrow yourself. Drag from a dot on one symbol onto another symbol
            (or click a dot, then click the symbol it should point to). Arrows
            leaving a diamond must be labelled Yes or No. Click an arrow to
            relabel or delete it.
            {pending && (
              <strong className="ml-1">
                Now click the symbol the arrow should point to.
              </strong>
            )}
          </p>
        )}
        {drawShapes && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Draw shapes:</strong> drag a shape from the Elements
            toolbox, or tap/select one and tap a box. The toolbox keeps a copy,
            so you can reuse each shape.
            {hasDecisions && " Drag Yes or No onto each decision line as well."}
          </p>
        )}

        {result && (
          <div
            role="status"
            className={`mt-3 rounded-lg p-3 font-semibold ${result.solved ? "bg-green-100 text-green-800" : "bg-red-50 text-red-800"}`}
          >
            {result.solved ? (
              <>
                🎉 Correct! Well done.{" "}
                {nextId ? (
                  <Link
                    className="underline"
                    to={withMode(`/level/${nextId}`, mode)}
                  >
                    Next level →
                  </Link>
                ) : (
                  <Link className="underline" to={withMode("/", mode)}>
                    You finished every level — back to the menu
                  </Link>
                )}
              </>
            ) : (
              feedback(level, result, drawShapes)
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1 overflow-auto rounded-xl border-2 border-dashed border-gray-300 bg-gray-100">
            <div
              ref={canvasRef}
              className="relative mx-auto select-none"
              style={{ width, height }}
            >
              <ArrowLayer
                width={width}
                height={height}
                nodes={level.nodes}
                arrows={arrows}
                selectedId={selectedEdge}
                onSelect={draw ? setSelectedEdge : undefined}
                onDelete={
                  draw
                    ? (id) => {
                        setEdges((es) => removeEdge(es, id));
                        setSelectedEdge(null);
                        setResult(null);
                      }
                    : undefined
                }
                onLabelDrop={
                  drawShapes
                    ? (id, label) => {
                        setShapeEdgeLabels((current) => ({
                          ...current,
                          [id]: label,
                        }));
                        setResult(null);
                      }
                    : undefined
                }
                preview={preview}
              />

              {level.nodes.map((n, i) => {
                const { x, y } = nodePos(n);
                const itemId = placements[n.id];
                const item = itemId ? itemById(level, itemId) : null;
                const answer = drawShapes ? itemById(level, n.answer) : null;
                const shape = shapePlacements[n.id];
                const displayedItem =
                  drawShapes && answer && shape ? { ...answer, shape } : item;
                const status = result?.slots.correct.includes(n.id)
                  ? "correct"
                  : result?.slots.wrong.includes(n.id)
                    ? "wrong"
                    : null;
                return (
                  <div
                    key={n.id}
                    data-slot={n.id}
                    className="absolute"
                    style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
                  >
                    <button
                      type="button"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDrop(e, n.id)}
                      data-testid={`slot-${n.id}`}
                      aria-label={
                        drawShapes && answer
                          ? `Slot ${i + 1}: ${answer.text}${shape ? `, ${shape}` : ", no shape"}`
                          : item
                            ? `Slot ${i + 1}: ${item.text}`
                            : `Empty slot ${i + 1}`
                      }
                      aria-disabled={(!drawShapes && n.fixed) || undefined}
                      onClick={() => slotClick(n.id)}
                      {...(item && !drawShapes && !n.fixed
                        ? dragProps(item)
                        : {})}
                      className={`h-full w-full ${displayedItem ? "" : "rounded-lg border-2 border-dashed border-gray-400 bg-white/60 text-sm text-gray-700 hover:border-blue-400"} ${selected && !n.fixed ? "ring-2 ring-blue-400" : ""} ${drawShapes && selectedShape ? "cursor-pointer" : ""}`}
                    >
                      {displayedItem ? (
                        <Block item={displayedItem} />
                      ) : drawShapes && answer ? (
                        <span className="px-2">{answer.text}</span>
                      ) : (
                        i + 1
                      )}
                    </button>
                    {draw &&
                      item &&
                      SIDES.map((side) => {
                        const active =
                          (pending?.slot === n.id && pending.side === side) ||
                          (dragFrom?.slot === n.id && dragFrom.side === side);
                        return (
                          <button
                            key={side}
                            type="button"
                            data-side={side}
                            data-testid={`handle-${n.id}-${side}`}
                            aria-label={`Connection point: ${SIDE_NAME[side]} of ${item.text}`}
                            aria-pressed={active}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              setDragFrom({ slot: n.id, side });
                              setCursor(toCanvas(e.clientX, e.clientY));
                              setSelectedEdge(null);
                            }}
                            onClick={() => handleClick({ slot: n.id, side })}
                            className={`absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none rounded-full border-2 border-blue-600 hover:bg-blue-300 ${active ? "bg-blue-500" : "bg-white/40"} ${HANDLE_POS[side]}`}
                          />
                        );
                      })}
                    {status && (
                      <span
                        className={`pointer-events-none absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white ${status === "correct" ? "bg-green-600" : "bg-red-600"}`}
                      >
                        {status === "correct" ? "✓" : "✗"}
                      </span>
                    )}
                  </div>
                );
              })}

              {editing && editingMid && (
                <fieldset
                  aria-label="Arrow options"
                  className="absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-gray-300"
                  style={{ left: editingMid.x, top: editingMid.y }}
                >
                  {isDecision(level, placements, editing.from) &&
                    (["Yes", "No"] as EdgeLabel[]).map((label) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={editing.label === label}
                        onClick={() => {
                          setEdges((es) => setLabel(es, editing.id, label));
                          setSelectedEdge(null);
                          setResult(null);
                        }}
                        className={`rounded px-2 py-1 font-bold ${editing.label === label ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
                      >
                        {label}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEdges((es) => removeEdge(es, editing.id));
                      setSelectedEdge(null);
                      setResult(null);
                    }}
                    className="rounded bg-red-100 px-2 py-1 font-bold text-red-700 hover:bg-red-200"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setSelectedEdge(null)}
                    className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </fieldset>
              )}
            </div>
          </div>

          <aside
            className="rounded-xl bg-gray-200 p-4 lg:order-first lg:w-60 lg:shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onBankDrop}
          >
            <h2 className="mb-3 font-bold text-gray-700">Elements</h2>
            <p className="mb-3 text-xs text-gray-600">
              {drawShapes
                ? "Drag a shape onto a labelled box, or select it and click a box."
                : "Drag a symbol onto the chart, or click it and then click a slot."}{" "}
              {drawShapes
                ? `${shapeFilled}/${level.nodes.length} shapes placed.`
                : `${filled}/${level.nodes.length} placed.`}
              {draw && ` ${edges.length}/${level.edges.length} arrows drawn.`}
            </p>
            <div className="flex flex-col items-center gap-3">
              {drawShapes &&
                hasDecisions &&
                (["Yes", "No"] as EdgeLabel[]).map((label) => (
                  <button
                    key={label}
                    type="button"
                    data-testid={`label-tool-${label}`}
                    aria-label={`Drag ${label} label`}
                    {...labelDragProps(label)}
                    className="w-full max-w-[220px] cursor-grab rounded-lg bg-white px-4 py-3 text-center font-bold text-gray-800 shadow"
                  >
                    {label}
                  </button>
                ))}
              {drawShapes
                ? SHAPE_TOOLS.map(({ shape, label, item: toolItem }) => (
                    <button
                      key={shape}
                      type="button"
                      data-testid={`shape-${shape}`}
                      aria-label={label}
                      aria-pressed={selectedShape === shape}
                      onClick={() => setSelectedShape(shape)}
                      onPointerDown={(e) => {
                        if (!drawShapes || e.pointerType === "mouse") return;
                        e.preventDefault();
                        setSelectedShape(shape);
                        setShapeDrag({ shape, pointerId: e.pointerId });
                      }}
                      {...shapeDragProps(shape)}
                      className={`h-[72px] w-full max-w-[220px] touch-none cursor-grab ${selectedShape === shape ? "scale-105 drop-shadow-[0_0_6px_#2563eb]" : ""}`}
                    >
                      <Block item={toolItem} showText={false} />
                    </button>
                  ))
                : bank.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`item-${item.id}`}
                      aria-pressed={selected === item.id}
                      onClick={() =>
                        setSelected(selected === item.id ? null : item.id)
                      }
                      {...dragProps(item)}
                      className={`h-[72px] w-full max-w-[220px] cursor-grab ${selected === item.id ? "scale-105 drop-shadow-[0_0_6px_#2563eb]" : ""}`}
                    >
                      <Block item={item} />
                    </button>
                  ))}
              {!drawShapes && bank.length === 0 && (
                <p className="text-sm text-gray-500">All symbols placed.</p>
              )}
            </div>
          </aside>
        </div>

        <CodePanel level={level} />
      </div>
    </div>
  );
}
