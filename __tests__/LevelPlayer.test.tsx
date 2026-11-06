import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Block } from "../app/components/Block";
import { LevelPlayer } from "../app/components/LevelPlayer";
import { levels } from "../app/lib/levels";

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

const level = levels[0];

it.each(["Start", "End"])("renders the %s terminator in green", (text) => {
  render(
    <Block item={{ id: text.toLowerCase(), shape: "terminator", text }} />,
  );

  expect(screen.getByText(text)).toHaveClass("bg-green-500");
});

it.each(["guided", "draw"] as const)(
  "groups toolbox symbols by shape in %s mode",
  (mode) => {
    const levelWithEachShape = levels.find((candidate) =>
      ["terminator", "io", "process", "decision"].every((shape) =>
        candidate.items.some((item) => item.shape === shape),
      ),
    );
    if (!levelWithEachShape) throw new Error("No level contains every shape");

    render(<LevelPlayer level={levelWithEachShape} mode={mode} />);

    const shapeOrder = ["terminator", "io", "process", "decision"];
    const displayedShapes = screen.getAllByTestId(/^item-/).map((button) => {
      const itemId = button.getAttribute("data-testid")?.slice("item-".length);
      const item = levelWithEachShape.items.find(
        (candidate) => candidate.id === itemId,
      );
      if (!item) throw new Error(`Missing item for ${itemId}`);
      return item.shape;
    });

    expect(displayedShapes).toEqual(
      [...displayedShapes].sort(
        (a, b) => shapeOrder.indexOf(a) - shapeOrder.indexOf(b),
      ),
    );
    expect(new Set(displayedShapes)).toEqual(new Set(shapeOrder));
  },
);

function setup() {
  render(<LevelPlayer level={level} nextId={2} />);
}

async function fill(user: ReturnType<typeof userEvent.setup>, ids: string[]) {
  for (const n of level.nodes) {
    await user.click(screen.getByTestId(`item-${ids[level.nodes.indexOf(n)]}`));
    await user.click(screen.getByTestId(`slot-${n.id}`));
  }
}

beforeEach(() => localStorage.clear());

it("solves a level with click-to-place and records progress", async () => {
  const user = userEvent.setup();
  setup();
  await fill(
    user,
    level.nodes.map((n) => n.id),
  );
  await user.click(screen.getByRole("button", { name: "Check Answer" }));
  expect(screen.getByRole("status")).toHaveTextContent("Correct");
  expect(
    JSON.parse(localStorage.getItem("flowchartfun-progress-v4") ?? "null"),
  ).toEqual({ guided: [1], draw: [], shapes: [] });
});

it("reports wrong answers", async () => {
  const user = userEvent.setup();
  setup();
  await fill(user, [...level.nodes.map((n) => n.id)].reverse());
  await user.click(screen.getByRole("button", { name: "Check Answer" }));
  expect(screen.getByRole("status")).not.toHaveTextContent("Correct");
});

it("resets the board", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByTestId("item-start"));
  await user.click(screen.getByTestId("slot-start"));
  expect(screen.queryByTestId("item-start")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Reset" }));
  expect(screen.getByTestId("item-start")).toBeInTheDocument();
});

it("shows puzzle navigation and disables previous on the first level", () => {
  setup();

  expect(
    screen.getByRole("button", { name: "← Previous puzzle" }),
  ).toBeDisabled();
  expect(screen.getByRole("link", { name: "Next puzzle →" })).toHaveAttribute(
    "href",
    "/level/2",
  );
});

it("keeps the selected mode when navigating between puzzles", () => {
  render(
    <LevelPlayer level={levels[1]} mode="draw" previousId={1} nextId={3} />,
  );

  expect(
    screen.getByRole("link", { name: "← Previous puzzle" }),
  ).toHaveAttribute("href", "/level/1?mode=draw");
  expect(screen.getByRole("link", { name: "Next puzzle →" })).toHaveAttribute(
    "href",
    "/level/3?mode=draw",
  );
});

it("disables next on the last level", () => {
  render(<LevelPlayer level={levels[levels.length - 1]} previousId={29} />);

  expect(
    screen.getByRole("link", { name: "← Previous puzzle" }),
  ).toHaveAttribute("href", "/level/29");
  expect(screen.getByRole("button", { name: "Next puzzle →" })).toBeDisabled();
});
