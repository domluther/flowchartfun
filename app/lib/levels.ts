import type { EdgeDef, Item, Level, NodeDef, Shape, Side, Tier } from "./types";

type NodeSpec = [
  id: string,
  col: number,
  row: number,
  shape: Shape,
  text: string,
  fixed?: boolean,
];

type EdgeSpec = [
  from: string,
  fromSide: Side,
  to: string,
  toSide: Side,
  label?: string,
];

type Meta = Pick<Level, "id" | "title" | "topic" | "instructions">;

function build(
  tier: Tier,
  meta: Meta,
  specs: NodeSpec[],
  edges: EdgeSpec[],
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
  return { ...meta, tier, items, nodes, edges: edgeDefs };
}

const easy = (
  meta: Meta,
  specs: NodeSpec[],
  edges: EdgeSpec[],
  d?: [Shape, string][],
) => build("easy", meta, specs, edges, d);
const medium = (
  meta: Meta,
  specs: NodeSpec[],
  edges: EdgeSpec[],
  d?: [Shape, string][],
) => build("medium", meta, specs, edges, d);
const hard = (
  meta: Meta,
  specs: NodeSpec[],
  edges: EdgeSpec[],
  d?: [Shape, string][],
) => build("hard", meta, specs, edges, d);

/** Three-way split used by the nested selection levels. */
function nestedSelection(
  meta: Meta,
  inputText: string,
  first: [test: string, output: string],
  second: [test: string, output: string],
  otherwise: string,
  d?: [Shape, string][],
): Level {
  return medium(
    meta,
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", inputText],
      ["d1", 1, 2, "decision", first[0]],
      ["o1", 0, 2, "io", first[1]],
      ["d2", 1, 3, "decision", second[0]],
      ["o2", 0, 3, "io", second[1]],
      ["o3", 1, 4, "io", otherwise],
      ["end", 1, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "d1", "t"],
      ["d1", "l", "o1", "r", "Yes"],
      ["d1", "b", "d2", "t", "No"],
      ["d2", "l", "o2", "r", "Yes"],
      ["d2", "b", "o3", "t", "No"],
      ["o3", "b", "end", "t"],
      ["o2", "b", "end", "l"],
      ["o1", "l", "end", "l"],
    ],
    d,
  );
}

/** Start -> input -> decision -> two outputs (left = Yes, right = No) -> End. */
function twoWay(
  tier: Tier,
  meta: Meta,
  inputs: string[],
  test: string,
  yes: string,
  no: string,
  d?: [Shape, string][],
): Level {
  const rows = inputs.length;
  const specs: NodeSpec[] = [
    ["start", 1, 0, "terminator", "Start"],
    ...inputs.map((text, i): NodeSpec => [`in${i}`, 1, i + 1, "io", text]),
    ["dec", 1, rows + 1, "decision", test],
    ["yes", 0, rows + 2, "io", yes],
    ["no", 2, rows + 2, "io", no],
    ["end", 1, rows + 3, "terminator", "End"],
  ];
  const edges: EdgeSpec[] = [
    ["start", "b", "in0", "t"],
    ...inputs
      .slice(1)
      .map((_, i): EdgeSpec => [`in${i}`, "b", `in${i + 1}`, "t"]),
    [`in${rows - 1}`, "b", "dec", "t"],
    ["dec", "l", "yes", "t", "Yes"],
    ["dec", "r", "no", "t", "No"],
    ["yes", "b", "end", "l"],
    ["no", "b", "end", "r"],
  ];
  return build(tier, meta, specs, edges, d);
}

/** Slots whose order does not affect the result, keyed by level id. */
const INTERCHANGEABLE: Record<number, string[][]> = {
  1: [["inA", "inB"]],
  2: [["inL", "inW"]],
  4: [["in1", "in2"]],
  10: [["in0", "in1"]],
  14: [
    ["tot", "cnt"],
    ["add", "inc"],
  ],
  15: [["in0", "in1"]],
  24: [["t", "i"]],
  25: [
    ["setm", "setc"],
    ["upd", "inc"],
  ],
  27: [
    ["sets", "setq"],
    ["add", "inc"],
  ],
  28: [["n1", "n2", "op"]],
};

