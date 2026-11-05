import type { Item } from "../lib/types";

const clip: Record<Item["shape"], string | undefined> = {
  terminator: undefined,
  io: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)",
  process: undefined,
  decision: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
};

function colour(item: Item) {
  switch (item.shape) {
    case "terminator":
      return item.text.toLowerCase() === "start"
        ? "bg-green-500"
        : "bg-red-500";
    case "io":
      return "bg-purple-500";
    case "process":
      return "bg-blue-500";
    case "decision":
      return "bg-amber-500";
  }
}

export function Block({ item }: { item: Item }) {
  const rounded =
    item.shape === "terminator"
      ? "rounded-full"
      : item.shape === "process"
        ? "rounded-lg"
        : "";
  const padding =
    item.shape === "decision"
      ? "px-12 text-sm"
      : item.shape === "io"
        ? "px-8"
        : "px-4";
  return (
    <div
      className={`flex h-full w-full items-center justify-center text-center font-semibold leading-tight text-white ${colour(item)} ${rounded} ${padding} ${item.shape === "io" ? "italic" : ""}`}
      style={{ clipPath: clip[item.shape] }}
    >
      {item.text}
    </div>
  );
}
