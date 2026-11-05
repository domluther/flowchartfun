import type { Mode } from "./types";

export function parseMode(value: string | null): Mode {
  return value === "draw" ? "draw" : "guided";
}

export function withMode(path: string, mode: Mode): string {
  return mode === "draw" ? `${path}?mode=draw` : path;
}
