import type { Mode } from "./types";

export function parseMode(value: string | null): Mode {
  return value === "hard" ? "hard" : "easy";
}

export function withMode(path: string, mode: Mode): string {
  return mode === "hard" ? `${path}?mode=hard` : path;
}
