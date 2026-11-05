import { useMemo, useState } from "react";
import { generateCode, generateERLURL, type Language } from "../lib/code";
import type { Level } from "../lib/types";

const TABS: { id: Language; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "erl", label: "OCR ERL" },
];

export function CodePanel({ level }: { level: Level }) {
  const [language, setLanguage] = useState<Language>("python");
  const code = useMemo(() => generateCode(level), [level]);
  const text = language === "python" ? code.python : code.erl;

  return (
    <details
      data-testid="code-panel"
      className="mt-6 rounded-xl border border-gray-300 bg-white p-4"
    >
      <summary className="cursor-pointer font-bold text-gray-700">
        Show the code for this flowchart
        <span className="ml-2 text-xs font-normal text-gray-500">
          (spoiler: it gives away the answer)
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`code-tab-${tab.id}`}
            aria-pressed={language === tab.id}
            onClick={() => setLanguage(tab.id)}
            className={`rounded-lg px-3 py-1 text-sm font-semibold ${
              language === tab.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {language === "erl" && (
          <a
            data-testid="open-erl-ide"
            href={generateERLURL(code.erl)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700"
          >
            Open in OCR ERL IDE ↗
          </a>
        )}
      </div>
      <pre
        data-testid="code-output"
        className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"
      >
        <code>{text}</code>
      </pre>
    </details>
  );
}
