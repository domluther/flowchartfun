import type { Level } from "./types";

export type Language = "python" | "erl";

type Block = Stmt[];
type Stmt =
  | { t: "line"; py: string; erl: string }
  | { t: "if"; py: string; erl: string; yes: Block; no: Block }
  | { t: "while"; py: string; erl: string; body: Block }
  | { t: "do"; body: Block; py: string; erl: string }
  | { t: "loop"; body: Block }
  | { t: "exit" };

/** Name of the Boolean that ends a loop (default "done"); break is never used. */
const LOOP_FLAGS: Record<number, string> = {
  13: "guessed",
  21: "valid",
  23: "finished",
  29: "finished",
  30: "quit",
};

// The Calculator level tests `op` after reading the operator
const ALIASES: Record<string, string> = { operator: "op" };

const CORRECT_VALUES: Record<string, string> = {
  PIN: "1234",
  password: '"letmein"',
  answer: '"Paris"',
};

/** Apply a transform to the parts of an expression outside string literals. */
function outsideStrings(text: string, fn: (part: string) => string): string {
  return text
    .split(/("[^"]*")/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

function names(text: string): string {
  return outsideStrings(text, (p) =>
    p.replace(/\b(?!MOD\b)([A-Za-z]+) (\d+)\b/g, "$1_$2"),
  );
}

function expression(text: string, lang: Language): string {
  return outsideStrings(names(text), (p) =>
    p.replace(/×/g, "*").replace(/\bMOD\b/g, lang === "python" ? "%" : "MOD"),
  );
}

function condition(text: string, lang: Language): string {
  const raw = text.replace(/\?$/, "").trim();
  const correct = raw.match(/^(\w+) correct$/);
  if (correct) return `${correct[1]} == correct_${correct[1]}`;
  const range = raw.match(/^(\w+) from (\d+) to (\d+)$/);
  if (range) {
    const [, v, lo, hi] = range;
    return lang === "python"
      ? `${v} >= ${lo} and ${v} <= ${hi}`
      : `${v} >= ${lo} AND ${v} <= ${hi}`;
  }
  const e = expression(raw, lang);
  return outsideStrings(e, (p) =>
    p.replace(/<>/g, "!=").replace(/(^|[^<>=!])=(?!=)/g, "$1=="),
  );
}

const NEGATIONS: [string, string][] = [
  ["==", "!="],
  ["!=", "=="],
  ["<=", ">"],
  [">=", "<"],
  ["<", ">="],
  [">", "<="],
];

function negate(cond: string, lang: Language): string {
  const m = cond.match(/^([^<>=!]+?) (==|!=|<=|>=|<|>) ([^<>=!]+)$/);
  if (m && !/\b(AND|OR|and|or)\b/.test(cond)) {
    const op = NEGATIONS.find(([a]) => a === m[2]);
    if (op) return `${m[1]} ${op[1]} ${m[3]}`;
  }
  const mod = cond.match(/^(.+ % \d+|.+ MOD \d+) (==|!=) (\d+)$/);
  if (mod) return `${mod[1]} ${mod[2] === "==" ? "!=" : "=="} ${mod[3]}`;
  return lang === "python" ? `not (${cond})` : `NOT (${cond})`;
}

export interface GeneratedCode {
  python: string;
  erl: string;
}

/** Hand-written code for levels where a neater idiom than the flowchart shape exists. */
const OVERRIDES: Record<number, GeneratedCode> = {
  19: {
    python: [
      "total = 0",
      "number = 1",
      "while number != 0:",
      '    number = int(input("Enter number"))',
      "    total = total + number",
      "print(total)",
    ].join("\n"),
    erl: [
      "total = 0",
      "number = 1",
      "while number != 0",
      '    number = int(input("Enter number"))',
      "    total = total + number",
      "endwhile",
      "print(total)",
    ].join("\n"),
  },
};

export function generateCode(level: Level): GeneratedCode {
  const override = OVERRIDES[level.id];
  if (override) return override;
  const text = new Map(level.items.map((item) => [item.id, item] as const));
  const nodes = new Map(level.nodes.map((n) => [n.id, n] as const));
  const info = (id: string) => text.get(nodes.get(id)?.answer ?? id);
  const out = new Map<string, { to: string; label?: string }[]>();
  for (const e of level.edges) {
    const list = out.get(e.from) ?? [];
    list.push({ to: e.to, label: e.label });
    out.set(e.from, list);
  }
  const start = level.nodes.find((n) => info(n.id)?.text === "Start")?.id;
  if (!start) return { python: "", erl: "" };

  // Back edges found by DFS identify loop headers.
  const backEdges = new Set<string>();
  const state = new Map<string, number>();
  const dfs = (id: string) => {
    state.set(id, 1);
    for (const { to } of out.get(id) ?? []) {
      if (state.get(to) === 1) backEdges.add(`${id}->${to}`);
      else if (!state.has(to)) dfs(to);
    }
    state.set(id, 2);
  };
  dfs(start);
  const headers = new Set([...backEdges].map((k) => k.split("->")[1]));
  const isBack = (from: string, to: string) => backEdges.has(`${from}->${to}`);

  const forward = (id: string) =>
    (out.get(id) ?? []).filter((e) => !isBack(id, e.to));

  /** Nodes reachable from id without following back edges. */
  const reach = (id: string): string[] => {
    const seen: string[] = [];
    const walk = (n: string) => {
      if (seen.includes(n)) return;
      seen.push(n);
      for (const e of forward(n)) walk(e.to);
    };
    walk(id);
    return seen;
  };

  const branches = (id: string) => {
    const edges = out.get(id) ?? [];
    return {
      yes: edges.find((e) => e.label === "Yes")?.to,
      no: edges.find((e) => e.label === "No")?.to,
    };
  };

  const loopsBackTo = (from: string, target: string) =>
    reach(from).some((n) => (out.get(n) ?? []).some((e) => e.to === target));

  const simple = (id: string): Stmt | null => {
    const item = info(id);
    if (!item || item.shape === "terminator") return null;
    const t = item.text;
    if (item.shape === "io") {
      const m = t.match(/^(Input|Output) (.*)$/);
      if (!m) return null;
      if (m[1] === "Output") {
        const e = (l: Language) => expression(m[2], l);
        return {
          t: "line",
          py: `print(${e("python")})`,
          erl: `print(${e("erl")})`,
        };
      }
      const v = names(ALIASES[m[2]] ?? m[2]);
      const prompt = `"Enter ${m[2]}"`;
      const numeric = isNumeric(m[2]);
      return {
        t: "line",
        py: numeric
          ? `${v} = int(input(${prompt}))`
          : `${v} = input(${prompt})`,
        erl: numeric
          ? `${v} = int(input(${prompt}))`
          : `${v} = input(${prompt})`,
      };
    }
    const body = t.replace(/^Calculate /, "");
    return {
      t: "line",
      py: expression(body, "python"),
      erl: expression(body, "erl"),
    };
  };

  const numericCache = new Map<string, boolean>();
  const bodies = level.items
    .filter((i) => level.nodes.some((n) => n.answer === i.id))
    .filter((i) => i.shape !== "terminator" && !i.text.startsWith("Input"))
    .map((i) => i.text.replace(/^Output /, ""));
  function isNumeric(raw: string): boolean {
    if (raw === "PIN") return true;
    const cached = numericCache.get(raw);
    if (cached !== undefined) return cached;
    const v = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const op = "(?:<=|>=|<|>|\\+|-|×|/|MOD)";
    const num = new RegExp(
      `(\\b${v}\\b\\s*${op})|(${op}\\s*${v}\\b)|(\\b${v}\\b\\s*=\\s*[\\d(])|(\\d\\s*=\\s*${v}\\b)|(=\\s*\\d+\\s*[×+-]?\\s*${v}\\b)|(\\b${v}\\b\\s*[×+-])|(\\b${v}\\b from \\d)`,
    );
    const stringy = new RegExp(
      `(\\b${v}\\b\\s*=\\s*")|(" \\+ ${v}\\b)|(\\b${v}\\b correct)`,
    );
    const result =
      bodies.some((b) => num.test(b)) && !bodies.some((b) => stringy.test(b));
    numericCache.set(raw, result);
    return result;
  }

  const usedCorrect = new Set<string>();

  interface LoopCtx {
    header: string;
    classic: boolean;
    cond?: { py: string; erl: string };
    next?: string;
  }

  /** nodes from which the loop header can be reached again */
  const returns = (n: string, header: string) =>
    n === header || loopsBackTo(n, header);

  /** A loop whose only exits are its own test can use while / do...until. */
  const isClassic = (header: string): boolean => {
    if (info(header)?.shape === "decision") {
      const { yes, no } = branches(header);
      const body = yes && returns(yes, header) ? yes : no;
      return (
        body !== undefined &&
        reach(body).every((n) => n === header || returns(n, header))
      );
    }
    let cur = header;
    for (;;) {
      if (info(cur)?.shape === "decision") {
        const { yes, no } = branches(cur);
        return yes === header || no === header;
      }
      const next = forward(cur)[0]?.to;
      if (!next || isBack(cur, next) || next === header) return false;
      cur = next;
    }
  };

  /** Emit nodes from `id` until reaching a node in `stops` (or the end). */
  const seq = (
    id: string | undefined,
    stops: Set<string>,
    ctx?: LoopCtx,
  ): Block => {
    const block: Block = [];
    let cur = id;
    while (cur && !stops.has(cur)) {
      const item = info(cur);
      const isHeader = headers.has(cur) && cur !== ctx?.header;
      if (isHeader) {
        const classic = isClassic(cur);
        const loop: LoopCtx = { header: cur, classic };
        if (item?.shape === "decision" && classic) {
          const { yes, no } = branches(cur);
          const raw = item.text;
          const m = raw.match(/^(\w+) correct\?$/);
          if (m) usedCorrect.add(m[1]);
          const py = condition(raw, "python");
          const erl = condition(raw, "erl");
          const yesLoops = yes !== undefined && returns(yes, cur);
          block.push({
            t: "while",
            py: yesLoops ? py : negate(py, "python"),
            erl: yesLoops ? erl : negate(erl, "erl"),
            body: seq(yesLoops ? yes : no, new Set([cur, ...stops])),
          });
          cur = yesLoops ? no : yes;
          continue;
        }
        const body = seq(cur, stops, loop);
        if (classic) {
          block.push({
            t: "do",
            body,
            py: loop.cond?.py ?? "True",
            erl: loop.cond?.erl ?? "True",
          });
        } else {
          block.push({ t: "loop", body });
        }
        cur = loop.next;
        continue;
      }

      if (item?.shape !== "decision") {
        const s = simple(cur);
        if (s) block.push(s);
        cur = forward(cur)[0]?.to;
        continue;
      }

      const { yes, no } = branches(cur);
      const raw = item.text;
      const m = raw.match(/^(\w+) correct\?$/);
      if (m) usedCorrect.add(m[1]);
      const condPy = condition(raw, "python");
      const condErl = condition(raw, "erl");

      if (ctx?.classic && (yes === ctx.header || no === ctx.header)) {
        // end of a do...until loop: leave when the condition sends us onwards
        const leaveOnYes = no === ctx.header;
        ctx.cond = {
          py: leaveOnYes ? condPy : negate(condPy, "python"),
          erl: leaveOnYes ? condErl : negate(condErl, "erl"),
        };
        ctx.next = leaveOnYes ? yes : no;
        return block;
      }

      const noReach = no ? reach(no) : [];
      const join = yes
        ? reach(yes).find((n) => noReach.includes(n))
        : undefined;
      const inner = new Set(stops);
      if (join) inner.add(join);
      if (ctx && !ctx.classic) inner.add(ctx.header);
      const branch = (b: string | undefined): Block => {
        const body = seq(b, inner, ctx);
        if (ctx && !ctx.classic && !(b && returns(b, ctx.header))) {
          body.push({ t: "exit" });
        }
        return body;
      };
      const yesBlock = branch(yes);
      const noBlock = branch(no);
      block.push({
        t: "if",
        py: condPy,
        erl: condErl,
        yes: yesBlock,
        no: noBlock,
      });
      if (ctx && !ctx.classic && join && !returns(join, ctx.header)) {
        ctx.next = join;
        return block;
      }
      cur = join;
    }
    return block;
  };

  const program = seq(start, new Set());
  const preamble = [...usedCorrect].map((v) => {
    const value = CORRECT_VALUES[v] ?? '"secret"';
    return `correct_${v} = ${value}`;
  });
  if (bodies.some((b) => /\bbalance\b/.test(b)))
    preamble.push("balance = 1000");

  const flag = LOOP_FLAGS[level.id] ?? "done";
  const render = (lang: Language): string => {
    const lines: string[] = [...preamble];
    const key = lang === "python" ? "py" : "erl";
    const emit = (block: Block, depth: number) => {
      const pad = "    ".repeat(depth);
      for (const s of block) {
        if (s.t === "line") lines.push(pad + s[key]);
        else if (s.t === "while") {
          if (lang === "python") {
            lines.push(`${pad}while ${s.py}:`);
            emit(s.body, depth + 1);
          } else {
            lines.push(`${pad}while ${s.erl}`);
            emit(s.body, depth + 1);
            lines.push(`${pad}endwhile`);
          }
        } else if (s.t === "exit") {
          lines.push(`${pad}${flag} = ${lang === "python" ? "True" : "true"}`);
        } else if (s.t === "loop") {
          const f = lang === "python" ? ["False", "True"] : ["false", "true"];
          lines.push(`${pad}${flag} = ${f[0]}`);
          lines.push(
            lang === "python"
              ? `${pad}while ${flag} == False:`
              : `${pad}while ${flag} == false`,
          );
          emit(s.body, depth + 1);
          if (lang === "erl") lines.push(`${pad}endwhile`);
        } else if (s.t === "do") {
          if (lang === "python") {
            lines.push(`${pad}${flag} = False`);
            lines.push(`${pad}while ${flag} == False:`);
            emit(s.body, depth + 1);
            lines.push(`${pad}    if ${s.py}:`);
            lines.push(`${pad}        ${flag} = True`);
          } else {
            lines.push(`${pad}do`);
            emit(s.body, depth + 1);
            lines.push(`${pad}until ${s.erl}`);
          }
        } else {
          emitIf(s, depth, "if");
          if (lang === "erl") lines.push(`${"    ".repeat(depth)}endif`);
        }
      }
    };
    const emitIf = (
      s: Extract<Stmt, { t: "if" }>,
      depth: number,
      word: "if" | "elif" | "elseif",
    ) => {
      const pad = "    ".repeat(depth);
      if (s.yes.length === 0 && s.no.length > 0) {
        s = {
          ...s,
          py: negate(s.py, "python"),
          erl: negate(s.erl, "erl"),
          yes: s.no,
          no: [],
        };
      }
      const cond = s[key];
      lines.push(
        lang === "python"
          ? `${pad}${word} ${cond}:`
          : `${pad}${word} ${cond} then`,
      );
      emit(s.yes, depth + 1);
      const only = s.no.length === 1 ? s.no[0] : null;
      if (only && only.t === "if") {
        emitIf(only, depth, lang === "python" ? "elif" : "elseif");
        return;
      }
      if (s.no.length > 0) {
        lines.push(`${pad}else${lang === "python" ? ":" : ""}`);
        emit(s.no, depth + 1);
      }
    };
    emit(program, 0);
    return lines.join("\n");
  };

  return { python: render("python"), erl: render("erl") };
}

// Helpers for the ERL IDE URL (matches the encoding the IDE expects)
export function encodeForERL(code: string): string {
  return code
    .replace(/\\/g, "%5C")
    .replace(/"/g, "%5C%22")
    .replace(/'/g, "%27")
    .replace(/\?/g, "%3F")
    .replace(/=/g, "%3D")
    .replace(/\+/g, "%2B")
    .replace(/\n/g, "%5Cn")
    .replace(/ /g, "+")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

export function generateERLURL(code: string): string {
  return `https://www.examreferencelanguage.co.uk/index.php?code=%5B%7B%22name%22%3A%22code%22%2C%22content%22%3A%22${encodeForERL(code)}%22%7D%5D`;
}
