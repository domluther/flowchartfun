import type { Mode } from "./types";

export const MODE_OPTIONS: {
  id: Mode;
  label: string;
  blurb: string;
}[] = [
  {
    id: "shapes",
    label: "Draw shapes",
    blurb: "Draw shapes: add the correct flowchart shape to each labelled box.",
  },
  {
    id: "guided",
    label: "Guided",
    blurb: "Guided: the arrows are already drawn. Just place the symbols.",
  },
  {
    id: "draw",
    label: "Draw arrows",
    blurb: "Draw arrows: place the symbols and draw the arrows yourself.",
  },
];

export function parseMode(value: string | null): Mode {
  if (value === "draw" || value === "shapes") return value;
  return "guided";
}

export function withMode(path: string, mode: Mode): string {
  return mode === "guided" ? path : `${path}?mode=${mode}`;
}
