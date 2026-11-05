import { Link, useParams, useSearchParams } from "react-router";
import { LevelPlayer } from "../components/LevelPlayer";
import { getLevel, levels } from "../lib/levels";
import { parseMode, withMode } from "../lib/mode";

export function meta() {
  return [{ title: "Level – FlowchartFun" }];
}

export default function LevelRoute() {
  const id = Number(useParams().id);
  const mode = parseMode(useSearchParams()[0].get("mode"));
  const level = getLevel(id);

  if (!level) {
    return (
      <main className="p-8 text-center">
        <p className="mb-4">That level doesn't exist.</p>
        <Link className="text-blue-700 underline" to={withMode("/", mode)}>
          Back to levels
        </Link>
      </main>
    );
  }

  const previousId = levels.find((l) => l.id === id - 1)?.id;
  const nextId = levels.find((l) => l.id === id + 1)?.id;
  return (
    <LevelPlayer
      key={`${level.id}-${mode}`}
      level={level}
      mode={mode}
      previousId={previousId}
      nextId={nextId}
    />
  );
}