const baseLevels: Level[] = [
  // ───────────── Easy: sequence and a single decision ─────────────
  easy(
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
  easy(
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
  easy(
    {
      id: 3,
      title: "Hello, Name",
      topic: "Sequence",
      instructions:
        "Ask for a name and greet the user. Not every symbol is needed.",
    },
    [
      ["start", 1, 0, "terminator", "Start"],
      ["in", 1, 1, "io", "Input name"],
      ["join", 1, 2, "process", 'message = "Hello " + name'],
      ["out", 1, 3, "io", "Output message"],
      ["end", 1, 4, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "join", "t"],
      ["join", "b", "out", "t"],
      ["out", "b", "end", "t"],
    ],
    [["io", "Input age"]],
  ),
  easy(
    {
      id: 4,
      title: "Average of Two",
      topic: "Sequence",
      instructions:
        "Input two numbers and output their average. Remember the brackets!",
    },
    [
      ["start", 1, 0, "terminator", "Start"],
      ["in1", 1, 1, "io", "Input number 1"],
      ["in2", 1, 2, "io", "Input number 2"],
      ["calc", 1, 3, "process", "average = (number 1 + number 2) / 2"],
      ["out", 1, 4, "io", "Output average"],
      ["end", 1, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "in1", "t"],
      ["in1", "b", "in2", "t"],
      ["in2", "b", "calc", "t"],
      ["calc", "b", "out", "t"],
      ["out", "b", "end", "t"],
    ],
    [["process", "average = number 1 + number 2 / 2"]],
  ),
  twoWay(
    "easy",
    {
      id: 5,
      title: "Making a Decision",
      topic: "Selection",
      instructions:
        "Output whether a person is an adult or a child. Remember: diamonds are decisions, with a Yes path and a No path.",
    },
    ["Input age"],
    "age >= 18?",
    'Output "Adult"',
    'Output "Child"',
  ),
  twoWay(
    "easy",
    {
      id: 6,
      title: "Odd or Even",
      topic: "Selection",
      instructions:
        "Use MOD (the remainder after division) to decide whether a number is even or odd.",
    },
    ["Input number"],
    "number MOD 2 = 0?",
    'Output "Even"',
    'Output "Odd"',
    [["decision", "number > 2?"]],
  ),
  twoWay(
    "easy",
    {
      id: 7,
      title: "Pass or Fail",
      topic: "Selection",
      instructions: "A mark of 40 or more is a pass. Anything else is a fail.",
    },
    ["Input mark"],
    "mark >= 40?",
    'Output "Pass"',
    'Output "Fail"',
  ),
  easy(
    {
      id: 8,
      title: "Discount",
      topic: "Selection",
      instructions:
        "Shoppers get 10% off if they spend more than £100. Everyone sees a price at the end. Notice that one path skips a step.",
    },
    [
      ["start", 1, 0, "terminator", "Start"],
      ["in", 1, 1, "io", "Input price"],
      ["dec", 1, 2, "decision", "price > 100?"],
      ["disc", 0, 3, "process", "price = price × 0.9"],
      ["out", 1, 4, "io", "Output price"],
      ["end", 1, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "dec", "t"],
      ["dec", "l", "disc", "t", "Yes"],
      ["dec", "b", "out", "t", "No"],
      ["disc", "b", "out", "l"],
      ["out", "b", "end", "t"],
    ],
  ),
  twoWay(
    "easy",
    {
      id: 9,
      title: "Cinema Ticket",
      topic: "Selection",
      instructions:
        "Under 16s pay the child price. Everyone else pays the adult price.",
    },
    ["Input age"],
    "age < 16?",
    'Output "Child ticket"',
    'Output "Adult ticket"',
    [["io", "Input name"]],
  ),
  twoWay(
    "easy",
    {
      id: 10,
      title: "Login",
      topic: "Selection",
      instructions:
        "Ask for a username and password, then decide whether to let the user in.",
    },
    ["Input username", "Input password"],
    "password correct?",
    'Output "Welcome"',
    'Output "Access denied"',
  ),

  // ───────────── Medium: nested selection and simple loops ─────────────
  nestedSelection(
    {
      id: 11,
      title: "Grade Boundaries",
      topic: "Nested selection",
      instructions:
        "Output Distinction for 70 or more, Merit for 50 or more, otherwise Fail. Start is already placed for you.",
    },
    "Input mark",
    ["mark >= 70?", 'Output "Distinction"'],
    ["mark >= 50?", 'Output "Merit"'],
    'Output "Fail"',
  ),
  medium(
    {
      id: 12,
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
  medium(
    {
      id: 13,
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
  medium(
    {
      id: 14,
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
  twoWay(
    "medium",
    {
      id: 15,
      title: "Larger Number",
      topic: "Selection",
      instructions: "Input two numbers and output the larger one.",
    },
    ["Input A", "Input B"],
    "A > B?",
    "Output A",
    "Output B",
    [["decision", "A = B?"]],
  ),
  nestedSelection(
    {
      id: 16,
      title: "Speed Camera",
      topic: "Nested selection",
      instructions:
        "Over 70 is a fine. Over 60 is a warning. Anything else is fine to drive on. Start is already placed for you.",
    },
    "Input speed",
    ["speed > 70?", 'Output "Fine"'],
    ["speed > 60?", 'Output "Warning"'],
    'Output "OK"',
    [["decision", "speed = 70?"]],
  ),
  medium(
    {
      id: 17,
      title: "Countdown",
      topic: "Iteration",
      instructions:
        "Count down from 10 and finish with a launch message. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["set", 1, 1, "process", "count = 10"],
      ["dec", 1, 2, "decision", "count > 0?"],
      ["out", 1, 3, "io", "Output count"],
      ["dec2", 1, 4, "process", "count = count - 1"],
      ["go", 2, 2, "io", 'Output "Blast off!"'],
      ["end", 2, 3, "terminator", "End"],
    ],
    [
      ["start", "b", "set", "t"],
      ["set", "b", "dec", "t"],
      ["dec", "b", "out", "t", "Yes"],
      ["out", "b", "dec2", "t"],
      ["dec2", "l", "dec", "l"],
      ["dec", "r", "go", "l", "No"],
      ["go", "b", "end", "t"],
    ],
    [["process", "count = count + 1"]],
  ),
  medium(
    {
      id: 18,
      title: "Times Table",
      topic: "Iteration",
      instructions:
        "Input a number and output its 12 times table. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", "Input number"],
      ["set", 1, 2, "process", "count = 1"],
      ["dec", 1, 3, "decision", "count <= 12?"],
      ["out", 1, 4, "io", "Output number × count"],
      ["inc", 1, 5, "process", "count = count + 1"],
      ["end", 2, 3, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "set", "t"],
      ["set", "b", "dec", "t"],
      ["dec", "b", "out", "t", "Yes"],
      ["out", "b", "inc", "t"],
      ["inc", "l", "dec", "l"],
      ["dec", "r", "end", "l", "No"],
    ],
    [["process", "count = 0"]],
  ),
  medium(
    {
      id: 19,
      title: "Total Until Zero",
      topic: "Iteration",
      instructions:
        "Keep adding numbers to a total until the user enters 0, then output the total. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["set", 1, 1, "process", "total = 0"],
      ["in", 1, 2, "io", "Input number"],
      ["dec", 1, 3, "decision", "number = 0?"],
      ["add", 1, 4, "process", "total = total + number"],
      ["out", 2, 3, "io", "Output total"],
      ["end", 2, 4, "terminator", "End"],
    ],
    [
      ["start", "b", "set", "t"],
      ["set", "b", "in", "t"],
      ["in", "b", "dec", "t"],
      ["dec", "b", "add", "t", "No"],
      ["add", "l", "in", "l"],
      ["dec", "r", "out", "l", "Yes"],
      ["out", "b", "end", "t"],
    ],
    [["process", "count = 0"]],
  ),
  nestedSelection(
    {
      id: 20,
      title: "Number Sign",
      topic: "Nested selection",
      instructions:
        "Output whether a number is positive, negative or zero. Start is already placed for you.",
    },
    "Input number",
    ["number > 0?", 'Output "Positive"'],
    ["number < 0?", 'Output "Negative"'],
    'Output "Zero"',
  ),

  // ───────────── Hard: loops with decisions inside, validation, multiple exits ─────────────
  hard(
    {
      id: 21,
      title: "Input Validation",
      topic: "Validation",
      instructions:
        "Ask for a number from 1 to 10. If it is not in range, say so and ask again. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", "Input number"],
      ["dec", 1, 2, "decision", "number from 1 to 10?"],
      ["out", 1, 3, "io", 'Output "Thank you"'],
      ["err", 2, 2, "io", 'Output "Invalid number"'],
      ["end", 1, 4, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "dec", "t"],
      ["dec", "b", "out", "t", "Yes"],
      ["dec", "r", "err", "l", "No"],
      ["err", "t", "in", "r"],
      ["out", "b", "end", "t"],
    ],
    [["process", "number = 0"]],
  ),
  hard(
    {
      id: 22,
      title: "Even Numbers",
      topic: "Iteration and selection",
      instructions:
        "Output only the even numbers from 1 to 10. A decision sits inside the loop. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["set", 1, 1, "process", "i = 1"],
      ["d1", 1, 2, "decision", "i <= 10?"],
      ["d2", 1, 3, "decision", "i MOD 2 = 0?"],
      ["out", 0, 3, "io", "Output i"],
      ["inc", 1, 4, "process", "i = i + 1"],
      ["end", 0, 2, "terminator", "End"],
    ],
    [
      ["start", "b", "set", "t"],
      ["set", "b", "d1", "t"],
      ["d1", "b", "d2", "t", "Yes"],
      ["d1", "l", "end", "r", "No"],
      ["d2", "l", "out", "r", "Yes"],
      ["d2", "b", "inc", "t", "No"],
      ["out", "b", "inc", "l"],
      ["inc", "r", "d1", "r"],
    ],
    [["process", "i = i + 2"]],
  ),
  hard(
    {
      id: 23,
      title: "Three Attempts",
      topic: "Iteration and selection",
      instructions:
        "The user gets three tries to enter the correct password. After three wrong tries they are locked out. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["set", 1, 1, "process", "tries = 0"],
      ["in", 1, 2, "io", "Input password"],
      ["d1", 1, 3, "decision", "password correct?"],
      ["ok", 2, 3, "io", 'Output "Access granted"'],
      ["inc", 1, 4, "process", "tries = tries + 1"],
      ["d2", 1, 5, "decision", "tries = 3?"],
      ["lock", 1, 6, "io", 'Output "Locked out"'],
      ["end", 1, 7, "terminator", "End"],
    ],
    [
      ["start", "b", "set", "t"],
      ["set", "b", "in", "t"],
      ["in", "b", "d1", "t"],
      ["d1", "r", "ok", "l", "Yes"],
      ["d1", "b", "inc", "t", "No"],
      ["inc", "b", "d2", "t"],
      ["d2", "b", "lock", "t", "Yes"],
      ["d2", "l", "in", "l", "No"],
      ["lock", "b", "end", "t"],
      ["ok", "b", "end", "r"],
    ],
    [["process", "tries = tries - 1"]],
  ),
  hard(
    {
      id: 24,
      title: "Sum to N",
      topic: "Iteration",
      instructions:
        "Input a number n and output the total of 1 + 2 + … + n. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", "Input n"],
      ["t", 1, 2, "process", "total = 0"],
      ["i", 1, 3, "process", "i = 1"],
      ["dec", 1, 4, "decision", "i <= n?"],
      ["add", 1, 5, "process", "total = total + i"],
      ["inc", 1, 6, "process", "i = i + 1"],
      ["out", 2, 4, "io", "Output total"],
      ["end", 2, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "t", "t"],
      ["t", "b", "i", "t"],
      ["i", "b", "dec", "t"],
      ["dec", "b", "add", "t", "Yes"],
      ["add", "b", "inc", "t"],
      ["inc", "l", "dec", "l"],
      ["dec", "r", "out", "l", "No"],
      ["out", "b", "end", "t"],
    ],
    [["process", "total = n"]],
  ),
  hard(
    {
      id: 25,
      title: "Largest of Five",
      topic: "Iteration and selection",
      instructions:
        "Input five positive numbers and output the largest. Keep track of the biggest so far. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["setm", 1, 1, "process", "max = 0"],
      ["setc", 1, 2, "process", "count = 1"],
      ["d1", 1, 3, "decision", "count <= 5?"],
      ["in", 1, 4, "io", "Input number"],
      ["d2", 1, 5, "decision", "number > max?"],
      ["inc", 1, 6, "process", "count = count + 1"],
      ["out", 0, 3, "io", "Output max"],
      ["end", 0, 4, "terminator", "End"],
      ["upd", 0, 5, "process", "max = number"],
    ],
    [
      ["start", "b", "setm", "t"],
      ["setm", "b", "setc", "t"],
      ["setc", "b", "d1", "t"],
      ["d1", "b", "in", "t", "Yes"],
      ["d1", "l", "out", "r", "No"],
      ["out", "b", "end", "t"],
      ["in", "b", "d2", "t"],
      ["d2", "l", "upd", "r", "Yes"],
      ["d2", "b", "inc", "t", "No"],
      ["upd", "b", "inc", "l"],
      ["inc", "r", "d1", "r"],
    ],
    [["process", "max = max + number"]],
  ),
  hard(
    {
      id: 26,
      title: "Cash Machine",
      topic: "Nested selection",
      instructions:
        "Check the PIN, then check there is enough money before paying out. Every path finishes at End. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["pin", 1, 1, "io", "Input PIN"],
      ["d1", 1, 2, "decision", "PIN correct?"],
      ["wrong", 0, 2, "io", 'Output "Wrong PIN"'],
      ["amt", 1, 3, "io", "Input amount"],
      ["d2", 1, 4, "decision", "amount <= balance?"],
      ["poor", 2, 4, "io", 'Output "Insufficient funds"'],
      ["upd", 1, 5, "process", "balance = balance - amount"],
      ["cash", 1, 6, "io", 'Output "Take your cash"'],
      ["end", 1, 7, "terminator", "End"],
    ],
    [
      ["start", "b", "pin", "t"],
      ["pin", "b", "d1", "t"],
      ["d1", "l", "wrong", "r", "No"],
      ["d1", "b", "amt", "t", "Yes"],
      ["amt", "b", "d2", "t"],
      ["d2", "r", "poor", "l", "No"],
      ["d2", "b", "upd", "t", "Yes"],
      ["upd", "b", "cash", "t"],
      ["cash", "b", "end", "t"],
      ["poor", "b", "end", "r"],
      ["wrong", "b", "end", "l"],
    ],
    [["process", "balance = balance + amount"]],
  ),
  hard(
    {
      id: 27,
      title: "Quiz Score",
      topic: "Iteration and selection",
      instructions:
        "Ask three questions. Add one to the score for each correct answer, then output the score. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["sets", 1, 1, "process", "score = 0"],
      ["setq", 1, 2, "process", "question = 1"],
      ["d1", 1, 3, "decision", "question <= 3?"],
      ["in", 1, 4, "io", "Input answer"],
      ["d2", 1, 5, "decision", "answer correct?"],
      ["inc", 1, 6, "process", "question = question + 1"],
      ["out", 0, 3, "io", "Output score"],
      ["end", 0, 4, "terminator", "End"],
      ["add", 0, 5, "process", "score = score + 1"],
    ],
    [
      ["start", "b", "sets", "t"],
      ["sets", "b", "setq", "t"],
      ["setq", "b", "d1", "t"],
      ["d1", "b", "in", "t", "Yes"],
      ["d1", "l", "out", "r", "No"],
      ["out", "b", "end", "t"],
      ["in", "b", "d2", "t"],
      ["d2", "l", "add", "r", "Yes"],
      ["d2", "b", "inc", "t", "No"],
      ["add", "b", "inc", "l"],
      ["inc", "r", "d1", "r"],
    ],
    [["process", "score = score - 1"]],
  ),
  hard(
    {
      id: 28,
      title: "Calculator",
      topic: "Nested selection",
      instructions:
        "Input two numbers and an operator (+ or -), then output the answer. Anything else is an unknown operator. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["n1", 1, 1, "io", "Input number 1"],
      ["n2", 1, 2, "io", "Input number 2"],
      ["op", 1, 3, "io", "Input operator"],
      ["d1", 1, 4, "decision", 'op = "+"?'],
      ["add", 2, 4, "io", "Output number 1 + number 2"],
      ["d2", 1, 5, "decision", 'op = "-"?'],
      ["sub", 0, 5, "io", "Output number 1 - number 2"],
      ["err", 1, 6, "io", 'Output "Unknown operator"'],
      ["end", 1, 7, "terminator", "End"],
    ],
    [
      ["start", "b", "n1", "t"],
      ["n1", "b", "n2", "t"],
      ["n2", "b", "op", "t"],
      ["op", "b", "d1", "t"],
      ["d1", "r", "add", "l", "Yes"],
      ["d1", "b", "d2", "t", "No"],
      ["d2", "l", "sub", "r", "Yes"],
      ["d2", "b", "err", "t", "No"],
      ["err", "b", "end", "t"],
      ["sub", "b", "end", "l"],
      ["add", "b", "end", "r"],
    ],
    [["process", "answer = number 1 × number 2"]],
  ),
  hard(
    {
      id: 29,
      title: "Prime Number",
      topic: "Iteration and selection",
      instructions:
        "Try dividing by 2, 3, 4… up to one less than the number. If any divide exactly it is not prime. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", "Input number"],
      ["set", 1, 2, "process", "divisor = 2"],
      ["d1", 1, 3, "decision", "divisor < number?"],
      ["d2", 1, 4, "decision", "number MOD divisor = 0?"],
      ["inc", 1, 5, "process", "divisor = divisor + 1"],
      ["prime", 0, 3, "io", 'Output "Prime"'],
      ["notp", 0, 4, "io", 'Output "Not prime"'],
      ["end", 0, 5, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "set", "t"],
      ["set", "b", "d1", "t"],
      ["d1", "b", "d2", "t", "Yes"],
      ["d1", "l", "prime", "r", "No"],
      ["d2", "l", "notp", "r", "Yes"],
      ["d2", "b", "inc", "t", "No"],
      ["inc", "r", "d1", "r"],
      ["notp", "b", "end", "t"],
      ["prime", "l", "end", "l"],
    ],
    [["process", "divisor = 1"]],
  ),
  hard(
    {
      id: 30,
      title: "Menu Loop",
      topic: "Iteration and selection",
      instructions:
        "Show a menu: 1 says hello, 2 says goodbye, 3 quits. Any other choice asks again. Start is already placed for you.",
    },
    [
      ["start", 1, 0, "terminator", "Start", true],
      ["in", 1, 1, "io", "Input choice"],
      ["d1", 1, 2, "decision", "choice = 1?"],
      ["o1", 0, 2, "io", 'Output "Hello"'],
      ["d2", 1, 3, "decision", "choice = 2?"],
      ["o2", 0, 3, "io", 'Output "Goodbye"'],
      ["d3", 1, 4, "decision", "choice = 3?"],
      ["bad", 2, 4, "io", 'Output "Try again"'],
      ["bye", 1, 5, "io", 'Output "Bye"'],
      ["end", 1, 6, "terminator", "End"],
    ],
    [
      ["start", "b", "in", "t"],
      ["in", "b", "d1", "t"],
      ["d1", "l", "o1", "r", "Yes"],
      ["d1", "b", "d2", "t", "No"],
      ["d2", "l", "o2", "r", "Yes"],
      ["d2", "b", "d3", "t", "No"],
      ["d3", "b", "bye", "t", "Yes"],
      ["d3", "r", "bad", "l", "No"],
      ["bye", "b", "end", "t"],
      ["o1", "l", "in", "l"],
      ["o2", "l", "in", "l"],
      ["bad", "r", "in", "r"],
    ],
    [["process", "choice = 0"]],
  ),
];

export const levels: Level[] = baseLevels.map((level) => ({
  ...level,
  interchangeable: INTERCHANGEABLE[level.id],
}));

export const TIERS: { id: Tier; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "Sequence and a single decision" },
  { id: "medium", label: "Medium", blurb: "Nested decisions and simple loops" },
  { id: "hard", label: "Hard", blurb: "Loops with decisions inside" },
];

export function getLevel(id: number): Level | undefined {
  return levels.find((l) => l.id === id);
}
