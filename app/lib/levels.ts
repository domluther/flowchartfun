import type { EdgeDef, Item, Level, NodeDef, Shape, Side } from "./types";

type NodeSpec = [
  id: string,
  col: number,
  row: number,
  shape: Shape,
  text: string,
  fixed?: boolean,
];

function build(
  meta: Pick<Level, "id" | "title" | "topic" | "instructions">,
  specs: NodeSpec[],
  edges: [
    from: string,
    fromSide: Side,
    to: string,
    toSide: Side,
    label?: string,
  ][],
  distractors: [shape: Shape, text: string][] = [],
): Level {
  const items: Item[] = specs.map(([id, , , shape, text]) => ({
    id,
    shape,
    text,
  }));
  distractors.forEach(([shape, text], i) => {
    items.push({ id: `distractor-${i}`, shape, text });
  });
  const nodes: NodeDef[] = specs.map(([id, col, row, , , fixed]) => ({
    id,
    col,
    row,
    answer: id,
    fixed,
  }));
  const edgeDefs: EdgeDef[] = edges.map(
    ([from, fromSide, to, toSide, label]) => ({
      from,
      fromSide,
      to,
      toSide,
      label,
    }),
  );
  return { ...meta, items, nodes, edges: edgeDefs };
}

export const levels: Level[] = [
  build(
    {
      id: 1,
      title: "Flowchart Basics",
      topic: "Sequence",
      instructions:
        "Create a simple flowchart that calculates the sum of two numbers. Drag each symbol into the correct place.",
    },
    [
      ["start", 1, 0, "terminator", "Start"],
      ["inA", 1, 1, "io", "Input A"],
      ["inB", 1, 2, "io", "Input B"],
      ["calc", 1, 3, "process", "Calculate Sum = A + B"],
      ["out", 1, 4, "io", "Output Sum"],
      ["end", 1, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "inA", "t"],
      ["inA", "b", "inB", "t"],
      ["inB", "b", "calc", "t"],
      ["calc", "b", "out", "t"],
      ["out", "b", "end", "t"],
    ],
  ),
  build(
    {
      id: 2,
      title: "Input, Process, Output",
      topic: "Sequence",
      instructions:
        "Make a flowchart that finds the area of a rectangle. Watch out: one symbol is not needed!",
    },
    [
      ["start", 1, 0, "terminator", "Start"],
      ["inL", 1, 1, "io", "Input length"],
      ["inW", 1, 2, "io", "Input width"],
      ["calc", 1, 3, "process", "area = length × width"],
      ["out", 1, 4, "io", "Output area"],
      ["end", 1, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "inL", "t"],
      ["inL", "b", "inW", "t"],
      ["inW", "b", "calc", "t"],
      ["calc", "b", "out", "t"],
      ["out", "b", "end", "t"],
    ],
    [["process", "perimeter = 2 × (length + width)"]],
  ),
  build(
    {
      id: 3,
      title: "Making a Decision",
      topic: "Selection",
      instructions:
        "Output whether a person is an adult or a child. Remember: diamonds are decisions, with a Yes path and a No path.",
    },
    [
      ["start", 1, 0, "terminator", "Start"],
      ["in", 1, 1, "io", "Input age"],
      ["dec", 1, 2, "decision", "age >= 18?"],
      ["adult", 0, 3, "io", 'Output "Adult"'],
      ["child", 2, 3, "io", 'Output "Child"'],
      ["end", 1, 4, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "dec", "t"],
      ["dec", "l", "adult", "t", "Yes"],
      ["dec", "r", "child", "t", "No"],
      ["adult", "b", "end", "l"],
      ["child", "b", "end", "r"],
    ],
  ),
  build(
    {
      id: 4,
      title: "Odd or Even",
      topic: "Selection",
      instructions:
        "Use MOD (the remainder after division) to decide whether a number is even or odd.",
    },
    [
      ["start", 1, 0, "terminator", "Start"],
      ["in", 1, 1, "io", "Input number"],
      ["dec", 1, 2, "decision", "number MOD 2 = 0?"],
      ["even", 0, 3, "io", 'Output "Even"'],
      ["odd", 2, 3, "io", 'Output "Odd"'],
      ["end", 1, 4, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "dec", "t"],
      ["dec", "l", "even", "t", "Yes"],
      ["dec", "r", "odd", "t", "No"],
      ["even", "b", "end", "l"],
      ["odd", "b", "end", "r"],
    ],
    [["decision", "number > 2?"]],
  ),
  build(
    {
      id: 5,
      title: "Grade Boundaries",
      topic: "Nested selection",
      instructions:
        "Output Distinction for 70 or more, Merit for 50 or more, otherwise Fail. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", "Input mark"],
      ["d1", 1, 2, "decision", "mark >= 70?"],
      ["dist", 0, 2, "io", 'Output "Distinction"'],
      ["d2", 1, 3, "decision", "mark >= 50?"],
      ["merit", 0, 3, "io", 'Output "Merit"'],
      ["fail", 1, 4, "io", 'Output "Fail"'],
      ["end", 1, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "d1", "t"],
      ["d1", "l", "dist", "r", "Yes"],
      ["d1", "b", "d2", "t", "No"],
      ["d2", "l", "merit", "r", "Yes"],
      ["d2", "b", "fail", "t", "No"],
      ["fail", "b", "end", "t"],
      ["merit", "b", "end", "l"],
      ["dist", "l", "end", "l"],
    ],
  ),
  build(
    {
      id: 6,
      title: "Count to Five",
      topic: "Iteration",
      instructions:
        "Output the numbers 1 to 5. The arrow that goes back up is a loop. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["set", 1, 1, "process", "count = 1"],
      ["dec", 1, 2, "decision", "count <= 5?"],
      ["out", 1, 3, "io", "Output count"],
      ["inc", 1, 4, "process", "count = count + 1"],
      ["end", 2, 2, "terminator", "End"],
    ],
    [
      ["start", "b", "set", "t"],
      ["set", "b", "dec", "t"],
      ["dec", "b", "out", "t", "Yes"],
      ["out", "b", "inc", "t"],
      ["inc", "l", "dec", "l"],
      ["dec", "r", "end", "l", "No"],
    ],
  ),
  build(
    {
      id: 7,
      title: "Password Check",
      topic: "Iteration",
      instructions:
        "Keep asking for the password until it is correct, then grant access. Start and End are placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", "Input password"],
      ["dec", 1, 2, "decision", "password correct?"],
      ["out", 1, 3, "io", 'Output "Access granted"'],
      ["end", 1, 4, "terminator", "End", true],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "dec", "t"],
      ["dec", "l", "in", "l", "No"],
      ["dec", "b", "out", "t", "Yes"],
      ["out", "b", "end", "t"],
    ],
    [["process", "password = 0"]],
  ),
  build(
    {
      id: 8,
      title: "Running Total",
      topic: "Iteration",
      instructions:
        "Input three numbers and output their total. This one combines a counter, a total and a loop.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["tot", 1, 1, "process", "total = 0"],
      ["cnt", 1, 2, "process", "count = 1"],
      ["dec", 1, 3, "decision", "count <= 3?"],
      ["in", 1, 4, "io", "Input number"],
      ["add", 1, 5, "process", "total = total + number"],
      ["inc", 1, 6, "process", "count = count + 1"],
      ["out", 2, 3, "io", "Output total"],
      ["end", 2, 4, "terminator", "End"],
    ],
    [
      ["start", "b", "tot", "t"],
      ["tot", "b", "cnt", "t"],
      ["cnt", "b", "dec", "t"],
      ["dec", "b", "in", "t", "Yes"],
      ["in", "b", "add", "t"],
      ["add", "b", "inc", "t"],
      ["inc", "l", "dec", "l"],
      ["dec", "r", "out", "l", "No"],
      ["out", "b", "end", "t"],
    ],
    [["process", "total = total + 1"]],
  ),
];

export function getLevel(id: number): Level | undefined {
  return levels.find((l) => l.id === id);
}
