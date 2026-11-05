import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LevelPlayer } from "../app/components/LevelPlayer";
import { getLevel } from "../app/lib/levels";
import type { Level } from "../app/lib/types";

// react-router ships ESM only, which Jest's CommonJS runtime can't load
jest.mock("react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const level = getLevel(5) as Level;
type User = ReturnType<typeof userEvent.setup>;

async function placeAll(user: User) {
  for (const n of level.nodes) {
    if (n.fixed) continue;
    await user.click(screen.getByTestId(`item-${n.answer}`));
    await user.click(screen.getByTestId(`slot-${n.id}`));
  }
}

async function connect(
  user: User,
  from: string,
  fromSide: string,
  to: string,
  toSide: string,
) {
  await user.click(screen.getByTestId(`handle-${from}-${fromSide}`));
  await user.click(screen.getByTestId(`handle-${to}-${toSide}`));
}

async function drawAll(user: User, labels = true) {
  for (const e of level.edges) {
    await connect(user, e.from, e.fromSide, e.to, e.toSide);
    if (e.label && labels) {
      await user.click(screen.getByRole("button", { name: e.label }));
    }
  }
}

function setup() {
  render(<LevelPlayer level={level} mode="draw" nextId={6} />);
}

const check = (user: User) =>
  user.click(screen.getByRole("button", { name: "Check Answer" }));

beforeEach(() => localStorage.clear());

it("shows no arrows and no connection points in guided mode", () => {
  render(<LevelPlayer level={level} mode="guided" />);
  expect(screen.queryByTestId("handle-start-b")).toBeNull();
  expect(document.querySelectorAll("polyline").length).toBeGreaterThan(0);
});

it("starts draw mode with no arrows and offers connection points only on placed symbols", async () => {
  const user = userEvent.setup();
  setup();
  expect(document.querySelectorAll("polyline")).toHaveLength(0);
  expect(screen.queryByTestId("handle-in0-b")).toBeNull();
  await user.click(screen.getByTestId("item-in0"));
  await user.click(screen.getByTestId("slot-in0"));
  expect(screen.getByTestId("handle-in0-b")).toBeInTheDocument();
});

it("solves a draw-mode level by drawing arrows and labelling the diamond's exits", async () => {
  const user = userEvent.setup();
  setup();
  await placeAll(user);
  await drawAll(user);
  await check(user);
  expect(screen.getByRole("status")).toHaveTextContent("Correct");
  expect(
    JSON.parse(localStorage.getItem("flowchartfun-progress-v3") ?? "{}"),
  ).toEqual({
    guided: [],
    draw: [5],
  });
  expect(screen.getByRole("link", { name: /Next level/ })).toHaveAttribute(
    "href",
    "/level/6?mode=draw",
  );
});

it("opens the Yes/No chooser for a decision arrow but not for other arrows", async () => {
  const user = userEvent.setup();
  setup();
  await placeAll(user);
  await connect(user, "start", "b", "in0", "t");
  expect(screen.queryByRole("button", { name: "Yes" })).toBeNull();
  await connect(user, "dec", "l", "yes", "t");
  const options = screen.getByLabelText("Arrow options");
  expect(
    within(options).getByRole("button", { name: "Yes" }),
  ).toBeInTheDocument();
  expect(
    within(options).getByRole("button", { name: "No" }),
  ).toBeInTheDocument();
});

it("fails when a decision arrow is left unlabelled", async () => {
  const user = userEvent.setup();
  setup();
  await placeAll(user);
  await drawAll(user, false);
  await check(user);
  expect(screen.getByRole("status")).not.toHaveTextContent("Correct");
  expect(screen.getByRole("status")).toHaveTextContent("Yes/No label");
});

it("fails when Yes and No are the wrong way round", async () => {
  const user = userEvent.setup();
  setup();
  await placeAll(user);
  for (const e of level.edges) {
    await connect(user, e.from, e.fromSide, e.to, e.toSide);
    if (e.label) {
      await user.click(
        screen.getByRole("button", { name: e.label === "Yes" ? "No" : "Yes" }),
      );
    }
  }
  await check(user);
  expect(screen.getByRole("status")).not.toHaveTextContent("Correct");
});

it("lets a student delete an arrow they drew by mistake", async () => {
  const user = userEvent.setup();
  setup();
  await placeAll(user);
  await connect(user, "start", "b", "end", "t");
  await user.click(
    screen.getByRole("button", { name: /Arrow from Start to End/ }),
  );
  await user.click(screen.getByRole("button", { name: "Delete" }));
  expect(document.querySelectorAll("polyline")).toHaveLength(0);
});

it("removes arrows when their symbol is taken off the chart", async () => {
  const user = userEvent.setup();
  setup();
  await placeAll(user);
  await connect(user, "start", "b", "in0", "t");
  expect(document.querySelectorAll("polyline").length).toBeGreaterThan(0);
  await user.click(screen.getByTestId("slot-in0"));
  expect(document.querySelectorAll("polyline")).toHaveLength(0);
});

it("clears arrows on reset", async () => {
  const user = userEvent.setup();
  setup();
  await placeAll(user);
  await connect(user, "start", "b", "in0", "t");
  await user.click(screen.getByRole("button", { name: "Reset" }));
  expect(document.querySelectorAll("polyline")).toHaveLength(0);
});
