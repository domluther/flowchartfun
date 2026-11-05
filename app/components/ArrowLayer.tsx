import { labelPos, type Point, routeEdge } from "../lib/layout";
import type { EdgeDef, NodeDef } from "../lib/types";

export interface ArrowView {
  id: string;
  edge: EdgeDef;
  label?: string;
  /** a decision arrow that still needs Yes or No */
  needsLabel?: boolean;
  status?: "correct" | "wrong";
  description: string;
}

const COLOURS = {
  default: "#374151",
  correct: "#16a34a",
  wrong: "#dc2626",
  selected: "#2563eb",
} as const;

type Colour = keyof typeof COLOURS;

export function ArrowLayer({
  width,
  height,
  nodes,
  arrows,
  selectedId,
  onSelect,
  onDelete,
  preview,
}: {
  width: number;
  height: number;
  nodes: NodeDef[];
  arrows: ArrowView[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  preview?: { from: Point; to: Point } | null;
}) {
  const interactive = onSelect !== undefined;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
    >
      <title>Flowchart arrows</title>
      <defs>
        {(Object.keys(COLOURS) as Colour[]).map((c) => (
          <marker
            key={c}
            id={`arrow-${c}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={COLOURS[c]} />
          </marker>
        ))}
      </defs>

      {arrows.map((a) => {
        const pts = routeEdge(a.edge, nodes);
        const points = pts.map((p) => `${p.x},${p.y}`).join(" ");
        const lp = labelPos(pts);
        const colour: Colour =
          a.status ?? (a.id === selectedId ? "selected" : "default");
        const text = a.label ?? (a.needsLabel ? "Yes / No?" : undefined);
        const interactiveProps = interactive
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": a.description,
              className: "pointer-events-auto cursor-pointer outline-none",
              onClick: () => onSelect(a.id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(a.id);
                } else if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  onDelete?.(a.id);
                }
              },
            }
          : {};

        return (
          <g key={a.id} {...interactiveProps}>
            {interactive && (
              <polyline
                points={points}
                fill="none"
                stroke="transparent"
                strokeWidth="14"
              />
            )}
            <polyline
              points={points}
              fill="none"
              stroke={COLOURS[colour]}
              strokeWidth="2"
              markerEnd={`url(#arrow-${colour})`}
            />
            {text && (
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={lp.anchor}
                className={`text-xs font-bold ${a.needsLabel && !a.label ? "fill-red-600" : "fill-gray-700"}`}
              >
                {text}
              </text>
            )}
          </g>
        );
      })}

      {preview && (
        <line
          x1={preview.from.x}
          y1={preview.from.y}
          x2={preview.to.x}
          y2={preview.to.y}
          stroke={COLOURS.selected}
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      )}
    </svg>
  );
}
