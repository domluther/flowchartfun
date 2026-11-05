import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    JSON.parse(localStorage.getItem("flowchartfun-progress-v2") ?? "null"),
  ).toEqual({ easy: [1], hard: [] });
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
