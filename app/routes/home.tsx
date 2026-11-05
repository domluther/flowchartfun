import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { loadCompleted } from "../lib/game";
import { levels } from "../lib/levels";
import { parseMode, withMode } from "../lib/mode";
import type { Mode } from "../lib/types";

export function meta() {
  return [
    { title: "FlowchartFun – OCR GCSE flowchart practice" },
    {
      name: "description",
      content:
        "Practise building flowcharts for OCR GCSE Computer Science J277.",
    },
  ];
}

export default function Home() {
  const [done, setDone] = useState<number[]>([]);
  const mode = parseMode(useSearchParams()[0].get("mode"));
  useEffect(() => setDone(loadCompleted(mode)), [mode]);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-blue-800">FlowchartFun</h1>
        <p className="mt-2 text-gray-600">
          Practise building flowcharts for OCR GCSE Computer Science (J277).
        </p>
        <fieldset className="mt-4 inline-flex rounded-full bg-white p-1 shadow">
          <legend className="sr-only">Difficulty</legend>
          {(["easy", "hard"] as Mode[]).map((m) => (
            <Link
              key={m}
              to={withMode("/", m)}
              aria-current={m === mode ? "true" : undefined}
              className={`rounded-full px-5 py-1.5 font-semibold capitalize ${m === mode ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {m}
            </Link>
          ))}
        </fieldset>
        <p className="mt-1 text-sm text-gray-500">
          {mode === "easy"
            ? "Easy: the arrows are already drawn. Just place the symbols."
            : "Hard: place the symbols and draw the arrows yourself."}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {done.length} of {levels.length} levels complete
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {levels.map((l) => (
          <li key={l.id}>
            <Link
              to={withMode(`/level/${l.id}`, mode)}
              className="flex h-full items-center gap-4 rounded-xl bg-white p-4 shadow hover:shadow-md"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white ${done.includes(l.id) ? "bg-green-600" : "bg-blue-600"}`}
              >
                {done.includes(l.id) ? "✓" : l.id}
              </span>
              <span>
                <span className="block font-bold text-gray-900">{l.title}</span>
                <span className="text-sm text-gray-500">{l.topic}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
